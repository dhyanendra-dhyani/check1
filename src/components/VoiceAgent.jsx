/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v13 — Reliable Listening + Pending Queue Barge-In
 *
 * FIX: v12 broke listening by being too aggressive with barge-in.
 * The `|| processingRef.current` in the barge-in check caused
 * false positives (mic picks up TTS echo → triggers barge-in
 * during processing → chaos).
 *
 * NEW APPROACH:
 *   - Barge-in ONLY when `isSpeakingRef.current` (agent is talking)
 *   - Cancel TTS immediately on barge-in ✓
 *   - If transcript arrives while processingRef is true → queue it
 *   - After current processing finishes → process queued transcript
 *   - This gives reliable listening + real barge-in
 *
 * ALSO:
 *   - Route/screen change still cancels old TTS + speaks new page
 *   - Transition phrases on page change
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useLocation } from 'react-router-dom';
import VoiceContext from './VoiceContext';
import { streamGeminiResponse, stopSpeaking, hasApiKeys } from '../utils/geminiVoiceAgent';
import {
    CONV_STATES, CITIZEN_KEYWORDS, GUEST_KEYWORDS,
    CITIZEN_REQUIRED_KEYWORDS, RE_PROMPT_GREETINGS,
    COMPLAINT_KEYWORDS, BACK_KEYWORDS, HOME_KEYWORDS, STOP_KEYWORDS,
    matchesKeywords, detectBillType,
    findCommonAnswer, getPageGuidance,
    getResponse, getInitialGreeting,
} from '../utils/voiceKnowledgeBase';

const SPEECH_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
};

const SCREEN_GUIDANCE = {
    'citizen-auth': {
        hi: 'लॉगिन पेज आ गया। तीन बटन हैं — अंगूठा लगाइए, आँख स्कैन कराइए, या OTP डालिए। सबसे आसान अंगूठा है — बस लगाइए। बोलें "अंगूठा", "आँख", या "OTP"।',
        en: 'Login page is ready. Three options — Thumbprint, Iris scan, or OTP. Thumbprint is easiest. Say "thumb", "iris", or "OTP".',
    },
    'citizen-dashboard': {
        hi: 'डैशबोर्ड खुल गया! ऊपर बकाया बिल, बीच में शिकायतें, नीचे अतिरिक्त सेवाएं। बोलें क्या करना है?',
        en: 'Dashboard open! Pending bills, complaints, extra services. What would you like to do?',
    },
    guest: {
        hi: 'ठीक है! बताइए कौन सा बिल भरना है — बिजली, पानी, या गैस? शिकायत भी दर्ज कर सकते हैं।',
        en: 'Which bill — electricity, water, or gas? You can also file a complaint.',
    },
};

const TRANSITION = {
    hi: 'लगता है आप आगे आ गए हैं। ',
    en: 'Looks like you moved ahead. ',
};

const VoiceAgent = memo(function VoiceAgent({
    lang, setLang, screen, setScreen, voiceMode,
    navigate, setCitizen, addLog, children,
}) {
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState('idle');
    const [lastTranscript, setLastTranscript] = useState('');
    const [lastReply, setLastReply] = useState('');
    const [interimText, setInterimText] = useState('');

    const isActiveRef = useRef(false);
    const isSpeakingRef = useRef(false);
    const recognitionRef = useRef(null);
    const langRef = useRef(lang);
    const screenRef = useRef(screen);
    const processingRef = useRef(false);
    const bargedInRef = useRef(false);
    const pendingTranscriptRef = useRef(null);  // queued transcript from barge-in
    const silenceTimerRef = useRef(null);
    const lastInterimRef = useRef('');
    const lastRouteRef = useRef('');
    const lastScreenRef = useRef(screen);
    const restartCountRef = useRef(0);
    const convStateRef = useRef(CONV_STATES.INITIAL);
    const rePromptTimerRef = useRef(null);
    const rePromptCountRef = useRef(0);

    const location = useLocation();

    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { screenRef.current = screen; }, [screen]);

    const log = useCallback((msg) => {
        console.log(`[VA] ${msg}`);
        addLog?.(msg);
    }, [addLog]);

    // ── TTS ──────────────────────────────────────────
    const ttsSpeak = useCallback((text, langCode) => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis || !text) { resolve(); return; }
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = SPEECH_LANGS[langCode] || 'hi-IN';
            u.rate = 1.05; u.pitch = 1; u.volume = 1;
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang.startsWith(langCode));
            if (v) u.voice = v;
            u.onend = () => { isSpeakingRef.current = false; resolve(); };
            u.onerror = () => { isSpeakingRef.current = false; resolve(); };
            isSpeakingRef.current = true;
            setStatus('speaking');
            window.speechSynthesis.speak(u);
        });
    }, []);

    const queueTTS = useCallback((text, langCode) => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis || !text || bargedInRef.current) { resolve(); return; }
            const u = new SpeechSynthesisUtterance(text);
            u.lang = SPEECH_LANGS[langCode] || 'hi-IN';
            u.rate = 1.05; u.pitch = 1; u.volume = 1;
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang.startsWith(langCode));
            if (v) u.voice = v;
            u.onend = () => resolve();
            u.onerror = () => resolve();
            window.speechSynthesis.speak(u);
        });
    }, []);

    // ═══ RE-PROMPT ═══════════════════════════════════

    const startRePromptTimer = useCallback(() => {
        clearTimeout(rePromptTimerRef.current);
        if (!isActiveRef.current || convStateRef.current !== CONV_STATES.WAIT_PATH) return;

        rePromptTimerRef.current = setTimeout(async () => {
            if (!isActiveRef.current || processingRef.current || isSpeakingRef.current) return;
            if (convStateRef.current !== CONV_STATES.WAIT_PATH) return;

            const idx = Math.min(rePromptCountRef.current, RE_PROMPT_GREETINGS.length - 1);
            const rp = RE_PROMPT_GREETINGS[idx];
            const text = rp[langRef.current] || rp.en;

            log(`🔁 Re-prompt #${rePromptCountRef.current + 1}`);
            setLastReply(text);
            await ttsSpeak(text, langRef.current);
            rePromptCountRef.current++;
            if (isActiveRef.current && rePromptCountRef.current < 3) {
                setStatus('listening');
                startRePromptTimer();
            }
        }, 12000);
    }, [log, ttsSpeak]);

    // ═══ RECOGNITION ═════════════════════════════════

    const startRecognition = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR || !isActiveRef.current) return;
        try { recognitionRef.current?.abort(); } catch { }

        const r = new SR();
        r.lang = SPEECH_LANGS[langRef.current] || 'hi-IN';
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 1;

        r.onstart = () => {
            log('🎧 Listening...');
            restartCountRef.current = 0;
            if (!isSpeakingRef.current) setStatus('listening');
        };

        r.onresult = (e) => {
            const last = e.results[e.results.length - 1];

            // ═══ BARGE-IN: Only when agent is SPEAKING ═══
            // (Not during processing — that caused false positives)
            if (isSpeakingRef.current) {
                log('🔇 Barge-in — stopping agent speech');
                window.speechSynthesis.cancel();
                isSpeakingRef.current = false;
                bargedInRef.current = true;
                setStatus('listening');
            }

            clearTimeout(rePromptTimerRef.current);

            if (last.isFinal) {
                const t = last[0].transcript.trim();
                if (t.length < 2) return;

                log(`📝 Final: "${t}"`);
                lastInterimRef.current = '';
                setInterimText('');
                clearTimeout(silenceTimerRef.current);

                if (processingRef.current) {
                    // ═══ QUEUE: Store for after current processing finishes ═══
                    log(`📥 Queued (processing busy): "${t}"`);
                    pendingTranscriptRef.current = t;
                } else {
                    handleTranscript(t);
                }
            } else {
                lastInterimRef.current = last[0].transcript;
                setInterimText(last[0].transcript);
                if (!isSpeakingRef.current) setStatus('listening');

                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    const t = lastInterimRef.current?.trim();
                    if (t && t.length > 2 && !processingRef.current) {
                        log(`⏱️ Silence timeout: "${t}"`);
                        handleTranscript(t);
                        lastInterimRef.current = '';
                        setInterimText('');
                    }
                }, 1500);
            }
        };

        r.onerror = (e) => {
            if (['no-speech', 'aborted'].includes(e.error)) {
                if (isActiveRef.current) {
                    restartCountRef.current++;
                    if (restartCountRef.current < 50) setTimeout(() => startRecognition(), Math.min(500 * restartCountRef.current, 3000));
                }
                return;
            }
            if (isActiveRef.current && restartCountRef.current < 50) {
                restartCountRef.current++;
                setTimeout(() => startRecognition(), 1500);
            }
        };

        r.onend = () => {
            if (isActiveRef.current && restartCountRef.current < 50) {
                restartCountRef.current++;
                setTimeout(() => startRecognition(), 300);
            }
        };

        recognitionRef.current = r;
        try { r.start(); } catch { if (isActiveRef.current) setTimeout(() => startRecognition(), 1000); }
    }, [log]);

    // ═══ KNOWLEDGE-BASE PROCESSING ═══════════════════

    const handleTranscript = useCallback(async (transcript) => {
        if (processingRef.current) return;
        processingRef.current = true;
        bargedInRef.current = false;
        pendingTranscriptRef.current = null;
        clearTimeout(rePromptTimerRef.current);

        setLastTranscript(transcript);
        setInterimText('');
        lastInterimRef.current = '';
        setStatus('processing');
        log(`🎤 [${convStateRef.current}] "${transcript}"`);

        const L = langRef.current;
        const lower = transcript.toLowerCase();

        // ── STOP ──
        if (matchesKeywords(transcript, STOP_KEYWORDS)) {
            const r = getResponse('stopping', L);
            setLastReply(r);
            await ttsSpeak(r, L);
            deactivateVoice();
            finishProcessing();
            return;
        }

        // ── BACK ──
        if (matchesKeywords(transcript, BACK_KEYWORDS)) {
            log('⬅️ Back');
            navigate(-1);
            finishProcessing();
            return;
        }

        // ── HOME ──
        if (matchesKeywords(transcript, HOME_KEYWORDS)) {
            navigate('/');
            finishProcessing();
            return;
        }

        // ── AUTH ACTIONS (on citizen-auth screen) ──
        if (screenRef.current === 'citizen-auth') {
            if (lower.includes('angootha') || lower.includes('thumb') || lower.includes('finger') || lower.includes('अंगूठा') || lower.includes('ungali')) {
                log('👆 Thumb');
                const r = L === 'hi'
                    ? 'ठीक है, नीचे "Thumb" बटन दबाएं। फिर दाईं तरफ बायोमेट्रिक मशीन पर अंगूठा रखें। 2-3 सेकंड में हो जाएगा।'
                    : 'Press "Thumb" button below. Place your thumb on the scanner. 2-3 seconds.';
                setLastReply(r);
                if (!bargedInRef.current) await ttsSpeak(r, L);
                finishProcessing();
                return;
            }
            if (lower.includes('aankh') || lower.includes('iris') || lower.includes('eye') || lower.includes('आँख') || lower.includes('ankh')) {
                log('👁️ Iris');
                const r = L === 'hi'
                    ? 'ठीक है, "Iris" बटन दबाएं। कैमरे में देखें, आँख खुली रखें।'
                    : 'Press "Iris" button. Look at the camera.';
                setLastReply(r);
                if (!bargedInRef.current) await ttsSpeak(r, L);
                finishProcessing();
                return;
            }
            if (lower.includes('otp') || lower.includes('mobile') || lower.includes('ओटीपी') || lower.includes('मोबाइल')) {
                log('📱 OTP');
                const r = L === 'hi'
                    ? '"OTP" बटन दबाएं। मोबाइल नंबर डालें। डेमो OTP: 482916।'
                    : 'Press "OTP" button. Enter mobile number. Demo OTP: 482916.';
                setLastReply(r);
                if (!bargedInRef.current) await ttsSpeak(r, L);
                finishProcessing();
                return;
            }
        }

        // ── CITIZEN-REQUIRED FEATURES ──
        if (matchesKeywords(transcript, CITIZEN_REQUIRED_KEYWORDS)) {
            log('🔐 Citizen-required');
            let responseKey = 'citizen_required_redirect';
            if (lower.includes('naam') || lower.includes('name') || lower.includes('नाम')) responseKey = 'citizen_required_naam';
            else if (lower.includes('pipeline') || lower.includes('gas line') || lower.includes('पाइपलाइन')) responseKey = 'citizen_required_pipeline';
            else if (lower.includes('connection') || lower.includes('naya') || lower.includes('नया')) responseKey = 'citizen_required_connection';

            const r = getResponse(responseKey, L);
            setLastReply(r);
            if (!bargedInRef.current) await ttsSpeak(r, L);
            convStateRef.current = CONV_STATES.CITIZEN_AUTH;
            setScreen('citizen-auth');
            finishProcessing();
            return;
        }

        // ── COMMON Q&A ──
        const qa = findCommonAnswer(transcript, L);
        if (qa) {
            log('📚 Q&A');
            setLastReply(qa);
            if (!bargedInRef.current) await ttsSpeak(qa, L);
            finishProcessing();
            return;
        }

        // ═══ STATE MACHINE ═══════════════════════════

        const state = convStateRef.current;

        if (state === CONV_STATES.WAIT_PATH || state === CONV_STATES.INITIAL) {

            if (matchesKeywords(transcript, CITIZEN_KEYWORDS)) {
                log('→ Citizen');
                convStateRef.current = CONV_STATES.CITIZEN_AUTH;
                const r = getResponse('citizen_chosen', L);
                setLastReply(r);
                if (!bargedInRef.current) await ttsSpeak(r, L);
                setScreen('citizen-auth');
                finishProcessing();
                return;
            }

            if (matchesKeywords(transcript, GUEST_KEYWORDS)) {
                log('→ Guest');
                convStateRef.current = CONV_STATES.GUEST_HOME;
                setScreen('guest');
                navigate('/');
                const r = getResponse('guest_chosen', L);
                setLastReply(r);
                if (!bargedInRef.current) await ttsSpeak(r, L);
                finishProcessing();
                return;
            }

            const billType = detectBillType(transcript);
            if (billType) {
                log(`→ Direct bill: ${billType}`);
                convStateRef.current = CONV_STATES.BILL_INPUT;
                setScreen('guest');
                navigate(`/bill/${billType}`);
                finishProcessing();
                return;
            }

            if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
                log('→ Direct complaint');
                convStateRef.current = CONV_STATES.COMPLAINT_CAT;
                setScreen('guest');
                navigate('/complaint');
                finishProcessing();
                return;
            }
        }

        // ── Any state: bill/complaint nav ──
        const billType = detectBillType(transcript);
        if (billType) {
            log(`→ Bill: ${billType}`);
            convStateRef.current = CONV_STATES.BILL_INPUT;
            navigate(`/bill/${billType}`);
            finishProcessing();
            return;
        }

        if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
            log('→ Complaint');
            convStateRef.current = CONV_STATES.COMPLAINT_CAT;
            navigate('/complaint');
            finishProcessing();
            return;
        }

        // ── FALLBACK: Gemini ──
        if (hasApiKeys()) {
            try {
                let fullReply = '';
                let firstSent = false;

                const result = await streamGeminiResponse(
                    transcript, L, `${screenRef.current} | ${window.location.pathname}`,
                    async (sentence, idx) => {
                        if (bargedInRef.current) return;
                        fullReply += (idx > 0 ? ' ' : '') + sentence;
                        setLastReply(fullReply);
                        if (idx === 0) { isSpeakingRef.current = true; setStatus('speaking'); firstSent = true; }
                        if (!bargedInRef.current) await queueTTS(sentence, L);
                    }
                );

                if (!firstSent && result.reply && !bargedInRef.current) {
                    setLastReply(result.reply);
                    await ttsSpeak(result.reply, L);
                }

                if (result.intent === 'navigate' && result.action_key) {
                    const routes = { electricity: '/bill/electricity', water: '/bill/water', gas: '/bill/gas', complaint: '/complaint', home: '/' };
                    if (routes[result.action_key]) navigate(routes[result.action_key]);
                } else if (result.intent === 'set_screen') {
                    if (result.action_key === 'quick_pay') { setScreen('guest'); navigate('/'); }
                    else if (result.action_key === 'citizen_login') setScreen('citizen-auth');
                } else if (result.intent === 'go_back') navigate(-1);

            } catch (err) {
                log(`❌ Gemini: ${err.message}`);
                if (!bargedInRef.current) {
                    const r = getResponse('not_understood', L);
                    setLastReply(r);
                    await ttsSpeak(r, L);
                }
            }
        } else {
            if (!bargedInRef.current) {
                const r = getResponse('not_understood', L);
                setLastReply(r);
                await ttsSpeak(r, L);
            }
        }

        finishProcessing();
    }, [navigate, setScreen, log, ttsSpeak, queueTTS]);

    // ═══ FINISH PROCESSING + CHECK PENDING ═══════════

    const finishProcessing = useCallback(() => {
        isSpeakingRef.current = false;
        processingRef.current = false;

        // ═══ CHECK FOR QUEUED BARGE-IN TRANSCRIPT ═══
        const pending = pendingTranscriptRef.current;
        if (pending) {
            pendingTranscriptRef.current = null;
            log(`📤 Processing queued transcript: "${pending}"`);
            // Process on next tick to avoid stack issues
            setTimeout(() => {
                if (isActiveRef.current) handleTranscript(pending);
            }, 50);
            return;
        }

        if (isActiveRef.current && !bargedInRef.current) setStatus('listening');
    }, [log]);

    // ═══ SCREEN CHANGE → CANCEL + SPEAK NEW ═════════

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        if (screen === lastScreenRef.current) return;

        const prevScreen = lastScreenRef.current;
        lastScreenRef.current = screen;
        log(`📺 Screen: ${prevScreen} → ${screen}`);

        if (!prevScreen || screen === 'idle') return;

        // Cancel old speech about previous screen
        window.speechSynthesis?.cancel();
        isSpeakingRef.current = false;
        bargedInRef.current = true; // skip remaining old TTS

        const g = SCREEN_GUIDANCE[screen];
        if (g) {
            const transition = TRANSITION[langRef.current] || TRANSITION.en;
            const guidance = g[langRef.current] || g.en;
            const fullText = transition + guidance;

            setTimeout(async () => {
                if (isActiveRef.current) {
                    bargedInRef.current = false;
                    log(`📍 Screen guidance: ${screen}`);
                    setLastReply(fullText);
                    await ttsSpeak(fullText, langRef.current);
                    if (isActiveRef.current) setStatus('listening');
                }
            }, 500);
        }
    }, [screen, voiceMode, log, ttsSpeak]);

    // ═══ ROUTE CHANGE → CANCEL + SPEAK NEW ══════════

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        const currentPath = location.pathname;

        if (currentPath !== lastRouteRef.current) {
            const prevPath = lastRouteRef.current;
            lastRouteRef.current = currentPath;
            log(`📍 Route: ${prevPath} → ${currentPath}`);

            // Cancel old speech
            window.speechSynthesis?.cancel();
            isSpeakingRef.current = false;
            bargedInRef.current = true;

            const guidance = getPageGuidance(currentPath, langRef.current);
            if (guidance) {
                const transition = prevPath ? (TRANSITION[langRef.current] || TRANSITION.en) : '';
                const fullText = transition + guidance;

                setTimeout(async () => {
                    if (isActiveRef.current) {
                        bargedInRef.current = false;
                        setLastReply(fullText);
                        await ttsSpeak(fullText, langRef.current);
                        if (isActiveRef.current) setStatus('listening');
                    }
                }, 400);
            }
        }
    }, [location.pathname, voiceMode, log, ttsSpeak]);

    // ═══ ACTIVATE ═══════════════════════════════════

    const activateVoice = useCallback(async () => {
        if (isActiveRef.current) return;
        isActiveRef.current = true;
        setIsActive(true);
        setLastTranscript('');
        setLastReply('');
        setInterimText('');
        stopSpeaking();
        restartCountRef.current = 0;
        rePromptCountRef.current = 0;
        lastRouteRef.current = window.location.pathname;
        lastScreenRef.current = screen;
        convStateRef.current = CONV_STATES.WAIT_PATH;
        pendingTranscriptRef.current = null;
        log('🟢 Activated');

        const greeting = getInitialGreeting(langRef.current);
        setLastReply(greeting);
        setStatus('speaking');
        await ttsSpeak(greeting, langRef.current);

        if (isActiveRef.current) {
            log('📢 Greeting done → listening');
            setStatus('listening');
            startRecognition();
            startRePromptTimer();
        }
    }, [screen, startRecognition, startRePromptTimer, log, ttsSpeak]);

    // ═══ DEACTIVATE ═════════════════════════════════

    const deactivateVoice = useCallback(() => {
        isActiveRef.current = false;
        setIsActive(false);
        setStatus('idle');
        setInterimText('');
        isSpeakingRef.current = false;
        processingRef.current = false;
        convStateRef.current = CONV_STATES.INITIAL;
        pendingTranscriptRef.current = null;
        stopSpeaking();
        window.speechSynthesis?.cancel();
        clearTimeout(silenceTimerRef.current);
        clearTimeout(rePromptTimerRef.current);
        try { recognitionRef.current?.abort(); } catch { }
        log('🔴 Deactivated');
    }, [log]);

    // Auto-activate
    useEffect(() => {
        if (voiceMode && !isActiveRef.current && screen !== 'idle') {
            log('🔄 Auto-activate');
            activateVoice();
        }
    }, [voiceMode, screen, activateVoice, log]);

    // Cleanup
    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            try { recognitionRef.current?.abort(); } catch { }
            stopSpeaking();
            clearTimeout(rePromptTimerRef.current);
        };
    }, []);

    const ctx = {
        voiceMode, isActive, status, lastTranscript, lastReply,
        activate: activateVoice, deactivate: deactivateVoice,
    };

    return (
        <VoiceContext.Provider value={ctx}>
            {children}

            {isActive && (
                <div className={`vo-bar vo-bar-${status}`}>
                    <div className="vo-bar-left">
                        {status === 'listening' && (
                            <>
                                <div className="vo-pulse" />
                                <span className="vo-bar-label">
                                    {interimText ? `"${interimText}"` : (lang === 'hi' ? '🎧 बोलिए...' : '🎧 Speak...')}
                                </span>
                            </>
                        )}
                        {status === 'processing' && (
                            <>
                                <div className="vo-spinner" />
                                <span className="vo-bar-label">{lang === 'hi' ? '🧠 समझ रहा हूँ...' : '🧠 Thinking...'}</span>
                            </>
                        )}
                        {status === 'speaking' && (
                            <>
                                <div className="vo-waves">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="vo-wave" style={{ animationDelay: `${i * 0.12}s` }} />
                                    ))}
                                </div>
                                <span className="vo-bar-reply">
                                    {lastReply?.substring(0, 100)}{lastReply?.length > 100 ? '...' : ''}
                                </span>
                            </>
                        )}
                    </div>
                    <button className="vo-bar-close"
                        onClick={status === 'speaking'
                            ? () => { window.speechSynthesis?.cancel(); isSpeakingRef.current = false; bargedInRef.current = true; setStatus('listening'); }
                            : deactivateVoice}>
                        {status === 'speaking' ? '⏭' : '✕'}
                    </button>
                </div>
            )}
        </VoiceContext.Provider>
    );
});

export default VoiceAgent;
