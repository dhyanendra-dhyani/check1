/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v11 — Screen-Change Detection + Auth Guidance
 *
 * CRITICAL FIX: App uses TWO navigation systems:
 *   1. React Router (URL: /bill/electricity, /complaint, /)
 *   2. Screen state (screen: idle, gateway, guest, citizen-auth)
 *
 * Previous versions only watched URL changes. This version
 * watches BOTH URL and screen state changes.
 *
 * ALSO FIXED:
 *   - Detailed auth page guidance (thumb/iris/OTP step-by-step)
 *   - "maph kijiye" loop → better fallback with clearer options
 *   - Back button → proper page announcement
 *   - Re-prompt only on WAIT_PATH state
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

// ── SCREEN-SPECIFIC GUIDANCE (for non-URL transitions) ──
const SCREEN_GUIDANCE = {
    'citizen-auth': {
        hi: 'ठीक है, लॉगिन पेज आ गया। आपके सामने तीन बटन हैं। पहला — अंगूठा लगाइए, बायोमेट्रिक मशीन पर दाईं तरफ अपना अंगूठा रखें। दूसरा — आँख स्कैन, कैमरे में देखें। तीसरा — OTP, मोबाइल पर कोड आएगा। सबसे आसान अंगूठा है — बस लगाइए, 2-3 सेकंड में हो जाएगा। या बोलें "अंगूठा", "आँख", या "OTP"।',
        en: 'Login page is ready. Three buttons: First — Thumbprint, place your thumb on the biometric scanner on the right. Second — Iris scan, look at the camera. Third — OTP, you\'ll receive a code on your phone. Thumbprint is easiest — just 2-3 seconds. Say "thumb", "iris", or "OTP".',
    },
    'citizen-dashboard': {
        hi: 'आपका डैशबोर्ड खुल गया है! यहाँ तीन सेक्शन हैं — ऊपर आपके बकाया बिल, बीच में आपकी शिकायतें, और नीचे अतिरिक्त सेवाएं जैसे नया कनेक्शन, नाम बदलाव। बोलें क्या करना है?',
        en: 'Dashboard is open! Three sections — pending bills at top, your complaints in middle, extra services below. What would you like to do?',
    },
    guest: {
        hi: 'ठीक है! बिना लॉगिन के सारे काम हो जाएँगे। बताइए कौन सा बिल भरना है — बिजली, पानी, या गैस? शिकायत भी दर्ज कर सकते हैं।',
        en: 'No login needed! Which bill — electricity, water, or gas? You can also file a complaint.',
    },
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

    // ═══ RE-PROMPT TIMER ═════════════════════════════

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

            // BARGE-IN
            if (isSpeakingRef.current) {
                log('🔇 Barge-in!');
                window.speechSynthesis.cancel();
                isSpeakingRef.current = false;
                bargedInRef.current = true;
                setStatus('listening');
            }

            clearTimeout(rePromptTimerRef.current);

            if (last.isFinal) {
                const t = last[0].transcript.trim();
                log(`📝 "${t}"`);
                lastInterimRef.current = '';
                setInterimText('');
                clearTimeout(silenceTimerRef.current);
                if (t.length > 1 && !processingRef.current) handleTranscript(t);
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
    }, [log]);

    // ═══ SPEAK SCREEN GUIDANCE (helper) ═══════════════

    const speakScreenGuidance = useCallback(async (screenName) => {
        const g = SCREEN_GUIDANCE[screenName];
        if (!g) return;
        const text = g[langRef.current] || g.en;
        log(`📍 Screen → ${screenName}: speaking guidance`);
        setLastReply(text);
        await ttsSpeak(text, langRef.current);
        if (isActiveRef.current) setStatus('listening');
    }, [log, ttsSpeak]);

    // ═══ KNOWLEDGE-BASE PROCESSING ═══════════════════

    const handleTranscript = useCallback(async (transcript) => {
        if (processingRef.current) return;
        processingRef.current = true;
        bargedInRef.current = false;
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
            processingRef.current = false;
            return;
        }

        // ── BACK ──
        if (matchesKeywords(transcript, BACK_KEYWORDS)) {
            log('⬅️ Back');
            const reply = L === 'hi' ? 'ठीक है, पीछे जा रहे हैं।' : 'Going back.';
            setLastReply(reply);
            await ttsSpeak(reply, L);
            navigate(-1);
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

        // ── AUTH ACTIONS: thumb/iris/OTP on citizen-auth screen ──
        if (screenRef.current === 'citizen-auth') {
            if (lower.includes('angootha') || lower.includes('thumb') || lower.includes('finger') || lower.includes('अंगूठा') || lower.includes('ungali')) {
                log('👆 Thumb auth requested');
                const r = L === 'hi'
                    ? 'ठीक है, अंगूठा लगाइए — दाईं तरफ बायोमेट्रिक मशीन पर अपना अंगूठा रखें। 2-3 सेकंड में स्कैन हो जाएगा। नीचे "Thumb" बटन दबाएं।'
                    : 'Place your thumb on the biometric scanner on the right. It\'ll scan in 2-3 seconds. Press the "Thumb" button below.';
                setLastReply(r);
                await ttsSpeak(r, L);
                if (isActiveRef.current) setStatus('listening');
                processingRef.current = false;
                return;
            }
            if (lower.includes('aankh') || lower.includes('iris') || lower.includes('eye') || lower.includes('आँख') || lower.includes('ankh')) {
                log('👁️ Iris auth requested');
                const r = L === 'hi'
                    ? 'ठीक है, आँख स्कैन — कैमरे की तरफ देखें, अपनी आँख खुली रखें। 2-3 सेकंड में हो जाएगा। नीचे "Iris" बटन दबाएं।'
                    : 'Look at the camera with your eye open. It\'ll scan in 2-3 seconds. Press the "Iris" button below.';
                setLastReply(r);
                await ttsSpeak(r, L);
                if (isActiveRef.current) setStatus('listening');
                processingRef.current = false;
                return;
            }
            if (lower.includes('otp') || lower.includes('mobile') || lower.includes('code') || lower.includes('ओटीपी') || lower.includes('मोबाइल')) {
                log('📱 OTP auth requested');
                const r = L === 'hi'
                    ? 'ठीक है, OTP वाला तरीका। पहले नीचे "OTP" बटन दबाएं। फिर अपना आधार से जुड़ा मोबाइल नंबर डालें। OTP आएगा, वो डालें और लॉगिन हो जाएगा। डेमो OTP है 482916।'
                    : 'OTP method. Press "OTP" button below. Enter your Aadhaar-linked mobile number. You\'ll get an OTP. Demo OTP is 482916.';
                setLastReply(r);
                await ttsSpeak(r, L);
                if (isActiveRef.current) setStatus('listening');
                processingRef.current = false;
                return;
            }
        }

        // ── CITIZEN-REQUIRED FEATURES (naam badalna, pipeline, etc.) ──
        if (matchesKeywords(transcript, CITIZEN_REQUIRED_KEYWORDS)) {
            log('🔐 Citizen-required feature');
            let responseKey = 'citizen_required_redirect';
            if (lower.includes('naam') || lower.includes('name') || lower.includes('नाम')) responseKey = 'citizen_required_naam';
            else if (lower.includes('pipeline') || lower.includes('gas line') || lower.includes('पाइपलाइन')) responseKey = 'citizen_required_pipeline';
            else if (lower.includes('connection') || lower.includes('naya') || lower.includes('नया')) responseKey = 'citizen_required_connection';

            const r = getResponse(responseKey, L);
            setLastReply(r);
            await ttsSpeak(r, L);
            convStateRef.current = CONV_STATES.CITIZEN_AUTH;
            setScreen('citizen-auth');
            // Screen-change detector will speak auth guidance after
            processingRef.current = false;
            return;
        }

        // ── COMMON Q&A (instant, no API) ──
        const qa = findCommonAnswer(transcript, L);
        if (qa) {
            log('📚 Q&A match');
            setLastReply(qa);
            await ttsSpeak(qa, L);
            if (isActiveRef.current) setStatus('listening');
            processingRef.current = false;
            return;
        }

        // ══════════════════════════════════════════════
        // STATE MACHINE
        // ══════════════════════════════════════════════

        const state = convStateRef.current;

        // ── WAIT_PATH: citizen/guest answer ──
        if (state === CONV_STATES.WAIT_PATH || state === CONV_STATES.INITIAL) {

            if (matchesKeywords(transcript, CITIZEN_KEYWORDS)) {
                log('→ Citizen path');
                convStateRef.current = CONV_STATES.CITIZEN_AUTH;
                const r = getResponse('citizen_chosen', L);
                setLastReply(r);
                await ttsSpeak(r, L);
                // NOW switch screen — screen-change detector will add auth guidance
                setScreen('citizen-auth');
                processingRef.current = false;
                return;
            }

            if (matchesKeywords(transcript, GUEST_KEYWORDS)) {
                log('→ Guest path');
                convStateRef.current = CONV_STATES.GUEST_HOME;
                setScreen('guest');
                navigate('/');
                const r = getResponse('guest_chosen', L);
                setLastReply(r);
                await ttsSpeak(r, L);
                if (isActiveRef.current) setStatus('listening');
                processingRef.current = false;
                return;
            }

            // Bill directly
            const billType = detectBillType(transcript);
            if (billType) {
                log(`→ Direct bill: ${billType}`);
                convStateRef.current = CONV_STATES.BILL_INPUT;
                setScreen('guest');
                navigate(`/bill/${billType}`);
                processingRef.current = false;
                return;
            }

            // Complaint
            if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
                log('→ Direct complaint');
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
            const r = getResponse('not_understood', L);
            setLastReply(r);
            await ttsSpeak(r, L);
        }

        isSpeakingRef.current = false;
        if (isActiveRef.current && !bargedInRef.current) setStatus('listening');
        processingRef.current = false;
    }, [navigate, setScreen, log, ttsSpeak, queueTTS, speakScreenGuidance]);

    // ═══ SCREEN CHANGE DETECTION (gateway → auth, etc.) ═══

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        if (screen === lastScreenRef.current) return;

        const prevScreen = lastScreenRef.current;
        lastScreenRef.current = screen;

        log(`📺 Screen: ${prevScreen} → ${screen}`);

        // Don't speak on initial load or on idle
        if (!prevScreen || screen === 'idle') return;

        const g = SCREEN_GUIDANCE[screen];
        if (g) {
            const text = g[langRef.current] || g.en;
            // Delay slightly to let the page render and previous TTS finish
            setTimeout(async () => {
                if (isActiveRef.current && !isSpeakingRef.current) {
                    log(`📍 Screen guidance: ${screen}`);
                    setLastReply(text);
                    await ttsSpeak(text, langRef.current);
                    if (isActiveRef.current) setStatus('listening');
                }
            }, 1200);
        }
    }, [screen, voiceMode, log, ttsSpeak]);

    // ═══ ROUTE CHANGE (URL: /bill/*, /complaint, /) ═══

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        const currentPath = location.pathname;

        if (currentPath !== lastRouteRef.current) {
            lastRouteRef.current = currentPath;

            const guidance = getPageGuidance(currentPath, langRef.current);
            if (guidance) {
                log(`📍 Route → ${currentPath}`);
                setLastReply(guidance);
                setTimeout(async () => {
                    if (isActiveRef.current && !isSpeakingRef.current) {
                        await ttsSpeak(guidance, langRef.current);
                        if (isActiveRef.current) setStatus('listening');
                    }
                }, 600);
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
        stopSpeaking();
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
                            ? () => { stopSpeaking(); isSpeakingRef.current = false; bargedInRef.current = true; setStatus('listening'); }
                            : deactivateVoice}>
                        {status === 'speaking' ? '⏭' : '✕'}
                    </button>
                </div>
            )}
        </VoiceContext.Provider>
    );
});

export default VoiceAgent;
