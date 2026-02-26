/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v5 — Intelligent Barge-In Voice Controller
 *
 * SINGLE voice source for the entire app. All other voice
 * inputs removed. This is the ONLY listening mechanism.
 *
 * Architecture:
 *   • Web Speech API with continuous=true for barge-in
 *   • Recognition runs EVEN while TTS plays → user can interrupt
 *   • When user speaks during TTS → TTS cancelled → listen
 *   • Gemini 2.5 Flash for ALL intelligent responses
 *   • Fast keyword shortcuts for instant navigation (0ms)
 *   • Conversation history for multi-turn context
 *   • Auto-restart after every exchange (never stops)
 *
 * Like talking to a real person:
 *   Agent speaks → user interrupts → agent stops & listens
 *   User pauses → agent responds → keeps listening
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import VoiceContext from './VoiceContext';
import { sendTextToGemini, stopSpeaking } from '../utils/geminiVoiceAgent';

// ── Speech lang codes ────────────────────────────────
const SPEECH_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
};

// ── TTS lang codes ───────────────────────────────────
const TTS_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
};

// ── Quick nav keywords (instant, no API call) ────────
const NAV_KEYWORDS = {
    electricity: { words: ['bijli', 'electricity', 'electric', 'बिजली', 'ਬਿਜਲੀ', 'light'], route: '/bill/electricity' },
    water: { words: ['paani', 'water', 'jal', 'पानी', 'ਪਾਣੀ', 'pani'], route: '/bill/water' },
    gas: { words: ['gas', 'गैस', 'ਗੈਸ', 'lpg'], route: '/bill/gas' },
    property: { words: ['property', 'tax', 'ghar', 'प्रॉपर्टी', 'ਜਾਇਦਾਦ'], route: '/bill/electricity' },
    complaint: { words: ['complaint', 'shikayat', 'शिकायत', 'ਸ਼ਿਕਾਇਤ', 'problem'], route: '/complaint' },
    home: { words: ['home', 'ghar', 'shuru', 'होम', 'ਹੋਮ', 'main page'], route: '/' },
    back: { words: ['back', 'peeche', 'wapas', 'पीछे', 'ਪਿੱਛੇ'], route: '__BACK__' },
};

function detectQuickNav(text) {
    const lower = text.toLowerCase();
    for (const [key, { words, route }] of Object.entries(NAV_KEYWORDS)) {
        if (words.some(w => lower.includes(w))) return { key, route };
    }
    return null;
}

function isStopCommand(text) {
    const stops = ['stop', 'band', 'ruko', 'bas', 'बंद', 'रुको', 'ਬੰਦ', 'ਰੁਕੋ', 'chup'];
    return stops.some(s => text.toLowerCase().includes(s));
}

// ── Barge-in TTS with interrupt detection ────────────
function smartSpeak(text, lang = 'en') {
    return new Promise((resolve) => {
        if (!window.speechSynthesis || !text) { resolve(); return; }
        window.speechSynthesis.cancel();

        const u = new SpeechSynthesisUtterance(text);
        u.lang = TTS_LANGS[lang] || 'en-IN';
        u.rate = 1.05; // Slightly faster for naturalness
        u.pitch = 1;
        u.volume = 1;

        const voices = window.speechSynthesis.getVoices();
        const v = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang.startsWith(lang));
        if (v) u.voice = v;

        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
    });
}

// ═════════════════════════════════════════════════════
// ═══ MAIN COMPONENT ═════════════════════════════════
// ═════════════════════════════════════════════════════

const VoiceAgent = memo(function VoiceAgent({
    lang, setLang, screen, setScreen,
    navigate, setCitizen, addLog, children,
}) {
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState('idle');
    const [lastTranscript, setLastTranscript] = useState('');
    const [lastReply, setLastReply] = useState('');
    const [interimText, setInterimText] = useState('');

    // Refs for real-time state access in callbacks
    const isActiveRef = useRef(false);
    const isSpeakingRef = useRef(false);
    const recognitionRef = useRef(null);
    const langRef = useRef(lang);
    const screenRef = useRef(screen);
    const processingRef = useRef(false);
    const silenceTimerRef = useRef(null);

    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { screenRef.current = screen; }, [screen]);

    // ── CORE: Start continuous recognition ─────────
    const startRecognition = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { addLog?.('Voice: not supported'); return; }

        // Kill existing
        try { recognitionRef.current?.abort(); } catch { }

        const r = new SR();
        r.lang = SPEECH_LANGS[langRef.current] || 'hi-IN';
        r.continuous = true;       // NEVER stops — key for barge-in
        r.interimResults = true;   // Real-time transcription
        r.maxAlternatives = 1;

        r.onresult = (e) => {
            const lastResult = e.results[e.results.length - 1];

            // ── BARGE-IN: User spoke while agent is speaking ──
            if (isSpeakingRef.current) {
                // User is interrupting — stop TTS immediately
                window.speechSynthesis.cancel();
                isSpeakingRef.current = false;
                setStatus('listening');
                addLog?.('🔇 Barge-in: user interrupted');
            }

            if (lastResult.isFinal) {
                const transcript = lastResult[0].transcript.trim();
                if (transcript.length > 1) {
                    setInterimText('');
                    clearTimeout(silenceTimerRef.current);
                    handleFinalTranscript(transcript);
                }
            } else {
                // Show interim text for responsiveness
                setInterimText(lastResult[0].transcript);
                setStatus('listening');

                // Debounce: wait 1.5s of silence after last interim before considering done
                clearTimeout(silenceTimerRef.current);
            }
        };

        r.onerror = (e) => {
            if (e.error === 'no-speech' || e.error === 'aborted') {
                // Normal — restart silently
                if (isActiveRef.current) setTimeout(() => startRecognition(), 300);
                return;
            }
            addLog?.(`Voice error: ${e.error}`);
            // Try restart
            if (isActiveRef.current) setTimeout(() => startRecognition(), 1000);
        };

        r.onend = () => {
            // Chrome kills continuous recognition sometimes — restart
            if (isActiveRef.current) {
                setTimeout(() => startRecognition(), 200);
            }
        };

        recognitionRef.current = r;
        try { r.start(); } catch { }
        if (!isSpeakingRef.current) setStatus('listening');
    }, [addLog]);

    // ── Process final transcript ──────────────────
    const handleFinalTranscript = useCallback(async (transcript) => {
        if (processingRef.current) return;
        processingRef.current = true;

        setLastTranscript(transcript);
        setStatus('processing');
        addLog?.(`🎤 "${transcript}"`);

        // Check stop command
        if (isStopCommand(transcript)) {
            await respondAndListen(
                langRef.current === 'hi'
                    ? 'ठीक है, बंद कर रहा हूँ। जब चाहें माइक दबाएं।'
                    : 'Okay, stopping. Tap the mic when ready.',
                true // shouldStop
            );
            processingRef.current = false;
            return;
        }

        // Check quick navigation (0ms)
        const nav = detectQuickNav(transcript);

        // ALWAYS send to Gemini for intelligent response
        // But if nav detected, also navigate
        try {
            const gemini = await sendTextToGemini(
                transcript,
                langRef.current,
                `${screenRef.current} | path: ${window.location.pathname}`
            );

            if (gemini.language && gemini.language !== langRef.current) {
                // Count detections for auto-switch
                // (Gemini detects language automatically)
            }

            const reply = gemini.reply || '';

            // Execute navigation
            if (nav) {
                if (nav.route === '__BACK__') {
                    navigate(-1);
                } else {
                    navigate(nav.route);
                }
                addLog?.(`📍 Nav → ${nav.route}`);
            } else if (gemini.intent === 'navigate' && gemini.action_key) {
                // Gemini also detected navigation
                const routes = {
                    'electricity': '/bill/electricity', 'water': '/bill/water',
                    'gas': '/bill/gas', 'complaint': '/complaint',
                    'quick_pay': '__GUEST__', 'citizen_login': '__CITIZEN__',
                    'go_back': '__BACK__',
                };
                const r = routes[gemini.action_key];
                if (r === '__GUEST__') { setScreen('guest'); navigate('/'); }
                else if (r === '__CITIZEN__') { setScreen('citizen-auth'); }
                else if (r === '__BACK__') { navigate(-1); }
                else if (r) { navigate(r); }
                addLog?.(`📍 Gemini nav → ${gemini.action_key}`);
            } else if (gemini.intent === 'set_screen') {
                if (gemini.action_key === 'quick_pay') { setScreen('guest'); navigate('/'); }
                else if (gemini.action_key === 'citizen_login') { setScreen('citizen-auth'); }
            }

            // Speak response (recognition stays running for barge-in)
            await respondAndListen(reply, false);
        } catch (err) {
            console.error('Gemini error:', err);
            // Fallback response
            await respondAndListen(
                langRef.current === 'hi'
                    ? 'माफ़ कीजिए, कृपया फिर से बोलें।'
                    : 'Sorry, please try again.',
                false
            );
        }

        processingRef.current = false;
    }, [navigate, setScreen, addLog]);

    // ── Speak response while keeping recognition alive ──
    const respondAndListen = useCallback(async (text, shouldStop = false) => {
        if (!text) { setStatus('listening'); return; }

        setLastReply(text);
        setStatus('speaking');
        isSpeakingRef.current = true;

        // Speak — recognition is STILL running (barge-in ready)
        await smartSpeak(text, langRef.current);

        isSpeakingRef.current = false;

        if (shouldStop) {
            deactivateVoice();
        } else if (isActiveRef.current) {
            setStatus('listening');
        }
    }, []);

    // ── ACTIVATE ──────────────────────────────────
    const activateVoice = useCallback(() => {
        if (isActiveRef.current) return;
        isActiveRef.current = true;
        setIsActive(true);
        setLastTranscript('');
        setLastReply('');
        setInterimText('');
        stopSpeaking();
        addLog?.('🟢 Voice agent ON');

        // Start recognition FIRST (barge-in ready from the start)
        startRecognition();

        // Then greet
        const greetings = {
            gateway: {
                hi: 'नमस्ते! बताइए, आपका अपना बिल है या किसी रिश्तेदार का?',
                en: 'Hello! Tell me, is the bill in your name or a relative\'s?',
                pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਦੱਸੋ, ਬਿੱਲ ਤੁਹਾਡਾ ਹੈ ਜਾਂ ਕਿਸੇ ਦਾ?',
            },
            guest: {
                hi: 'बोलिए, क्या करना है? बिजली, पानी, गैस का बिल या शिकायत?',
                en: 'What would you like to do? Electricity, water, gas bill or complaint?',
                pa: 'ਦੱਸੋ, ਕੀ ਕਰਨਾ ਹੈ? ਬਿਜਲੀ, ਪਾਣੀ, ਗੈਸ ਜਾਂ ਸ਼ਿਕਾਇਤ?',
            },
            'citizen-dashboard': {
                hi: 'बोलिए, क्या करना है?',
                en: 'What would you like to do?',
                pa: 'ਦੱਸੋ ਕੀ ਕਰਨਾ ਹੈ?',
            },
        };
        const g = greetings[screenRef.current] || greetings.guest;
        const text = g[langRef.current] || g.en;
        respondAndListen(text, false);
    }, [startRecognition, respondAndListen, addLog]);

    // ── DEACTIVATE ────────────────────────────────
    const deactivateVoice = useCallback(() => {
        isActiveRef.current = false;
        setIsActive(false);
        setStatus('idle');
        setInterimText('');
        isSpeakingRef.current = false;
        processingRef.current = false;
        stopSpeaking();
        clearTimeout(silenceTimerRef.current);
        try { recognitionRef.current?.abort(); } catch { }
        addLog?.('🔴 Voice agent OFF');
    }, [addLog]);

    // Cleanup
    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            try { recognitionRef.current?.abort(); } catch { }
            stopSpeaking();
        };
    }, []);

    const contextValue = {
        isActive, status, activate: activateVoice,
        deactivate: deactivateVoice, lastTranscript, lastReply,
    };

    return (
        <VoiceContext.Provider value={contextValue}>
            {children}

            {/* ═══ VOICE STATUS UI ═══════════════════════ */}
            {isActive && (
                <div className={`vo-bar vo-bar-${status}`}>
                    {/* Left: Status indicator */}
                    <div className="vo-bar-left">
                        {status === 'listening' && (
                            <>
                                <div className="vo-pulse" />
                                <span className="vo-bar-label">
                                    {interimText
                                        ? `"${interimText}"`
                                        : (lang === 'hi' ? 'बोलिए...' : 'Speak...')}
                                </span>
                            </>
                        )}
                        {status === 'processing' && (
                            <>
                                <div className="vo-spinner" />
                                <span className="vo-bar-label">
                                    {lang === 'hi' ? 'समझ रहा हूँ...' : 'Thinking...'}
                                </span>
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
                                    {lastReply?.substring(0, 70)}{lastReply?.length > 70 ? '...' : ''}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Right: Stop button */}
                    <button
                        className="vo-bar-close"
                        onClick={status === 'speaking'
                            ? () => { stopSpeaking(); isSpeakingRef.current = false; setStatus('listening'); }
                            : deactivateVoice
                        }
                    >
                        {status === 'speaking' ? '⏭' : '✕'}
                    </button>
                </div>
            )}
        </VoiceContext.Provider>
    );
});

export default VoiceAgent;
