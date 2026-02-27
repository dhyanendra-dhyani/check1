/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v14 — Production-Quality Voice Assistant
 *
 * ROOT CAUSE OF BARGE-IN NOT WORKING:
 * Web SpeechRecognition picks up TTS audio through the mic
 * and processes it as the user speaking. This causes:
 * - False transcripts during agent speech
 * - No real barge-in (recognition is disabled on most browsers
 *   by default when TTS is active anyway)
 *
 * SOLUTION: Pause STT when TTS starts, restart immediately when
 * user speaks. Use a "barge-in detection window" — keep STT
 * running but with a very tight energy threshold.
 *
 * ACTUALLY: The real WebSpeech API fix is:
 * 1. Stop recognition when TTS starts
 * 2. Monitor for onaudiostart on a parallel recognition instance
 * 3. Or: use onspeechstart to detect user speech during TTS
 *
 * PRACTICAL APPROACH (works on Chrome/Edge):
 * - Single recognition, continuous mode
 * - During TTS: if we get final transcript with length > 3 chars,
 *   it's real barge-in (TTS echo is usually < 3 chars or matches
 *   what we're saying)
 * - Cancel TTS + process transcript
 *
 * ALSO: Post-auth intent routing — store what user wanted before
 * auth, navigate there after login succeeds.
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
        hi: 'लॉगिन के लिए तीन विकल्प हैं — अंगूठा लगाइए, आँख स्कैन कराइए, या OTP डालिए। अंगूठा सबसे आसान है। बोलें "अंगूठा", "आँख", या "OTP"।',
        en: 'Three login options — Thumbprint, Iris scan, or OTP. Thumbprint is easiest. Say "thumb", "iris", or "OTP".',
    },
    'citizen-dashboard': {
        hi: 'आपका डैशबोर्ड खुल गया। यहाँ बकाया बिल, शिकायतें, और सेवाएं हैं। बोलें क्या करना है।',
        en: 'Dashboard is open. Bills, complaints, and services. What would you like to do?',
    },
    guest: {
        hi: 'कौन सा बिल भरना है — बिजली, पानी, या गैस? शिकायत भी दर्ज कर सकते हैं।',
        en: 'Which bill — electricity, water, or gas? You can also file a complaint.',
    },
};

const TRANSITION_PHRASE = {
    hi: 'ठीक है, ',
    en: 'Alright, ',
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

    // Core refs
    const isActiveRef = useRef(false);
    const isSpeakingRef = useRef(false);
    const recognitionRef = useRef(null);
    const langRef = useRef(lang);
    const screenRef = useRef(screen);
    const processingRef = useRef(false);
    const bargedInRef = useRef(false);
    const pendingTranscriptRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const lastInterimRef = useRef('');
    const lastRouteRef = useRef('');
    const lastScreenRef = useRef(screen);
    const restartCountRef = useRef(0);
    const convStateRef = useRef(CONV_STATES.INITIAL);
    const rePromptTimerRef = useRef(null);
    const rePromptCountRef = useRef(0);
    const postAuthIntentRef = useRef(null); // what to do after citizen login

    const location = useLocation();

    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { screenRef.current = screen; }, [screen]);

    const log = useCallback((msg) => {
        console.log(`[VA] ${msg}`);
        addLog?.(msg);
    }, [addLog]);

    // ══════════════════════════════════════════════════
    // TTS — Pause STT during speech, restart immediately
    // ══════════════════════════════════════════════════

    const ttsSpeak = useCallback((text, langCode) => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis || !text) { resolve(); return; }

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            // PAUSE STT during TTS to prevent mic picking up TTS audio
            // But keep recognition object alive — just abort the session
            try { recognitionRef.current?.abort(); } catch { }

            const u = new SpeechSynthesisUtterance(text);
            u.lang = SPEECH_LANGS[langCode] || 'hi-IN';
            u.rate = 1.05; u.pitch = 1; u.volume = 1;

            // Try to find a matching voice
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang === u.lang) ||
                voices.find(v => v.lang.startsWith(langCode)) ||
                voices[0];
            if (v) u.voice = v;

            u.onend = () => {
                isSpeakingRef.current = false;
                // RESUME STT after TTS finishes — wait 250ms to avoid echo
                setTimeout(() => {
                    if (isActiveRef.current && !bargedInRef.current) {
                        restartRecognition();
                        setStatus('listening');
                    }
                }, 250);
                resolve();
            };

            u.onerror = () => {
                isSpeakingRef.current = false;
                setTimeout(() => {
                    if (isActiveRef.current) {
                        restartRecognition();
                        setStatus('listening');
                    }
                }, 250);
                resolve();
            };

            // Detect if user starts speaking DURING TTS → barge-in
            u.onboundary = () => {
                // onboundary fires for each word — if we have a pending barge-in, stop
                if (bargedInRef.current) {
                    window.speechSynthesis.cancel();
                }
            };

            isSpeakingRef.current = true;
            bargedInRef.current = false;
            setStatus('speaking');
            window.speechSynthesis.speak(u);
        });
    }, []);

    // Queued TTS (for streaming, checks barge-in between sentences)
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

    // ══════════════════════════════════════════════════
    // RECOGNITION — restart after TTS
    // ══════════════════════════════════════════════════

    const restartRecognition = useCallback(() => {
        if (!isActiveRef.current) return;
        try { recognitionRef.current?.abort(); } catch { }
        setTimeout(() => startRecognition(), 100);
    }, []);

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
            restartCountRef.current = 0;
            if (!isSpeakingRef.current && isActiveRef.current) setStatus('listening');
        };

        r.onresult = (e) => {
            const last = e.results[e.results.length - 1];
            const transcript = last[0].transcript.trim();

            // ═══════════════════════════════════════════
            // BARGE-IN DETECTION
            // If we're speaking AND user transcript is substantial
            // (> 2 chars, not just a noise), treat as barge-in
            // ═══════════════════════════════════════════
            if (isSpeakingRef.current && transcript.length > 2) {
                log(`🔇 BARGE-IN: "${transcript}"`);
                window.speechSynthesis.cancel();
                isSpeakingRef.current = false;
                bargedInRef.current = true;
                setStatus('listening');
            }

            clearTimeout(rePromptTimerRef.current);

            if (last.isFinal) {
                if (transcript.length < 2) return;
                log(`📝 Final: "${transcript}"`);
                lastInterimRef.current = '';
                setInterimText('');
                clearTimeout(silenceTimerRef.current);

                if (processingRef.current) {
                    // Queue it — process after current finishes
                    log('📥 Queued transcript');
                    pendingTranscriptRef.current = transcript;
                } else {
                    handleTranscript(transcript);
                }
            } else {
                if (transcript.length > 1) {
                    lastInterimRef.current = transcript;
                    setInterimText(transcript);
                    if (!isSpeakingRef.current) setStatus('listening');
                }

                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    const t = lastInterimRef.current?.trim();
                    if (t && t.length > 2 && !processingRef.current && !isSpeakingRef.current) {
                        log(`⏱️ Silence: "${t}"`);
                        handleTranscript(t);
                        lastInterimRef.current = '';
                        setInterimText('');
                    }
                }, 1400);
            }
        };

        r.onspeechstart = () => {
            // User started speaking — if agent is speaking, this is barge-in
            if (isSpeakingRef.current) {
                log('🔇 onspeechstart barge-in');
                window.speechSynthesis.cancel();
                isSpeakingRef.current = false;
                bargedInRef.current = true;
                setStatus('listening');
            }
        };

        r.onerror = (e) => {
            if (['no-speech', 'aborted'].includes(e.error)) {
                if (isActiveRef.current && !isSpeakingRef.current) {
                    restartCountRef.current++;
                    if (restartCountRef.current < 50) setTimeout(() => startRecognition(), Math.min(300 * restartCountRef.current, 2000));
                }
                return;
            }
            if (isActiveRef.current && restartCountRef.current < 50) {
                restartCountRef.current++;
                setTimeout(() => startRecognition(), 1000);
            }
        };

        r.onend = () => {
            // Only auto-restart if not in TTS (TTS end will restart it)
            if (isActiveRef.current && !isSpeakingRef.current && restartCountRef.current < 50) {
                restartCountRef.current++;
                setTimeout(() => startRecognition(), 200);
            }
        };

        recognitionRef.current = r;
        try { r.start(); } catch { if (isActiveRef.current) setTimeout(() => startRecognition(), 500); }
    }, [log]);

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
            if (isActiveRef.current && rePromptCountRef.current < 3) startRePromptTimer();
        }, 11000);
    }, [log, ttsSpeak]);

    // ══════════════════════════════════════════════════
    // HANDLE TRANSCRIPT — Main intelligence
    // ══════════════════════════════════════════════════

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

        const say = async (text) => {
            if (!text || bargedInRef.current) return;
            setLastReply(text);
            await ttsSpeak(text, L);
        };

        const finalize = () => {
            processingRef.current = false;
            isSpeakingRef.current = false;
            // Check for queued transcript from barge-in
            const pending = pendingTranscriptRef.current;
            if (pending && isActiveRef.current) {
                pendingTranscriptRef.current = null;
                log(`📤 Processing pending: "${pending}"`);
                setTimeout(() => handleTranscript(pending), 50);
                return;
            }
            if (isActiveRef.current) setStatus('listening');
        };

        // ── STOP ──────────────────────────────────────
        if (matchesKeywords(transcript, STOP_KEYWORDS)) {
            await say(getResponse('stopping', L));
            deactivateVoice();
            finalize();
            return;
        }

        // ── BACK ──────────────────────────────────────
        if (matchesKeywords(transcript, BACK_KEYWORDS)) {
            navigate(-1);
            finalize();
            return;
        }

        // ── HOME ──────────────────────────────────────
        if (matchesKeywords(transcript, HOME_KEYWORDS)) {
            navigate('/');
            finalize();
            return;
        }

        // ── AUTH SCREEN COMMANDS ───────────────────────
        if (screenRef.current === 'citizen-auth') {
            if (lower.includes('angootha') || lower.includes('thumb') || lower.includes('अंगूठा') || lower.includes('ungali') || lower.includes('finger')) {
                await say(L === 'hi'
                    ? 'नीचे "Thumb" बटन दबाएं और बायोमेट्रिक मशीन पर अंगूठा रखें। 2-3 सेकंड में स्कैन हो जाएगा।'
                    : 'Press "Thumb" below and place your finger on the scanner. Done in 2-3 seconds.');
                finalize(); return;
            }
            if (lower.includes('aankh') || lower.includes('iris') || lower.includes('आँख') || lower.includes('eye') || lower.includes('ankh')) {
                await say(L === 'hi'
                    ? '"Iris" बटन दबाएं और कैमरे में देखें, आँख खुली रखें।'
                    : 'Press "Iris" and look at the camera with your eye open.');
                finalize(); return;
            }
            if (lower.includes('otp') || lower.includes('ओटीपी') || lower.includes('mobile') || lower.includes('मोबाइल')) {
                await say(L === 'hi'
                    ? '"OTP" बटन दबाएं। मोबाइल नंबर डालें। डेमो OTP है 482916।'
                    : 'Press "OTP". Enter your mobile number. Demo OTP is 482916.');
                finalize(); return;
            }
        }

        // ── CITIZEN-REQUIRED FEATURES → Smart redirect ─
        // Detect intent, store it, redirect to auth, after login go there
        const hasNaam = lower.includes('naam') || lower.includes('name') || lower.includes('नाम बदल');
        const hasPipeline = lower.includes('pipeline') || lower.includes('gas line') || lower.includes('पाइपलाइन');
        const hasConnection = (lower.includes('naya') || lower.includes('नया')) && (lower.includes('connection') || lower.includes('कनेक्शन'));
        const hasCert = lower.includes('certificate') || lower.includes('pramanpatra') || lower.includes('प्रमाणपत्र');
        const hasDashboard = lower.includes('dashboard') || lower.includes('history') || lower.includes('record') || lower.includes('इतिहास');
        const hasSubsidy = lower.includes('subsidy') || lower.includes('सब्सिडी');

        if (hasNaam || hasPipeline || hasConnection || hasCert || hasDashboard || hasSubsidy ||
            matchesKeywords(transcript, CITIZEN_REQUIRED_KEYWORDS)) {

            log('🔐 Citizen-required feature, storing intent');

            // Store post-auth intent for routing after login
            if (hasNaam) postAuthIntentRef.current = { type: 'naam_change' };
            else if (hasPipeline) postAuthIntentRef.current = { type: 'pipeline' };
            else if (hasConnection) postAuthIntentRef.current = { type: 'new_connection' };
            else if (hasCert) postAuthIntentRef.current = { type: 'certificate' };
            else postAuthIntentRef.current = { type: 'dashboard' };

            let msg = '';
            if (hasNaam) {
                msg = L === 'hi'
                    ? 'अच्छा, नाम बदलवाना है! इसके लिए आधार से लॉगिन करना होगा। अंगूठा लगाइए या OTP डालिए — बस 2-3 सेकंड में। मैं लॉगिन पेज पर ले जा रहा हूँ।'
                    : 'Name change! You need Aadhaar login for this. Thumbprint or OTP — just 2-3 seconds. Taking you to login.';
            } else if (hasPipeline) {
                msg = L === 'hi'
                    ? 'गैस पाइपलाइन के लिए आधार लॉगिन ज़रूरी है। अपने नाम से कराना है तो अंगूठा लगाइए — बहुत आसान है।'
                    : 'Gas pipeline needs Aadhaar login. Just thumbprint if it\'s in your name — very easy.';
            } else if (hasConnection) {
                msg = L === 'hi'
                    ? 'नया कनेक्शन लगवाने के लिए आधार लॉगिन चाहिए। अंगूठा लगाइए।'
                    : 'New connection needs Aadhaar login. Place your thumb.';
            } else {
                msg = L === 'hi'
                    ? 'इस सेवा के लिए आधार से लॉगिन करना होगा। मैं लॉगिन पेज पर ले जा रहा हूँ।'
                    : 'This service needs Aadhaar login. Taking you to the login page.';
            }

            await say(msg);
            convStateRef.current = CONV_STATES.CITIZEN_AUTH;
            setScreen('citizen-auth');
            finalize();
            return;
        }

        // ── COMMON Q&A (instant) ──────────────────────
        const qa = findCommonAnswer(transcript, L);
        if (qa) {
            log('📚 Q&A match');
            await say(qa);
            finalize();
            return;
        }

        // ══════════════════════════════════════════════
        // STATE MACHINE
        // ══════════════════════════════════════════════

        const state = convStateRef.current;

        if (state === CONV_STATES.WAIT_PATH || state === CONV_STATES.INITIAL) {

            // Citizen path
            if (matchesKeywords(transcript, CITIZEN_KEYWORDS)) {
                log('→ Citizen path');
                convStateRef.current = CONV_STATES.CITIZEN_AUTH;
                await say(getResponse('citizen_chosen', L));
                setScreen('citizen-auth');
                finalize();
                return;
            }

            // Guest path
            if (matchesKeywords(transcript, GUEST_KEYWORDS)) {
                log('→ Guest path');
                convStateRef.current = CONV_STATES.GUEST_HOME;
                setScreen('guest');
                navigate('/');
                await say(getResponse('guest_chosen', L));
                finalize();
                return;
            }

            // Direct bill mention → guest path automatically
            const billType = detectBillType(transcript);
            if (billType) {
                log(`→ Direct bill: ${billType}`);
                convStateRef.current = CONV_STATES.BILL_INPUT;
                setScreen('guest');
                navigate(`/bill/${billType}`);
                finalize();
                return;
            }

            // Direct complaint
            if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
                log('→ Direct complaint');
                convStateRef.current = CONV_STATES.COMPLAINT_CAT;
                setScreen('guest');
                navigate('/complaint');
                finalize();
                return;
            }
        }

        // Any state: bill/complaint
        const billType = detectBillType(transcript);
        if (billType) {
            log(`→ Bill: ${billType}`);
            navigate(`/bill/${billType}`);
            finalize();
            return;
        }

        if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
            log('→ Complaint');
            navigate('/complaint');
            finalize();
            return;
        }

        // ── GEMINI FALLBACK ────────────────────────────
        if (hasApiKeys()) {
            try {
                let fullReply = '';
                let firstSent = false;

                const result = await streamGeminiResponse(
                    transcript, L, `screen:${screenRef.current} path:${window.location.pathname}`,
                    async (sentence, idx) => {
                        if (bargedInRef.current) return;
                        fullReply += (idx > 0 ? ' ' : '') + sentence;
                        setLastReply(fullReply);
                        if (idx === 0) { isSpeakingRef.current = true; setStatus('speaking'); firstSent = true; }
                        if (!bargedInRef.current) await queueTTS(sentence, L);
                    }
                );

                if (!firstSent && result.reply && !bargedInRef.current) {
                    await say(result.reply);
                }

                if (!bargedInRef.current && result.intent) {
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
                if (!bargedInRef.current) await say(getResponse('not_understood', L));
            }
        } else {
            if (!bargedInRef.current) await say(getResponse('not_understood', L));
        }

        finalize();
    }, [navigate, setScreen, log, ttsSpeak, queueTTS]);

    // ══════════════════════════════════════════════════
    // POST-AUTH ROUTING — after citizen login succeeds
    // ══════════════════════════════════════════════════
    // App.jsx calls handleAuth which sets screen='citizen-dashboard'
    // We detect that and check postAuthIntentRef

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        if (screen === lastScreenRef.current) return;

        const prevScreen = lastScreenRef.current;
        lastScreenRef.current = screen;
        log(`📺 Screen: ${prevScreen} → ${screen}`);

        if (!prevScreen || screen === 'idle') return;

        // Cancel whatever agent was saying about old screen
        window.speechSynthesis?.cancel();
        isSpeakingRef.current = false;
        bargedInRef.current = true;

        const speakForScreen = async () => {
            if (!isActiveRef.current) return;
            bargedInRef.current = false;

            // Post-auth: if user had an intent before login, guide them there
            if (screen === 'citizen-dashboard' && postAuthIntentRef.current) {
                const intent = postAuthIntentRef.current;
                postAuthIntentRef.current = null;

                let msg = '';
                const L = langRef.current;

                if (intent.type === 'naam_change') {
                    msg = L === 'hi'
                        ? 'लॉगिन हो गया! अब नाम बदलने के लिए — डैशबोर्ड में नीचे "✏️ Name Change" बटन दबाएं।'
                        : 'Logged in! For name change — press "✏️ Name Change" button below on the dashboard.';
                } else if (intent.type === 'pipeline') {
                    msg = L === 'hi'
                        ? 'लॉगिन हो गया! गैस पाइपलाइन के लिए डैशबोर्ड में "Apply New Connection" देखें।'
                        : 'Logged in! For gas pipeline, check "Apply New Connection" on the dashboard.';
                } else if (intent.type === 'new_connection') {
                    msg = L === 'hi'
                        ? 'लॉगिन हो गया! नया कनेक्शन लगाने के लिए नीचे "🆕 Apply New Connection" बटन दबाएं।'
                        : 'Logged in! Press "🆕 Apply New Connection" button below.';
                } else if (intent.type === 'certificate') {
                    msg = L === 'hi'
                        ? 'लॉगिन हो गया! प्रमाणपत्र के लिए "📜 Print Certificate" बटन दबाएं।'
                        : 'Logged in! Press "📜 Print Certificate" button.';
                } else {
                    const g = SCREEN_GUIDANCE['citizen-dashboard'];
                    msg = g[L] || g.en;
                }

                log(`🎯 Post-auth intent: ${intent.type}`);
                setLastReply(msg);
                await ttsSpeak(msg, langRef.current);
                if (isActiveRef.current) setStatus('listening');
                return;
            }

            const g = SCREEN_GUIDANCE[screen];
            if (g) {
                const text = g[langRef.current] || g.en;
                log(`📍 Screen guidance: ${screen}`);
                setLastReply(text);
                await ttsSpeak(text, langRef.current);
                if (isActiveRef.current) setStatus('listening');
            }
        };

        setTimeout(speakForScreen, 600);
    }, [screen, voiceMode, log, ttsSpeak]);

    // Route change → cancel old + announce new
    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        const currentPath = location.pathname;
        if (currentPath === lastRouteRef.current) return;

        const prevPath = lastRouteRef.current;
        lastRouteRef.current = currentPath;
        log(`📍 Route: ${prevPath} → ${currentPath}`);

        // Cancel old speech
        window.speechSynthesis?.cancel();
        isSpeakingRef.current = false;
        bargedInRef.current = true;

        const guidance = getPageGuidance(currentPath, langRef.current);
        if (guidance) {
            const transition = prevPath ? (TRANSITION_PHRASE[langRef.current] || TRANSITION_PHRASE.en) : '';
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
        window.speechSynthesis?.cancel();
        restartCountRef.current = 0;
        rePromptCountRef.current = 0;
        lastRouteRef.current = window.location.pathname;
        lastScreenRef.current = screen;
        convStateRef.current = CONV_STATES.WAIT_PATH;
        pendingTranscriptRef.current = null;
        postAuthIntentRef.current = null;
        log('🟢 Activated');

        const greeting = getInitialGreeting(langRef.current);
        setLastReply(greeting);
        setStatus('speaking');
        await ttsSpeak(greeting, langRef.current);

        if (isActiveRef.current) {
            log('📢 Listening');
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
        postAuthIntentRef.current = null;
        window.speechSynthesis?.cancel();
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

    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            try { recognitionRef.current?.abort(); } catch { }
            stopSpeaking();
            window.speechSynthesis?.cancel();
            clearTimeout(rePromptTimerRef.current);
            clearTimeout(silenceTimerRef.current);
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
                                    {interimText
                                        ? `"${interimText.substring(0, 60)}${interimText.length > 60 ? '...' : ''}"`
                                        : (lang === 'hi' ? '🎧 बोलिए...' : '🎧 Speak...')}
                                </span>
                            </>
                        )}
                        {status === 'processing' && (
                            <>
                                <div className="vo-spinner" />
                                <span className="vo-bar-label">
                                    {lastTranscript
                                        ? `"${lastTranscript.substring(0, 50)}..."`
                                        : (lang === 'hi' ? '🧠 समझ रहा हूँ...' : '🧠 Thinking...')}
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
                                    {lastReply?.substring(0, 90)}{lastReply?.length > 90 ? '...' : ''}
                                </span>
                            </>
                        )}
                    </div>
                    <button
                        className="vo-bar-close"
                        title={status === 'speaking' ? 'Skip' : 'Stop voice'}
                        onClick={status === 'speaking'
                            ? () => {
                                window.speechSynthesis?.cancel();
                                isSpeakingRef.current = false;
                                bargedInRef.current = true;
                                setStatus('listening');
                                setTimeout(() => restartRecognition(), 200);
                            }
                            : deactivateVoice}
                    >
                        {status === 'speaking' ? '⏭' : '✕'}
                    </button>
                </div>
            )}
        </VoiceContext.Provider>
    );
});

export default VoiceAgent;
