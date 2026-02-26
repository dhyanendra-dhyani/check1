/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v6 — Full Pipeline: VAD + Streaming + Barge-in
 *
 * 4 KEY UPGRADES:
 *   1. VAD (@ricky0123/vad-web) — instant end-of-speech detection
 *   2. Barge-in — user interrupts agent → agent stops immediately
 *   3. Gemini Streaming — TTS starts on first sentence
 *   4. Parallel pipeline — STT, LLM, TTS all overlap
 *
 * Flow:
 *   [MIC] → VAD detects speech → Web Speech API transcribes
 *   → VAD detects silence → INSTANTLY send to Gemini (streaming)
 *   → First sentence arrives → START TTS immediately
 *   → More sentences arrive → QUEUE TTS
 *   → User speaks during TTS → BARGE-IN → cancel TTS, listen
 *   → Repeat forever until stopped
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import VoiceContext from './VoiceContext';
import { streamGeminiResponse, stopSpeaking, speakText } from '../utils/geminiVoiceAgent';

// ── Speech codes ─────────────────────────────────────
const SPEECH_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
};

const TTS_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
};

// ── Quick nav keywords (instant, 0ms) ────────────────
const NAV_KEYWORDS = {
    electricity: { words: ['bijli', 'electricity', 'electric', 'बिजली', 'ਬਿਜਲੀ', 'light', 'bijlee'], route: '/bill/electricity' },
    water: { words: ['paani', 'water', 'jal', 'पानी', 'ਪਾਣੀ', 'pani'], route: '/bill/water' },
    gas: { words: ['gas', 'गैस', 'ਗੈਸ', 'lpg', 'cylinder'], route: '/bill/gas' },
    property: { words: ['property', 'tax', 'प्रॉपर्टी', 'ਜਾਇਦਾਦ', 'sampatti'], route: '/bill/electricity' },
    complaint: { words: ['complaint', 'shikayat', 'शिकायत', 'ਸ਼ਿਕਾਇਤ', 'problem', 'samasya'], route: '/complaint' },
    home: { words: ['home', 'ghar', 'shuru', 'होम', 'ਹੋਮ', 'main'], route: '/' },
    back: { words: ['back', 'peeche', 'wapas', 'पीछे', 'ਪਿੱਛੇ'], route: '__BACK__' },
};

function detectQuickNav(text) {
    const lower = text.toLowerCase();
    for (const [, { words, route }] of Object.entries(NAV_KEYWORDS))
        if (words.some(w => lower.includes(w))) return route;
    return null;
}

function isStopCommand(text) {
    return ['stop', 'band', 'ruko', 'bas', 'बंद', 'रुको', 'ਬੰਦ', 'chup', 'bye']
        .some(s => text.toLowerCase().includes(s));
}

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

    const isActiveRef = useRef(false);
    const isSpeakingRef = useRef(false);
    const recognitionRef = useRef(null);
    const langRef = useRef(lang);
    const screenRef = useRef(screen);
    const processingRef = useRef(false);
    const vadRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const lastInterimRef = useRef('');
    const bargedInRef = useRef(false);

    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { screenRef.current = screen; }, [screen]);

    // ── Initialize VAD ──────────────────────────────
    const initVAD = useCallback(async () => {
        try {
            const vadModule = await import('@ricky0123/vad-web');
            const vad = await vadModule.MicVAD.new({
                positiveSpeechThreshold: 0.8,
                negativeSpeechThreshold: 0.3,
                minSpeechFrames: 3,
                preSpeechPadFrames: 3,
                redemptionFrames: 8, // ~480ms silence = speech ended

                onSpeechStart: () => {
                    // ── BARGE-IN: User started speaking ──
                    if (isSpeakingRef.current) {
                        window.speechSynthesis.cancel();
                        isSpeakingRef.current = false;
                        bargedInRef.current = true;
                        setStatus('listening');
                        addLog?.('🔇 Barge-in!');
                    }
                    // Clear the silence timer
                    clearTimeout(silenceTimerRef.current);
                },

                onSpeechEnd: () => {
                    // ── User stopped speaking → process IMMEDIATELY ──
                    if (!isActiveRef.current || processingRef.current) return;

                    // Give Web Speech API a moment to finalize, then force-process
                    silenceTimerRef.current = setTimeout(() => {
                        const transcript = lastInterimRef.current?.trim();
                        if (transcript && transcript.length > 1 && !processingRef.current) {
                            addLog?.('🔕 VAD: speech ended');
                            handleFinalTranscript(transcript);
                        }
                    }, 300); // 300ms after VAD detects silence — much faster than default
                },
            });

            vadRef.current = vad;
            return vad;
        } catch (err) {
            console.warn('VAD init failed, using fallback:', err);
            addLog?.('⚠️ VAD unavailable, using timer fallback');
            return null;
        }
    }, [addLog]);

    // ── Start recognition (Web Speech API for transcription) ──
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
            const lastResult = e.results[e.results.length - 1];

            // BARGE-IN via speech recognition too
            if (isSpeakingRef.current) {
                window.speechSynthesis.cancel();
                isSpeakingRef.current = false;
                bargedInRef.current = true;
                setStatus('listening');
            }

            if (lastResult.isFinal) {
                const t = lastResult[0].transcript.trim();
                lastInterimRef.current = t;
                setInterimText('');
                if (t.length > 1 && !processingRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    handleFinalTranscript(t);
                }
            } else {
                const interim = lastResult[0].transcript;
                lastInterimRef.current = interim;
                setInterimText(interim);
                if (!isSpeakingRef.current) setStatus('listening');

                // Fallback silence timer (in case VAD isn't available)
                if (!vadRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = setTimeout(() => {
                        const t = lastInterimRef.current?.trim();
                        if (t && t.length > 1 && !processingRef.current) {
                            handleFinalTranscript(t);
                        }
                    }, 1200);
                }
            }
        };

        r.onerror = (e) => {
            if (['no-speech', 'aborted'].includes(e.error)) {
                if (isActiveRef.current) setTimeout(() => startRecognition(), 300);
                return;
            }
            addLog?.(`Voice error: ${e.error}`);
            if (isActiveRef.current) setTimeout(() => startRecognition(), 1000);
        };

        r.onend = () => {
            if (isActiveRef.current) setTimeout(() => startRecognition(), 200);
        };

        recognitionRef.current = r;
        try { r.start(); } catch { }
        if (!isSpeakingRef.current) setStatus('listening');
    }, [addLog]);

    // ── Process transcript: PARALLEL pipeline ──────────
    const handleFinalTranscript = useCallback(async (transcript) => {
        if (processingRef.current) return;
        processingRef.current = true;
        bargedInRef.current = false;

        setLastTranscript(transcript);
        setInterimText('');
        lastInterimRef.current = '';
        setStatus('processing');
        addLog?.(`🎤 "${transcript}"`);

        // Stop command?
        if (isStopCommand(transcript)) {
            await speakAndFinish(
                langRef.current === 'hi' ? 'ठीक है, बंद कर रहा हूँ।' : 'Okay, stopping.',
                true
            );
            processingRef.current = false;
            return;
        }

        // Quick nav detection (instant, 0ms)
        const navRoute = detectQuickNav(transcript);

        try {
            // ── PARALLEL: Stream Gemini + Start TTS on first sentence ──
            let firstSentenceSpoken = false;
            let fullReply = '';

            const result = await streamGeminiResponse(
                transcript,
                langRef.current,
                `${screenRef.current} | ${window.location.pathname}`,
                // onSentence callback — TTS starts HERE
                async (sentence, index) => {
                    if (bargedInRef.current) return; // User interrupted

                    fullReply += (index > 0 ? ' ' : '') + sentence;
                    setLastReply(fullReply);

                    if (index === 0) {
                        // FIRST sentence → start TTS immediately (parallel!)
                        setStatus('speaking');
                        isSpeakingRef.current = true;
                        firstSentenceSpoken = true;

                        // Navigate NOW if detected (don't wait for TTS)
                        if (navRoute) {
                            executeNav(navRoute);
                        }
                    }

                    // Queue TTS for each sentence (they play in order)
                    if (!bargedInRef.current) {
                        await queueTTS(sentence, langRef.current);
                    }
                }
            );

            // If streaming didn't trigger TTS (maybe very short response)
            if (!firstSentenceSpoken && result.reply && !bargedInRef.current) {
                setLastReply(result.reply);
                setStatus('speaking');
                isSpeakingRef.current = true;
                await queueTTS(result.reply, langRef.current);
            }

            // Execute Gemini-detected navigation
            if (!navRoute && result.intent === 'navigate' && result.action_key) {
                const routes = {
                    electricity: '/bill/electricity', water: '/bill/water',
                    gas: '/bill/gas', complaint: '/complaint',
                };
                if (routes[result.action_key]) executeNav(routes[result.action_key]);
            } else if (result.intent === 'set_screen') {
                if (result.action_key === 'quick_pay') { setScreen('guest'); navigate('/'); }
                else if (result.action_key === 'citizen_login') { setScreen('citizen-auth'); }
            } else if (result.intent === 'go_back') {
                navigate(-1);
            } else if (navRoute && !firstSentenceSpoken) {
                // Navigate even if TTS hasn't started
                executeNav(navRoute);
            }

        } catch (err) {
            console.error('Pipeline error:', err);
            if (!bargedInRef.current) {
                await speakAndFinish(
                    langRef.current === 'hi' ? 'माफ़ कीजिए, कृपया फिर से बोलें।'
                        : 'Sorry, please try again.',
                    false
                );
            }
        }

        // Done speaking → back to listening
        isSpeakingRef.current = false;
        if (isActiveRef.current && !bargedInRef.current) {
            setStatus('listening');
        }
        processingRef.current = false;
    }, [navigate, setScreen, addLog]);

    // ── Helpers ────────────────────────────────────────
    const executeNav = useCallback((route) => {
        if (route === '__BACK__') navigate(-1);
        else navigate(route);
        addLog?.(`📍 → ${route}`);
    }, [navigate, addLog]);

    const queueTTS = useCallback((text, lang) => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis || !text || bargedInRef.current) {
                resolve();
                return;
            }
            const u = new SpeechSynthesisUtterance(text);
            u.lang = TTS_LANGS[lang] || 'en-IN';
            u.rate = 1.05;
            u.pitch = 1;
            u.volume = 1;
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang.startsWith(lang));
            if (v) u.voice = v;
            u.onend = () => resolve();
            u.onerror = () => resolve();
            window.speechSynthesis.speak(u);
        });
    }, []);

    const speakAndFinish = useCallback(async (text, shouldStop) => {
        setLastReply(text);
        setStatus('speaking');
        isSpeakingRef.current = true;
        await speakText(text, langRef.current);
        isSpeakingRef.current = false;
        if (shouldStop) deactivateVoice();
        else if (isActiveRef.current) setStatus('listening');
    }, []);

    // ── ACTIVATE ─────────────────────────────────────
    const activateVoice = useCallback(async () => {
        if (isActiveRef.current) return;
        isActiveRef.current = true;
        setIsActive(true);
        setLastTranscript('');
        setLastReply('');
        setInterimText('');
        stopSpeaking();
        addLog?.('🟢 Voice ON');

        // Start VAD + Recognition in parallel
        const vad = await initVAD();
        if (vad) {
            try { vad.start(); addLog?.('🎯 VAD active'); }
            catch (e) { console.warn('VAD start failed:', e); }
        }
        startRecognition();

        // Greet
        const greetings = {
            gateway: {
                hi: 'नमस्ते! बताइए क्या करना है?',
                en: 'Hello! What would you like to do?',
                pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਦੱਸੋ ਕੀ ਕਰਨਾ ਹੈ?',
            },
            guest: {
                hi: 'बोलिए, कौन सा बिल भरना है?',
                en: 'Which bill would you like to pay?',
                pa: 'ਦੱਸੋ, ਕਿਹੜਾ ਬਿੱਲ ਭਰਨਾ ਹੈ?',
            },
            'citizen-dashboard': {
                hi: 'बोलिए, क्या करना है?',
                en: 'What would you like to do?',
                pa: 'ਦੱਸੋ ਕੀ ਕਰਨਾ ਹੈ?',
            },
        };
        const g = greetings[screenRef.current] || greetings.guest;
        const text = g[langRef.current] || g.en;
        await speakAndFinish(text, false);
    }, [initVAD, startRecognition, addLog]);

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
        try { vadRef.current?.pause(); } catch { }
        addLog?.('🔴 Voice OFF');
    }, [addLog]);

    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            try { recognitionRef.current?.abort(); } catch { }
            try { vadRef.current?.destroy(); } catch { }
            stopSpeaking();
        };
    }, []);

    const ctx = {
        isActive, status, activate: activateVoice,
        deactivate: deactivateVoice, lastTranscript, lastReply,
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
                                    {lastReply?.substring(0, 80)}{lastReply?.length > 80 ? '...' : ''}
                                </span>
                            </>
                        )}
                    </div>
                    <button className="vo-bar-close"
                        onClick={status === 'speaking'
                            ? () => { stopSpeaking(); isSpeakingRef.current = false; bargedInRef.current = true; setStatus('listening'); }
                            : deactivateVoice
                        }>
                        {status === 'speaking' ? '⏭' : '✕'}
                    </button>
                </div>
            )}
        </VoiceContext.Provider>
    );
});

export default VoiceAgent;
