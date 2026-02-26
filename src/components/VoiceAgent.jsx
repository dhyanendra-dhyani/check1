/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v9 — Conversational Knowledge Base
 *
 * Uses voiceKnowledgeBase.js for guided conversation flow.
 * The agent IS the guide — asks questions, understands answers,
 * navigates, and explains what to do on each page.
 *
 * FLOW:
 *   voiceMode=true → INITIAL greeting ("Aadhaar hai?")
 *   → User answers → citizen/guest path chosen
 *   → Navigate + announce what to do
 *   → Keep listening for next command
 *   → Common Q&A answered instantly (no API)
 *   → Unknown → Gemini fallback
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useLocation } from 'react-router-dom';
import VoiceContext from './VoiceContext';
import { streamGeminiResponse, stopSpeaking, hasApiKeys } from '../utils/geminiVoiceAgent';
import {
    CONV_STATES, CITIZEN_KEYWORDS, GUEST_KEYWORDS, BILL_KEYWORDS,
    COMPLAINT_KEYWORDS, BACK_KEYWORDS, HOME_KEYWORDS, STOP_KEYWORDS,
    matchesKeywords, detectBillType, findCommonAnswer, getPageGuidance,
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

        // ── BACK ──
        if (matchesKeywords(transcript, BACK_KEYWORDS)) {
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
                convStateRef.current = CONV_STATES.BILL_PAGE;
                setScreen('guest');
                navigate(`/bill/${billType}`);
                // Guidance spoken by route-change detector
                processingRef.current = false;
                return;
            }

            // Complaint mentioned?
            if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
                log('→ Direct complaint');
                convStateRef.current = CONV_STATES.COMPLAINT;
                setScreen('guest');
                navigate('/complaint');
                processingRef.current = false;
                return;
            }
        }

        // ── GUEST_HOME / BILL_PAGE / any: nav by bill type ──
        const billType = detectBillType(transcript);
        if (billType) {
            log(`→ Bill: ${billType}`);
            convStateRef.current = CONV_STATES.BILL_PAGE;
            navigate(`/bill/${billType}`);
            processingRef.current = false;
            return;
        }

        if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
            log('→ Complaint');
            convStateRef.current = CONV_STATES.COMPLAINT;
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

    // ═══ ROUTE CHANGE → PAGE GUIDANCE ═══════════════

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        const currentPath = location.pathname;

        if (currentPath !== lastRouteRef.current) {
            const prevRoute = lastRouteRef.current;
            lastRouteRef.current = currentPath;
            if (!prevRoute) return;
            if (processingRef.current) return;

            const guidance = getPageGuidance(currentPath, langRef.current);
            if (guidance) {
                log(`📍 → ${currentPath}`);
                setLastReply(guidance);
                setTimeout(async () => {
                    if (isActiveRef.current && !processingRef.current) {
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
        }
    }, [startRecognition, log, ttsSpeak]);

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
