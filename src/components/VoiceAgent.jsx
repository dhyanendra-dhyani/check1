/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v8 — Bulletproof Listening + Navigation Guidance
 *
 * FIXES:
 *   1. Recognition starts AFTER greeting finishes (no interference)
 *   2. Route-change detection → speaks screen-specific guidance
 *   3. Robust restart loop with exponential backoff
 *   4. Console logging for every state change (debugging)
 *   5. Post-navigation announcements ("ab consumer number dalein")
 *
 * FLOW:
 *   voiceMode=true → auto-activate → GREET → wait for greeting end
 *   → START recognition → listen → process → stream Gemini → TTS
 *   → route changes → announce new screen → keep listening
 *   → barge-in: user speaks during TTS → cancel → listen
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useLocation } from 'react-router-dom';
import VoiceContext from './VoiceContext';
import { streamGeminiResponse, stopSpeaking, speakText, hasApiKeys } from '../utils/geminiVoiceAgent';

const SPEECH_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
};

// ── Quick nav keywords (instant, 0ms) ────────────────
const NAV_KEYWORDS = {
    electricity: { words: ['bijli', 'electricity', 'electric', 'बिजली', 'ਬਿਜਲੀ', 'light', 'bijlee', 'lite', 'bill'], route: '/bill/electricity' },
    water: { words: ['paani', 'water', 'jal', 'पानी', 'ਪਾਣੀ', 'pani'], route: '/bill/water' },
    gas: { words: ['gas', 'गैस', 'ਗੈਸ', 'lpg', 'cylinder'], route: '/bill/gas' },
    complaint: { words: ['complaint', 'shikayat', 'शिकायत', 'ਸ਼ਿਕਾਇਤ', 'problem', 'samasya', 'समस्या'], route: '/complaint' },
    home: { words: ['home', 'ghar', 'shuru', 'होम', 'ਹੋਮ'], route: '/' },
    back: { words: ['back', 'peeche', 'wapas', 'पीछे', 'ਪਿੱਛੇ', 'vapas'], route: '__BACK__' },
    guest: { words: ['guest', 'quick pay', 'bina login', 'बिना लॉगिन', 'क्विक'], route: '__GUEST__' },
    login: { words: ['login', 'citizen', 'aadhaar', 'नागरिक', 'लॉगिन', 'आधार'], route: '__LOGIN__' },
};

function detectNav(text) {
    const lower = text.toLowerCase();
    for (const [, { words, route }] of Object.entries(NAV_KEYWORDS))
        if (words.some(w => lower.includes(w))) return route;
    return null;
}

function isStopCmd(text) {
    return ['stop', 'band karo', 'ruko', 'बंद करो', 'रुको', 'ਬੰਦ', 'chup', 'bye', 'touch mode']
        .some(s => text.toLowerCase().includes(s));
}

// ── Screen guidance messages ──────────────────────────
const SCREEN_GUIDANCE = {
    '/': {
        hi: 'यह होम पेज है। कौन सा बिल भरना है? बिजली, पानी, या गैस?',
        en: 'This is the home page. Which bill? Electricity, water, or gas?',
    },
    '/bill/electricity': {
        hi: 'बिजली बिल पेज खुल गया। अब नीचे दिए नंबर पैड से consumer number डालें, या बोलें।',
        en: 'Electricity bill page is open. Enter your consumer number using the keypad below, or tell me.',
    },
    '/bill/water': {
        hi: 'पानी बिल पेज खुल गया। Consumer number डालें।',
        en: 'Water bill page is open. Enter your consumer number.',
    },
    '/bill/gas': {
        hi: 'गैस बिल पेज खुल गया। Consumer number डालें।',
        en: 'Gas bill page is open. Enter your consumer number.',
    },
    '/complaint': {
        hi: 'शिकायत पेज खुल गया। नीचे से श्रेणी चुनें, या मुझे बताएं क्या समस्या है।',
        en: 'Complaint page is open. Choose a category below, or tell me your issue.',
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
    const restartCountRef = useRef(0);
    const maxRestartsRef = useRef(50);

    const location = useLocation();

    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { screenRef.current = screen; }, [screen]);

    // ── LOG HELPER ──────────────────────────────────
    const log = useCallback((msg) => {
        console.log(`[VoiceAgent] ${msg}`);
        addLog?.(msg);
    }, [addLog]);

    // ── TTS (speak and wait for it to finish) ───────
    const ttsSpeak = useCallback((text, langCode) => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis || !text) { resolve(); return; }
            window.speechSynthesis.cancel();

            const u = new SpeechSynthesisUtterance(text);
            u.lang = SPEECH_LANGS[langCode] || 'hi-IN';
            u.rate = 1.05;
            u.pitch = 1;
            u.volume = 1;

            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang.startsWith(langCode));
            if (v) u.voice = v;

            u.onend = () => {
                isSpeakingRef.current = false;
                resolve();
            };
            u.onerror = () => {
                isSpeakingRef.current = false;
                resolve();
            };

            isSpeakingRef.current = true;
            setStatus('speaking');
            window.speechSynthesis.speak(u);
        });
    }, []);

    // ── Queue TTS (append without cancelling) ───────
    const queueTTS = useCallback((text, langCode) => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis || !text || bargedInRef.current) { resolve(); return; }

            const u = new SpeechSynthesisUtterance(text);
            u.lang = SPEECH_LANGS[langCode] || 'hi-IN';
            u.rate = 1.05;
            u.pitch = 1;
            u.volume = 1;

            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang.startsWith(langCode));
            if (v) u.voice = v;

            u.onend = () => resolve();
            u.onerror = () => resolve();
            window.speechSynthesis.speak(u);
        });
    }, []);

    // ═══ RECOGNITION — BULLETPROOF LOOP ═══════════════

    const startRecognition = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { log('❌ SpeechRecognition not supported!'); return; }
        if (!isActiveRef.current) return;

        // Stop any existing
        try { recognitionRef.current?.abort(); } catch { }

        const r = new SR();
        r.lang = SPEECH_LANGS[langRef.current] || 'hi-IN';
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 1;

        r.onstart = () => {
            log('🎧 Recognition STARTED');
            restartCountRef.current = 0;
            if (!isSpeakingRef.current) setStatus('listening');
        };

        r.onresult = (e) => {
            const last = e.results[e.results.length - 1];

            // ── BARGE-IN ──
            if (isSpeakingRef.current) {
                log('🔇 BARGE-IN detected!');
                window.speechSynthesis.cancel();
                isSpeakingRef.current = false;
                bargedInRef.current = true;
                setStatus('listening');
            }

            if (last.isFinal) {
                const t = last[0].transcript.trim();
                log(`📝 Final: "${t}"`);
                lastInterimRef.current = '';
                setInterimText('');
                clearTimeout(silenceTimerRef.current);
                if (t.length > 1 && !processingRef.current) {
                    handleTranscript(t);
                }
            } else {
                const interim = last[0].transcript;
                lastInterimRef.current = interim;
                setInterimText(interim);
                if (!isSpeakingRef.current) setStatus('listening');

                // Silence fallback timer — if no new results for 1.5s, process
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    const t = lastInterimRef.current?.trim();
                    if (t && t.length > 2 && !processingRef.current) {
                        log(`⏱️ Silence timer: processing "${t}"`);
                        handleTranscript(t);
                        lastInterimRef.current = '';
                        setInterimText('');
                    }
                }, 1500);
            }
        };

        r.onerror = (e) => {
            log(`⚠️ Recognition error: ${e.error}`);
            if (['no-speech', 'aborted'].includes(e.error)) {
                if (isActiveRef.current) {
                    const delay = Math.min(500 * (restartCountRef.current + 1), 3000);
                    restartCountRef.current++;
                    if (restartCountRef.current < maxRestartsRef.current) {
                        setTimeout(() => startRecognition(), delay);
                    }
                }
                return;
            }
            // Other errors: retry with delay
            if (isActiveRef.current && restartCountRef.current < maxRestartsRef.current) {
                restartCountRef.current++;
                setTimeout(() => startRecognition(), 1500);
            }
        };

        r.onend = () => {
            log('🔄 Recognition ended, restarting...');
            if (isActiveRef.current && restartCountRef.current < maxRestartsRef.current) {
                restartCountRef.current++;
                setTimeout(() => startRecognition(), 300);
            }
        };

        recognitionRef.current = r;
        try {
            r.start();
            log('🚀 Recognition .start() called');
        } catch (err) {
            log(`❌ Recognition .start() failed: ${err.message}`);
            if (isActiveRef.current) setTimeout(() => startRecognition(), 1000);
        }
    }, [log]);

    // ═══ PROCESS TRANSCRIPT ═══════════════════════════

    const handleTranscript = useCallback(async (transcript) => {
        if (processingRef.current) return;
        processingRef.current = true;
        bargedInRef.current = false;

        setLastTranscript(transcript);
        setInterimText('');
        lastInterimRef.current = '';
        setStatus('processing');
        log(`🎤 Processing: "${transcript}"`);

        // Stop command
        if (isStopCmd(transcript)) {
            setLastReply('ठीक है, बंद कर रहा हूँ');
            await ttsSpeak('ठीक है, बंद कर रहा हूँ।', langRef.current);
            deactivateVoice();
            processingRef.current = false;
            return;
        }

        // Quick nav detection
        const navRoute = detectNav(transcript);
        if (navRoute) log(`🗺️ Nav keyword detected: ${navRoute}`);

        // Execute nav immediately for flow actions
        if (navRoute === '__GUEST__') {
            setScreen('guest'); navigate('/');
            setLastReply('ठीक है, Quick Pay खुल रहा है');
            await ttsSpeak(langRef.current === 'hi' ? 'ठीक है, Quick Pay खुल रहा है। कौन सा बिल भरना है?' : 'Opening Quick Pay. Which bill?', langRef.current);
            if (isActiveRef.current) setStatus('listening');
            processingRef.current = false;
            return;
        }
        if (navRoute === '__LOGIN__') {
            setScreen('citizen-auth');
            setLastReply('ठीक है, लॉगिन पेज खुल रहा है');
            await ttsSpeak(langRef.current === 'hi' ? 'ठीक है, लॉगिन पेज खुल रहा है।' : 'Opening login page.', langRef.current);
            if (isActiveRef.current) setStatus('listening');
            processingRef.current = false;
            return;
        }
        if (navRoute === '__BACK__') {
            navigate(-1);
            processingRef.current = false;
            return;
        }
        if (navRoute && navRoute !== '__BACK__') {
            navigate(navRoute);
            // Guidance will be spoken by route-change detector
            processingRef.current = false;
            return;
        }

        // ── No quick nav → ask Gemini ──
        if (!hasApiKeys()) {
            log('❌ No API keys!');
            setLastReply('API keys missing');
            await ttsSpeak('API keys are not configured. Please check your .env file.', 'en');
            if (isActiveRef.current) setStatus('listening');
            processingRef.current = false;
            return;
        }

        try {
            let fullReply = '';
            let firstSent = false;
            let geminiNav = null;

            const result = await streamGeminiResponse(
                transcript,
                langRef.current,
                `${screenRef.current} | ${window.location.pathname}`,
                async (sentence, idx) => {
                    if (bargedInRef.current) return;
                    fullReply += (idx > 0 ? ' ' : '') + sentence;
                    setLastReply(fullReply);

                    if (idx === 0) {
                        isSpeakingRef.current = true;
                        setStatus('speaking');
                        firstSent = true;
                    }

                    if (!bargedInRef.current) await queueTTS(sentence, langRef.current);
                }
            );

            // Fallback if streaming didn't fire
            if (!firstSent && result.reply && !bargedInRef.current) {
                setLastReply(result.reply);
                isSpeakingRef.current = true;
                await ttsSpeak(result.reply, langRef.current);
            }

            // Gemini navigation
            if (result.intent === 'navigate' && result.action_key) {
                const routes = { electricity: '/bill/electricity', water: '/bill/water', gas: '/bill/gas', complaint: '/complaint', home: '/' };
                geminiNav = routes[result.action_key];
                if (geminiNav) {
                    log(`🤖 Gemini nav: ${geminiNav}`);
                    navigate(geminiNav);
                }
            } else if (result.intent === 'set_screen') {
                if (result.action_key === 'quick_pay') { setScreen('guest'); navigate('/'); }
                else if (result.action_key === 'citizen_login') setScreen('citizen-auth');
            } else if (result.intent === 'go_back') navigate(-1);

        } catch (err) {
            log(`❌ Gemini error: ${err.message}`);
            if (!bargedInRef.current) {
                setLastReply('माफ कीजिए, फिर से बोलें');
                await ttsSpeak(langRef.current === 'hi' ? 'माफ़ कीजिए, कृपया फिर से बोलें।' : 'Sorry, please try again.', langRef.current);
            }
        }

        isSpeakingRef.current = false;
        if (isActiveRef.current && !bargedInRef.current) setStatus('listening');
        processingRef.current = false;
    }, [navigate, setScreen, log, ttsSpeak, queueTTS]);

    // ═══ ROUTE CHANGE DETECTION (guidance) ═══════════

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        const currentPath = location.pathname;

        // Only speak guidance when route actually changes
        if (currentPath !== lastRouteRef.current) {
            const prevRoute = lastRouteRef.current;
            lastRouteRef.current = currentPath;

            // Don't speak guidance for the very first route (greeting handles it)
            if (!prevRoute) return;

            // Don't speak if we're currently processing (Gemini response is already speaking)
            if (processingRef.current) return;

            const guidance = SCREEN_GUIDANCE[currentPath];
            if (guidance) {
                const text = guidance[langRef.current] || guidance.en;
                log(`📍 Route → ${currentPath}: "${text}"`);
                setLastReply(text);

                // Wait a moment for the page to render, then speak
                setTimeout(async () => {
                    if (isActiveRef.current && !processingRef.current) {
                        await ttsSpeak(text, langRef.current);
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
        log('🟢 Voice ACTIVATED');

        // Screen-specific greeting
        const greetings = {
            gateway: {
                hi: 'ठीक है! बताइए — बिना लॉगिन के Quick Pay करना है, या Citizen लॉगिन?',
                en: 'Tell me — Quick Pay without login, or Citizen login?',
                pa: 'ਦੱਸੋ — ਬਿਨਾਂ ਲੌਗਇਨ Quick Pay, ਜਾਂ Citizen ਲੌਗਇਨ?',
            },
            guest: {
                hi: 'बोलिए, कौन सा बिल भरना है — बिजली, पानी, या गैस?',
                en: 'Which bill would you like to pay — electricity, water, or gas?',
                pa: 'ਦੱਸੋ, ਕਿਹੜਾ ਬਿੱਲ ਭਰਨਾ ਹੈ — ਬਿਜਲੀ, ਪਾਣੀ, ਜਾਂ ਗੈਸ?',
            },
            'citizen-dashboard': {
                hi: 'बोलिए, क्या करना है — बिल भरना, शिकायत, या कुछ और?',
                en: 'What would you like to do — pay a bill, file a complaint, or something else?',
            },
            'citizen-auth': {
                hi: 'लॉगिन के लिए नीचे से तरीका चुनें — अंगूठा, आँख, या OTP।',
                en: 'Choose a login method below — thumb, iris, or OTP.',
            },
        };
        const g = greetings[screenRef.current] || greetings.gateway;
        const text = g[langRef.current] || g.en;

        setLastReply(text);
        setStatus('speaking');

        // Speak greeting FIRST, then start recognition AFTER
        await ttsSpeak(text, langRef.current);

        // NOW start listening (after greeting is done)
        if (isActiveRef.current) {
            log('📢 Greeting done → starting recognition');
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
        stopSpeaking();
        clearTimeout(silenceTimerRef.current);
        try { recognitionRef.current?.abort(); } catch { }
        log('🔴 Voice DEACTIVATED');
    }, [log]);

    // Auto-activate when voiceMode is on and screen changes (first time)
    useEffect(() => {
        if (voiceMode && !isActiveRef.current && screen !== 'idle') {
            log('🔄 Auto-activate: voiceMode=true, screen=' + screen);
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

            {/* ═══ VOICE STATUS BAR ═══════════════════════ */}
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
                            ? () => {
                                stopSpeaking();
                                isSpeakingRef.current = false;
                                bargedInRef.current = true;
                                setStatus('listening');
                            }
                            : deactivateVoice}>
                        {status === 'speaking' ? '⏭' : '✕'}
                    </button>
                </div>
            )}
        </VoiceContext.Provider>
    );
});

export default VoiceAgent;
