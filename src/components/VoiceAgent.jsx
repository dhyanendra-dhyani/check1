/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v7 — Clean Single System
 *
 * ONLY active when voiceMode=true (set at IdleScreen).
 * ALL voice logic lives here — no other file does speech.
 *
 * Features:
 *   • Continuous recognition (barge-in ready)
 *   • Gemini streaming for intelligent responses
 *   • TTS with interrupt detection
 *   • Keyword nav shortcuts (0ms)
 *   • Screen-aware context
 *   • Always listening when active
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import VoiceContext from './VoiceContext';
import { streamGeminiResponse, stopSpeaking, speakText } from '../utils/geminiVoiceAgent';

const SPEECH_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
};

const TTS_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
};

// Quick nav keywords — instant, no API call
const NAV_KEYWORDS = {
    electricity: { words: ['bijli', 'electricity', 'electric', 'बिजली', 'ਬਿਜਲੀ', 'light', 'bijlee', 'lite'], route: '/bill/electricity' },
    water: { words: ['paani', 'water', 'jal', 'पानी', 'ਪਾਣੀ', 'pani'], route: '/bill/water' },
    gas: { words: ['gas', 'गैस', 'ਗੈਸ', 'lpg', 'cylinder'], route: '/bill/gas' },
    complaint: { words: ['complaint', 'shikayat', 'शिकायत', 'ਸ਼ਿਕਾਇਤ', 'problem', 'samasya', 'समस्या'], route: '/complaint' },
    home: { words: ['home', 'ghar', 'shuru', 'होम', 'ਹੋਮ', 'main'], route: '/' },
    back: { words: ['back', 'peeche', 'wapas', 'पीछे', 'ਪਿੱਛੇ'], route: '__BACK__' },
};

function detectNav(text) {
    const lower = text.toLowerCase();
    for (const [, { words, route }] of Object.entries(NAV_KEYWORDS))
        if (words.some(w => lower.includes(w))) return route;
    return null;
}

function isStopCmd(text) {
    return ['stop', 'band karo', 'ruko', 'बंद', 'रुको', 'ਬੰਦ', 'chup', 'bye', 'touch']
        .some(s => text.toLowerCase().includes(s));
}

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

    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { screenRef.current = screen; }, [screen]);

    // ── Start continuous recognition ────────────────
    const startRecognition = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;
        try { recognitionRef.current?.abort(); } catch { }

        const r = new SR();
        r.lang = SPEECH_LANGS[langRef.current] || 'hi-IN';
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 1;

        r.onresult = (e) => {
            const last = e.results[e.results.length - 1];

            // BARGE-IN: user speaking while TTS → cancel TTS
            if (isSpeakingRef.current) {
                window.speechSynthesis.cancel();
                isSpeakingRef.current = false;
                bargedInRef.current = true;
                setStatus('listening');
                addLog?.('🔇 Barge-in');
            }

            if (last.isFinal) {
                const t = last[0].transcript.trim();
                lastInterimRef.current = t;
                setInterimText('');
                clearTimeout(silenceTimerRef.current);
                if (t.length > 1 && !processingRef.current) handleTranscript(t);
            } else {
                const interim = last[0].transcript;
                lastInterimRef.current = interim;
                setInterimText(interim);
                if (!isSpeakingRef.current) setStatus('listening');

                // Silence timer fallback — 1.2s of no change = process
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    const t = lastInterimRef.current?.trim();
                    if (t && t.length > 1 && !processingRef.current) handleTranscript(t);
                }, 1200);
            }
        };

        r.onerror = (e) => {
            if (['no-speech', 'aborted'].includes(e.error)) {
                if (isActiveRef.current) setTimeout(() => startRecognition(), 300);
                return;
            }
            if (isActiveRef.current) setTimeout(() => startRecognition(), 1000);
        };

        r.onend = () => {
            if (isActiveRef.current) setTimeout(() => startRecognition(), 200);
        };

        recognitionRef.current = r;
        try { r.start(); } catch { }
        if (!isSpeakingRef.current) setStatus('listening');
    }, [addLog]);

    // ── Process user speech ─────────────────────────
    const handleTranscript = useCallback(async (transcript) => {
        if (processingRef.current) return;
        processingRef.current = true;
        bargedInRef.current = false;

        setLastTranscript(transcript);
        setInterimText('');
        lastInterimRef.current = '';
        setStatus('processing');
        addLog?.(`🎤 "${transcript}"`);

        // Stop command?
        if (isStopCmd(transcript)) {
            await speak('ठीक है, बंद कर रहा हूँ।', langRef.current);
            deactivateVoice();
            processingRef.current = false;
            return;
        }

        // Nav shortcut
        const navRoute = detectNav(transcript);

        try {
            let fullReply = '';
            let firstSent = false;

            const result = await streamGeminiResponse(
                transcript,
                langRef.current,
                `${screenRef.current} | ${window.location.pathname}`,
                async (sentence, idx) => {
                    if (bargedInRef.current) return;
                    fullReply += (idx > 0 ? ' ' : '') + sentence;
                    setLastReply(fullReply);

                    if (idx === 0) {
                        setStatus('speaking');
                        isSpeakingRef.current = true;
                        firstSent = true;
                        if (navRoute) execNav(navRoute);
                    }

                    if (!bargedInRef.current) await queueTTS(sentence, langRef.current);
                }
            );

            // Fallback if streaming didn't fire TTS
            if (!firstSent && result.reply && !bargedInRef.current) {
                setLastReply(result.reply);
                setStatus('speaking');
                isSpeakingRef.current = true;
                await queueTTS(result.reply, langRef.current);
            }

            // Gemini navigation
            if (!navRoute && result.intent === 'navigate' && result.action_key) {
                const routes = { electricity: '/bill/electricity', water: '/bill/water', gas: '/bill/gas', complaint: '/complaint' };
                if (routes[result.action_key]) execNav(routes[result.action_key]);
            } else if (result.intent === 'set_screen') {
                if (result.action_key === 'quick_pay') { setScreen('guest'); navigate('/'); }
                else if (result.action_key === 'citizen_login') setScreen('citizen-auth');
            } else if (result.intent === 'go_back') navigate(-1);
            else if (navRoute && !firstSent) execNav(navRoute);
        } catch (err) {
            console.error('Voice pipeline error:', err);
            if (!bargedInRef.current) await speak('माफ़ कीजिए, फिर से बोलें।', langRef.current);
        }

        isSpeakingRef.current = false;
        if (isActiveRef.current && !bargedInRef.current) setStatus('listening');
        processingRef.current = false;
    }, [navigate, setScreen, addLog]);

    const execNav = useCallback((route) => {
        if (route === '__BACK__') navigate(-1);
        else navigate(route);
        addLog?.(`📍 → ${route}`);
    }, [navigate, addLog]);

    const queueTTS = useCallback((text, lang) => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis || !text || bargedInRef.current) { resolve(); return; }
            const u = new SpeechSynthesisUtterance(text);
            u.lang = TTS_LANGS[lang] || 'en-IN';
            u.rate = 1.05;
            u.pitch = 1;
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang.startsWith(lang));
            if (v) u.voice = v;
            u.onend = () => resolve();
            u.onerror = () => resolve();
            window.speechSynthesis.speak(u);
        });
    }, []);

    const speak = useCallback(async (text, lang) => {
        setLastReply(text);
        setStatus('speaking');
        isSpeakingRef.current = true;
        await speakText(text, lang);
        isSpeakingRef.current = false;
    }, []);

    // ── ACTIVATE ─────────────────────────────────────
    const activateVoice = useCallback(() => {
        if (isActiveRef.current) return;
        isActiveRef.current = true;
        setIsActive(true);
        setLastTranscript('');
        setLastReply('');
        setInterimText('');
        stopSpeaking();
        addLog?.('🟢 Voice ON');
        startRecognition();

        // Screen-specific greeting
        const greetings = {
            gateway: { hi: 'भाषा चुनें और बताइए — गेस्ट हैं या सिटीज़न?', en: 'Choose language and tell me — guest or citizen?' },
            guest: { hi: 'बोलिए, कौन सा बिल भरना है?', en: 'Which bill would you like to pay?' },
            'citizen-dashboard': { hi: 'बोलिए, क्या करना है?', en: 'What would you like to do?' },
        };
        const g = greetings[screenRef.current] || greetings.guest;
        const text = g[langRef.current] || g.en;
        speak(text, langRef.current).then(() => {
            if (isActiveRef.current) setStatus('listening');
        });
    }, [startRecognition, addLog, speak]);

    // ── DEACTIVATE ───────────────────────────────────
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
        addLog?.('🔴 Voice OFF');
    }, [addLog]);

    // Auto-activate when voiceMode is on and screen changes
    useEffect(() => {
        if (voiceMode && !isActiveRef.current && screen !== 'idle') {
            activateVoice();
        }
    }, [voiceMode, screen, activateVoice]);

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

            {/* ═══ VOICE STATUS BAR ═══════════════════════ */}
            {isActive && (
                <div className={`vo-bar vo-bar-${status}`}>
                    <div className="vo-bar-left">
                        {status === 'listening' && (
                            <>
                                <div className="vo-pulse" />
                                <span className="vo-bar-label">
                                    {interimText ? `"${interimText}"` : (lang === 'hi' ? 'बोलिए...' : 'Speak...')}
                                </span>
                            </>
                        )}
                        {status === 'processing' && (
                            <>
                                <div className="vo-spinner" />
                                <span className="vo-bar-label">{lang === 'hi' ? 'समझ रहा हूँ...' : 'Thinking...'}</span>
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
                                    {lastReply?.substring(0, 80)}{lastReply?.length > 80 ? '...' : ''}
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
