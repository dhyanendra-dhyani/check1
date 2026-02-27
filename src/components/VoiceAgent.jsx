/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v12 — True Barge-In + Mid-Speech Page Transitions
 *
 * KEY FIXES:
 *   1. TRUE BARGE-IN: When user speaks mid-TTS:
 *      - Cancel TTS immediately
 *      - Abort current processing (abortRef)
 *      - Process NEW user transcript
 *      - Respond to what USER said, not finish old sentence
 *
 *   2. MID-SPEECH PAGE TRANSITION: When user clicks to new page:
 *      - Cancel current TTS about old page
 *      - Say transition phrase: "लगता है आप आगे आ गए हैं"
 *      - Speak guidance for NEW page
 *
 *   3. Screen + Route change BOTH cancel old speech & speak new
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

// ── SCREEN GUIDANCE ─────────────────────────────────
const SCREEN_GUIDANCE = {
    'citizen-auth': {
        hi: 'लॉगिन पेज आ गया। तीन बटन हैं — अंगूठा लगाइए, आँख स्कैन कराइए, या OTP डालिए। सबसे आसान अंगूठा है — बस लगाइए, 2-3 सेकंड में हो जाएगा। या बोलें "अंगूठा", "आँख", या "OTP"।',
        en: 'Login page is ready. Three options — Thumbprint, Iris scan, or OTP. Thumbprint is easiest. Say "thumb", "iris", or "OTP".',
    },
    'citizen-dashboard': {
        hi: 'डैशबोर्ड खुल गया! ऊपर बकाया बिल, बीच में शिकायतें, नीचे अतिरिक्त सेवाएं। बोलें क्या करना है?',
        en: 'Dashboard is open! Pending bills, complaints, and extra services. What would you like to do?',
    },
    guest: {
        hi: 'ठीक है! बताइए कौन सा बिल भरना है — बिजली, पानी, या गैस? शिकायत भी दर्ज कर सकते हैं।',
        en: 'Which bill — electricity, water, or gas? You can also file a complaint.',
    },
};

// ── Transition phrases (when user navigates mid-speech) ──
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
    const abortRef = useRef(0);         // incremented to abort old processing
    const silenceTimerRef = useRef(null);
    const lastInterimRef = useRef('');
    const lastRouteRef = useRef('');
    const lastScreenRef = useRef(screen);
    const restartCountRef = useRef(0);
    const convStateRef = useRef(CONV_STATES.INITIAL);
    const rePromptTimerRef = useRef(null);
    const rePromptCountRef = useRef(0);
    const pendingTranscriptRef = useRef(null);  // holds barged-in transcript

    const location = useLocation();

    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { screenRef.current = screen; }, [screen]);

    const log = useCallback((msg) => {
        console.log(`[VA] ${msg}`);
        addLog?.(msg);
    }, [addLog]);

    // ── CANCEL ALL SPEECH ────────────────────────────
    const cancelAllSpeech = useCallback(() => {
        window.speechSynthesis?.cancel();
        isSpeakingRef.current = false;
    }, []);

    // ── TTS ──────────────────────────────────────────
    const ttsSpeak = useCallback((text, langCode, myAbortId) => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis || !text) { resolve(); return; }
            // If abort ID changed, someone interrupted us — don't speak
            if (myAbortId !== undefined && myAbortId !== abortRef.current) { resolve(); return; }
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

    const queueTTS = useCallback((text, langCode, myAbortId) => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis || !text) { resolve(); return; }
            if (myAbortId !== undefined && myAbortId !== abortRef.current) { resolve(); return; }
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
        if (!isActiveRef.current) return;
        if (convStateRef.current !== CONV_STATES.WAIT_PATH) return;

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

            // ═══ TRUE BARGE-IN ═══
            // User speaks while agent is speaking or processing
            // → Cancel EVERYTHING, process the new speech
            if (isSpeakingRef.current || processingRef.current) {
                log('🔇 BARGE-IN! Canceling old speech + processing');
                cancelAllSpeech();
                // Increment abort ID to kill any in-progress handleTranscript
                abortRef.current++;
                processingRef.current = false;
                setStatus('listening');
            }

            clearTimeout(rePromptTimerRef.current);

            if (last.isFinal) {
                const t = last[0].transcript.trim();
                log(`📝 "${t}"`);
                lastInterimRef.current = '';
                setInterimText('');
                clearTimeout(silenceTimerRef.current);
                if (t.length > 1) {
                    // Always process — no processingRef guard (barge-in clears it above)
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
                        log(`⏱️ Silence: "${t}"`);
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
    }, [log, cancelAllSpeech]);

    // ═══ KNOWLEDGE-BASE PROCESSING ═══════════════════

    const handleTranscript = useCallback(async (transcript) => {
        // Grab current abort ID — if it changes mid-processing, we stop
        const myAbortId = abortRef.current;
        processingRef.current = true;
        clearTimeout(rePromptTimerRef.current);

        setLastTranscript(transcript);
        setInterimText('');
        lastInterimRef.current = '';
        setStatus('processing');
        log(`🎤 [${convStateRef.current}] "${transcript}"`);

        const L = langRef.current;
        const lower = transcript.toLowerCase();

        // Helper: check if we've been aborted (user barged in again)
        const aborted = () => myAbortId !== abortRef.current;

        // ── STOP ──
        if (matchesKeywords(transcript, STOP_KEYWORDS)) {
            const r = getResponse('stopping', L);
            setLastReply(r);
            await ttsSpeak(r, L, myAbortId);
            deactivateVoice();
            processingRef.current = false;
            return;
        }

        // ── BACK ──
        if (matchesKeywords(transcript, BACK_KEYWORDS)) {
            log('⬅️ Back');
            const reply = L === 'hi' ? 'ठीक है, पीछे जा रहे हैं।' : 'Going back.';
            setLastReply(reply);
            await ttsSpeak(reply, L, myAbortId);
            if (!aborted()) navigate(-1);
            processingRef.current = false;
            if (isActiveRef.current) setStatus('listening');
            return;
        }

        // ── HOME ──
        if (matchesKeywords(transcript, HOME_KEYWORDS)) {
            navigate('/');
            processingRef.current = false;
            return;
        }

        // ── AUTH ACTIONS (on citizen-auth screen) ──
        if (screenRef.current === 'citizen-auth') {
            if (lower.includes('angootha') || lower.includes('thumb') || lower.includes('finger') || lower.includes('अंगूठा') || lower.includes('ungali')) {
                log('👆 Thumb');
                const r = L === 'hi'
                    ? 'ठीक है, अंगूठा लगाइए — दाईं तरफ बायोमेट्रिक मशीन पर अपना अंगूठा रखें। 2-3 सेकंड में स्कैन हो जाएगा। नीचे "Thumb" बटन दबाएं।'
                    : 'Place your thumb on the biometric scanner. Press the "Thumb" button below.';
                setLastReply(r);
                await ttsSpeak(r, L, myAbortId);
                if (isActiveRef.current && !aborted()) setStatus('listening');
                processingRef.current = false;
                return;
            }
            if (lower.includes('aankh') || lower.includes('iris') || lower.includes('eye') || lower.includes('आँख') || lower.includes('ankh')) {
                log('👁️ Iris');
                const r = L === 'hi'
                    ? 'ठीक है, कैमरे की तरफ देखें, आँख खुली रखें। नीचे "Iris" बटन दबाएं।'
                    : 'Look at the camera with your eye open. Press the "Iris" button.';
                setLastReply(r);
                await ttsSpeak(r, L, myAbortId);
                if (isActiveRef.current && !aborted()) setStatus('listening');
                processingRef.current = false;
                return;
            }
            if (lower.includes('otp') || lower.includes('mobile') || lower.includes('ओटीपी') || lower.includes('मोबाइल')) {
                log('📱 OTP');
                const r = L === 'hi'
                    ? 'ठीक है, "OTP" बटन दबाएं। मोबाइल नंबर डालें। OTP आएगा — डेमो OTP है 482916।'
                    : 'Press "OTP" button. Enter mobile number. Demo OTP is 482916.';
                setLastReply(r);
                await ttsSpeak(r, L, myAbortId);
                if (isActiveRef.current && !aborted()) setStatus('listening');
                processingRef.current = false;
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
            await ttsSpeak(r, L, myAbortId);
            if (!aborted()) {
                convStateRef.current = CONV_STATES.CITIZEN_AUTH;
                setScreen('citizen-auth');
            }
            processingRef.current = false;
            return;
        }

        // ── COMMON Q&A ──
        const qa = findCommonAnswer(transcript, L);
        if (qa) {
            log('📚 Q&A');
            setLastReply(qa);
            await ttsSpeak(qa, L, myAbortId);
            if (isActiveRef.current && !aborted()) setStatus('listening');
            processingRef.current = false;
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
                await ttsSpeak(r, L, myAbortId);
                if (!aborted()) setScreen('citizen-auth');
                processingRef.current = false;
                return;
            }

            if (matchesKeywords(transcript, GUEST_KEYWORDS)) {
                log('→ Guest');
                convStateRef.current = CONV_STATES.GUEST_HOME;
                setScreen('guest');
                navigate('/');
                const r = getResponse('guest_chosen', L);
                setLastReply(r);
                await ttsSpeak(r, L, myAbortId);
                if (isActiveRef.current && !aborted()) setStatus('listening');
                processingRef.current = false;
                return;
            }

            const billType = detectBillType(transcript);
            if (billType) {
                log(`→ Bill: ${billType}`);
                convStateRef.current = CONV_STATES.BILL_INPUT;
                setScreen('guest');
                navigate(`/bill/${billType}`);
                processingRef.current = false;
                return;
            }

            if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
                log('→ Complaint');
                convStateRef.current = CONV_STATES.COMPLAINT_CAT;
                setScreen('guest');
                navigate('/complaint');
                processingRef.current = false;
                return;
            }
        }

        // ── Any state: bill/complaint nav ──
        const billType = detectBillType(transcript);
        if (billType) {
            log(`→ Bill: ${billType}`);
            convStateRef.current = CONV_STATES.BILL_INPUT;
            navigate(`/bill/${billType}`);
            processingRef.current = false;
            return;
        }

        if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
            log('→ Complaint');
            convStateRef.current = CONV_STATES.COMPLAINT_CAT;
            navigate('/complaint');
            processingRef.current = false;
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
                        if (aborted()) return;
                        fullReply += (idx > 0 ? ' ' : '') + sentence;
                        setLastReply(fullReply);
                        if (idx === 0) { isSpeakingRef.current = true; setStatus('speaking'); firstSent = true; }
                        if (!aborted()) await queueTTS(sentence, L, myAbortId);
                    }
                );

                if (!firstSent && result.reply && !aborted()) {
                    setLastReply(result.reply);
                    await ttsSpeak(result.reply, L, myAbortId);
                }

                if (!aborted()) {
                    if (result.intent === 'navigate' && result.action_key) {
                        const routes = { electricity: '/bill/electricity', water: '/bill/water', gas: '/bill/gas', complaint: '/complaint', home: '/' };
                        if (routes[result.action_key]) navigate(routes[result.action_key]);
                    } else if (result.intent === 'set_screen') {
                        if (result.action_key === 'quick_pay') { setScreen('guest'); navigate('/'); }
                        else if (result.action_key === 'citizen_login') setScreen('citizen-auth');
                    } else if (result.intent === 'go_back') navigate(-1);
                }

            } catch (err) {
                log(`❌ Gemini: ${err.message}`);
                if (!aborted()) {
                    const r = getResponse('not_understood', L);
                    setLastReply(r);
                    await ttsSpeak(r, L, myAbortId);
                }
            }
        } else {
            if (!aborted()) {
                const r = getResponse('not_understood', L);
                setLastReply(r);
                await ttsSpeak(r, L, myAbortId);
            }
        }

        isSpeakingRef.current = false;
        if (isActiveRef.current && !aborted()) setStatus('listening');
        processingRef.current = false;
    }, [navigate, setScreen, log, ttsSpeak, queueTTS, cancelAllSpeech]);

    // ═══ SCREEN CHANGE → CANCEL OLD TTS + SPEAK NEW ════

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        if (screen === lastScreenRef.current) return;

        const prevScreen = lastScreenRef.current;
        lastScreenRef.current = screen;

        log(`📺 Screen: ${prevScreen} → ${screen}`);
        if (!prevScreen || screen === 'idle') return;

        // CANCEL whatever agent was saying about old page
        cancelAllSpeech();
        abortRef.current++;
        processingRef.current = false;

        const g = SCREEN_GUIDANCE[screen];
        if (g) {
            const transition = TRANSITION[langRef.current] || TRANSITION.en;
            const guidance = g[langRef.current] || g.en;
            // Use transition phrase if we were mid-speech
            const fullText = (prevScreen && prevScreen !== 'idle') ? transition + guidance : guidance;

            setTimeout(async () => {
                if (isActiveRef.current) {
                    log(`📍 Screen guidance: ${screen}`);
                    setLastReply(fullText);
                    await ttsSpeak(fullText, langRef.current);
                    if (isActiveRef.current) setStatus('listening');
                }
            }, 500);
        }
    }, [screen, voiceMode, log, ttsSpeak, cancelAllSpeech]);

    // ═══ ROUTE CHANGE → CANCEL OLD TTS + SPEAK NEW ═════

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        const currentPath = location.pathname;

        if (currentPath !== lastRouteRef.current) {
            const prevPath = lastRouteRef.current;
            lastRouteRef.current = currentPath;

            log(`📍 Route: ${prevPath} → ${currentPath}`);

            // CANCEL old speech
            cancelAllSpeech();
            abortRef.current++;
            processingRef.current = false;

            const guidance = getPageGuidance(currentPath, langRef.current);
            if (guidance) {
                // Add transition phrase if coming from another page
                const transition = prevPath ? (TRANSITION[langRef.current] || TRANSITION.en) : '';
                const fullText = transition + guidance;

                setTimeout(async () => {
                    if (isActiveRef.current) {
                        setLastReply(fullText);
                        await ttsSpeak(fullText, langRef.current);
                        if (isActiveRef.current) setStatus('listening');
                    }
                }, 400);
            }
        }
    }, [location.pathname, voiceMode, log, ttsSpeak, cancelAllSpeech]);

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
        abortRef.current = 0;
        lastRouteRef.current = window.location.pathname;
        lastScreenRef.current = screen;
        convStateRef.current = CONV_STATES.WAIT_PATH;
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
        cancelAllSpeech();
        stopSpeaking();
        clearTimeout(silenceTimerRef.current);
        clearTimeout(rePromptTimerRef.current);
        try { recognitionRef.current?.abort(); } catch { }
        log('🔴 Deactivated');
    }, [log, cancelAllSpeech]);

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
                            ? () => { cancelAllSpeech(); abortRef.current++; processingRef.current = false; setStatus('listening'); }
                            : deactivateVoice}>
                        {status === 'speaking' ? '⏭' : '✕'}
                    </button>
                </div>
            )}
        </VoiceContext.Provider>
    );
});

export default VoiceAgent;
