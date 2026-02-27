/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v10 — Smart Navigation + Citizen Redirects
 *
 * FIXES:
 *   1. Back button → speaks CURRENT page guidance (not old)
 *   2. Citizen-required features in guest mode → redirect to login
 *   3. No-response timeout → re-prompts with different wording
 *   4. Route-change ALWAYS announces current page
 *   5. Handles "naam badalna", "gas pipeline" etc. smartly
 *
 * FLOW:
 *   voiceMode=true → INITIAL greeting ("Aadhaar hai?")
 *   → 12s no response → re-prompt (different words)
 *   → answer → citizen/guest path
 *   → citizen-required feature in guest? → redirect to login
 *   → navigation → announce current page
 *   → Common Q&A instant / Gemini fallback
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
    YES_KEYWORDS,
    matchesKeywords, detectBillType,
    findCommonAnswer, getPageGuidance,
    getResponse, getInitialGreeting,
} from '../utils/voiceKnowledgeBase';

const SPEECH_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
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
    // If user doesn't speak for 12s after greeting, repeat in different words

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

            if (isActiveRef.current) {
                setStatus('listening');
                // Set another re-prompt if still waiting
                if (rePromptCountRef.current < 3) startRePromptTimer();
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

            // Cancel re-prompt timer when user speaks
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

        // ── STOP ──
        if (matchesKeywords(transcript, STOP_KEYWORDS)) {
            const r = getResponse('stopping', L);
            setLastReply(r);
            await ttsSpeak(r, L);
            deactivateVoice();
            processingRef.current = false;
            return;
        }

        // ── BACK → navigate THEN let route-change handle guidance ──
        if (matchesKeywords(transcript, BACK_KEYWORDS)) {
            log('⬅️ Back navigation');
            const backReply = L === 'hi' ? 'ठीक है, पीछे जा रहे हैं।' : 'Going back.';
            setLastReply(backReply);
            await ttsSpeak(backReply, L);
            navigate(-1);
            // Route-change effect will speak the new page guidance
            processingRef.current = false;
            if (isActiveRef.current) setStatus('listening');
            return;
        }

        // ── HOME ──
        if (matchesKeywords(transcript, HOME_KEYWORDS)) {
            navigate('/');
            // Route-change will handle guidance
            processingRef.current = false;
            return;
        }

        // ── CITIZEN-REQUIRED FEATURES (naam badalna, pipeline, etc.) ──
        // If user asks for these in guest mode, redirect to citizen login
        if (matchesKeywords(transcript, CITIZEN_REQUIRED_KEYWORDS)) {
            log('🔐 Citizen-required feature detected');

            // Pick the most specific response
            let responseKey = 'citizen_required_redirect';
            const lower = transcript.toLowerCase();
            if (lower.includes('naam') || lower.includes('name') || lower.includes('नाम')) {
                responseKey = 'citizen_required_naam';
            } else if (lower.includes('pipeline') || lower.includes('gas line') || lower.includes('पाइपलाइन') || lower.includes('गैस लाइन')) {
                responseKey = 'citizen_required_pipeline';
            } else if (lower.includes('connection') || lower.includes('naya') || lower.includes('नया') || lower.includes('कनेक्शन')) {
                responseKey = 'citizen_required_connection';
            }

            const r = getResponse(responseKey, L);
            setLastReply(r);
            await ttsSpeak(r, L);

            // Redirect to citizen auth
            convStateRef.current = CONV_STATES.CITIZEN_AUTH;
            setScreen('citizen-auth');

            if (isActiveRef.current) setStatus('listening');
            processingRef.current = false;
            return;
        }

        // ── COMMON Q&A (instant, no API) ──
        const qa = findCommonAnswer(transcript, L);
        if (qa) {
            log('📚 Common Q&A match');
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

        // ── WAIT_PATH: waiting for citizen/guest answer ──
        if (state === CONV_STATES.WAIT_PATH || state === CONV_STATES.INITIAL) {

            // Citizen path?
            if (matchesKeywords(transcript, CITIZEN_KEYWORDS)) {
                log('→ Citizen path');
                convStateRef.current = CONV_STATES.CITIZEN_AUTH;
                setScreen('citizen-auth');
                const r = getResponse('citizen_chosen', L);
                setLastReply(r);
                await ttsSpeak(r, L);
                if (isActiveRef.current) setStatus('listening');
                processingRef.current = false;
                return;
            }

            // Guest path?
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

            // Bill directly mentioned? → Guest path + navigate
            const billType = detectBillType(transcript);
            if (billType) {
                log(`→ Direct bill: ${billType}`);
                convStateRef.current = CONV_STATES.BILL_INPUT;
                setScreen('guest');
                navigate(`/bill/${billType}`);
                processingRef.current = false;
                return;
            }

            // Complaint mentioned?
            if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
                log('→ Direct complaint');
                convStateRef.current = CONV_STATES.COMPLAINT_CAT;
                setScreen('guest');
                navigate('/complaint');
                processingRef.current = false;
                return;
            }
        }

        // ── Any state: nav by bill type ──
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

        // ── FALLBACK: Try Gemini ──
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

                // Gemini navigation
                if (result.intent === 'navigate' && result.action_key) {
                    const routes = { electricity: '/bill/electricity', water: '/bill/water', gas: '/bill/gas', complaint: '/complaint', home: '/' };
                    if (routes[result.action_key]) navigate(routes[result.action_key]);
                } else if (result.intent === 'set_screen') {
                    if (result.action_key === 'quick_pay') { setScreen('guest'); navigate('/'); }
                    else if (result.action_key === 'citizen_login') setScreen('citizen-auth');
                } else if (result.intent === 'go_back') navigate(-1);

            } catch (err) {
                log(`❌ Gemini: ${err.message}`);
                const r = getResponse('not_understood', L);
                setLastReply(r);
                if (!bargedInRef.current) await ttsSpeak(r, L);
            }
        } else {
            const r = getResponse('not_understood', L);
            setLastReply(r);
            await ttsSpeak(r, L);
        }

        isSpeakingRef.current = false;
        if (isActiveRef.current && !bargedInRef.current) setStatus('listening');
        processingRef.current = false;
    }, [navigate, setScreen, log, ttsSpeak, queueTTS]);

    // ═══ ROUTE CHANGE → PAGE GUIDANCE (ALWAYS) ═══════

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        const currentPath = location.pathname;

        if (currentPath !== lastRouteRef.current) {
            lastRouteRef.current = currentPath;

            // ALWAYS speak guidance for the new page
            const guidance = getPageGuidance(currentPath, langRef.current);
            if (guidance) {
                log(`📍 → ${currentPath}`);
                setLastReply(guidance);

                // Small delay for page render, then speak
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
        convStateRef.current = CONV_STATES.WAIT_PATH;
        log('🟢 Activated');

        // Initial greeting: the Aadhaar question
        const greeting = getInitialGreeting(langRef.current);
        setLastReply(greeting);
        setStatus('speaking');
        await ttsSpeak(greeting, langRef.current);

        if (isActiveRef.current) {
            log('📢 Greeting done → listening');
            setStatus('listening');
            startRecognition();
            // Start re-prompt timer
            startRePromptTimer();
        }
    }, [startRecognition, startRePromptTimer, log, ttsSpeak]);

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

    // Auto-activate on voice mode + screen change
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

            {/* Voice Status Bar */}
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
