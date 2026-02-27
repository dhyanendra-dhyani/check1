/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v15 — Back to Proven Listening + Smart Features
 *
 * v14 BROKE LISTENING because restartRecognition had a stale
 * closure (empty useCallback deps). STT never restarted after
 * TTS ended.
 *
 * FIX: Go back to v13's PROVEN approach:
 *   - Recognition runs CONTINUOUSLY (never paused during TTS)
 *   - Barge-in: if onresult fires during TTS → cancel TTS
 *   - Pending queue for transcripts during processing
 *
 * SMART FEATURES (from v14, kept):
 *   - Post-auth intent routing (naam change → auth → dashboard)
 *   - Screen + route change cancels old TTS + speaks new
 *   - Auth screen action handlers (thumb/iris/OTP)
 *   - Common Q&A instant answers
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
        hi: 'अंगूठा लगाइए, आँख स्कैन, या OTP — कौन सा?',
        en: 'Thumb, iris, or OTP — which one?',
    },
    'citizen-dashboard': {
        hi: 'डैशबोर्ड खुल गया। बोलिए क्या करना है?',
        en: 'Dashboard ready. What would you like?',
    },
    guest: {
        hi: 'बिजली, पानी, या गैस — कौन सा बिल?',
        en: 'Electricity, water, or gas — which bill?',
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
    const pendingTranscriptRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const lastInterimRef = useRef('');
    const lastRouteRef = useRef('');
    const lastScreenRef = useRef(screen);
    const restartCountRef = useRef(0);
    const convStateRef = useRef(CONV_STATES.INITIAL);
    const rePromptTimerRef = useRef(null);
    const rePromptCountRef = useRef(0);
    const postAuthIntentRef = useRef(null);

    const location = useLocation();

    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { screenRef.current = screen; }, [screen]);

    const log = useCallback((msg) => {
        console.log(`[VA] ${msg}`);
        addLog?.(msg);
    }, [addLog]);

    // ══════════════════════════════════════════════════
    // TTS — Simple, proven. Recognition stays running.
    // ══════════════════════════════════════════════════

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
            if (isActiveRef.current && rePromptCountRef.current < 3) startRePromptTimer();
        }, 12000);
    }, [log, ttsSpeak]);

    // ══════════════════════════════════════════════════
    // RECOGNITION — Continuous, never paused
    // ══════════════════════════════════════════════════

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
            log('🎧 Recognition started');
            restartCountRef.current = 0;
            if (!isSpeakingRef.current) setStatus('listening');
        };

        r.onresult = (e) => {
            const last = e.results[e.results.length - 1];

            // ═══ SMART BARGE-IN ═══
            // During TTS: mic picks up echo → low confidence, short text.
            // Real user speech → HIGH confidence (>0.6), longer text (>5 chars).
            // Only cancel TTS if it's genuinely the user speaking.
            if (isSpeakingRef.current) {
                if (last.isFinal) {
                    const conf = last[0].confidence || 0;
                    const txt = last[0].transcript.trim();
                    if (conf > 0.6 && txt.length > 5) {
                        log(`🔇 Barge-in: "${txt}" (${(conf * 100).toFixed(0)}%)`);
                        window.speechSynthesis.cancel();
                        isSpeakingRef.current = false;
                        bargedInRef.current = true;
                        setStatus('listening');
                        // Don't return — let it fall through to process this transcript
                    } else {
                        return; // TTS echo or noise — ignore
                    }
                } else {
                    return; // Ignore interim results during TTS
                }
            }

            clearTimeout(rePromptTimerRef.current);

            if (last.isFinal) {
                const t = last[0].transcript.trim();
                const confidence = last[0].confidence || 0;

                // ═══ NOISE FILTER ═══
                if (t.length < 3) return;
                if (confidence > 0 && confidence < 0.35) { log(`🔇 Low confidence: "${t}"`); return; }
                const NOISE = ['hmm', 'hm', 'uh', 'uhh', 'ah', 'ahh', 'um', 'umm', 'oh', 'mm', 'ha', 'haan', 'ok', 'aah', 'hmm hmm'];
                if (NOISE.includes(t.toLowerCase())) { log(`🔇 Noise: "${t}"`); return; }

                log(`📝 "${t}" (${(confidence * 100).toFixed(0)}%)`);
                lastInterimRef.current = '';
                setInterimText('');
                clearTimeout(silenceTimerRef.current);

                if (processingRef.current) {
                    log(`📥 Queued: "${t}"`);
                    pendingTranscriptRef.current = t;
                } else {
                    handleTranscript(t);
                }
            } else {
                lastInterimRef.current = last[0].transcript;
                setInterimText(last[0].transcript);
                setStatus('listening');

                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    const t = lastInterimRef.current?.trim();
                    if (t && t.length > 2 && !processingRef.current && !isSpeakingRef.current) {
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
                    if (restartCountRef.current < 50) {
                        setTimeout(() => startRecognition(), Math.min(500 * restartCountRef.current, 3000));
                    }
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

    // ══════════════════════════════════════════════════
    // HANDLE TRANSCRIPT — Core intelligence
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

        // Helper: get current page/screen guidance for repeating on useless input
        const getCurrentGuidance = (lang) => {
            const sg = SCREEN_GUIDANCE[screenRef.current];
            if (sg) return (lang === 'hi' ? 'फिर से बताता हूँ। ' : 'Let me repeat. ') + (sg[lang] || sg.en);
            const pg = getPageGuidance(window.location.pathname, lang);
            if (pg) return (lang === 'hi' ? 'फिर से बताता हूँ। ' : 'Let me repeat. ') + pg;
            return getResponse('not_understood', lang);
        };


        // Helper: speak and check barge-in
        const say = async (text) => {
            if (!text || bargedInRef.current) return;
            setLastReply(text);
            await ttsSpeak(text, L);
        };

        // Helper: finish processing and check pending queue
        const done = () => {
            processingRef.current = false;
            isSpeakingRef.current = false;
            const pending = pendingTranscriptRef.current;
            if (pending && isActiveRef.current) {
                pendingTranscriptRef.current = null;
                log(`📤 Pending: "${pending}"`);
                setTimeout(() => handleTranscript(pending), 50);
                return;
            }
            if (isActiveRef.current && !bargedInRef.current) setStatus('listening');
        };

        // ── STOP ──
        if (matchesKeywords(transcript, STOP_KEYWORDS)) {
            await say(getResponse('stopping', L));
            deactivateVoice(); done(); return;
        }

        // ── BACK ──
        if (matchesKeywords(transcript, BACK_KEYWORDS)) {
            navigate(-1); done(); return;
        }

        // ── HOME ──
        if (matchesKeywords(transcript, HOME_KEYWORDS)) {
            navigate('/'); done(); return;
        }

        // ── AUTH SCREEN ACTIONS ──
        if (screenRef.current === 'citizen-auth') {
            if (lower.includes('angootha') || lower.includes('thumb') || lower.includes('अंगूठा') || lower.includes('finger') || lower.includes('ungali')) {
                await say(L === 'hi'
                    ? 'नीचे "Thumb" बटन दबाएं और बायोमेट्रिक मशीन पर अंगूठा रखें। 2-3 सेकंड में हो जाएगा।'
                    : 'Press "Thumb" button and place your finger on the scanner.');
                done(); return;
            }
            if (lower.includes('aankh') || lower.includes('iris') || lower.includes('आँख') || lower.includes('eye') || lower.includes('ankh')) {
                await say(L === 'hi'
                    ? '"Iris" बटन दबाएं और कैमरे में देखें।'
                    : 'Press "Iris" and look at the camera.');
                done(); return;
            }
            if (lower.includes('otp') || lower.includes('ओटीपी') || lower.includes('mobile') || lower.includes('मोबाइल')) {
                await say(L === 'hi'
                    ? '"OTP" बटन दबाएं, मोबाइल नंबर डालें। डेमो OTP: 482916।'
                    : 'Press "OTP", enter mobile. Demo OTP: 482916.');
                done(); return;
            }
        }

        // ── CITIZEN-REQUIRED FEATURES (naam badalna, pipeline, etc.) ──
        const hasNaam = lower.includes('naam') || lower.includes('name') || lower.includes('नाम बदल');
        const hasPipeline = lower.includes('pipeline') || lower.includes('gas line') || lower.includes('पाइपलाइन');
        const hasConnection = (lower.includes('naya') || lower.includes('नया')) && (lower.includes('connection') || lower.includes('कनेक्शन'));

        if (hasNaam || hasPipeline || hasConnection || matchesKeywords(transcript, CITIZEN_REQUIRED_KEYWORDS)) {
            log('🔐 Citizen-required feature');

            // Store intent for post-auth routing
            if (hasNaam) postAuthIntentRef.current = 'naam_change';
            else if (hasPipeline) postAuthIntentRef.current = 'pipeline';
            else if (hasConnection) postAuthIntentRef.current = 'new_connection';
            else postAuthIntentRef.current = 'dashboard';

            let msg;
            if (hasNaam) {
                msg = L === 'hi'
                    ? 'नाम बदलवाना है! इसके लिए आधार लॉगिन ज़रूरी है। मैं लॉगिन पेज पर ले जा रहा हूँ — अंगूठा लगाइए, बस 2-3 सेकंड में।'
                    : 'Name change needs Aadhaar login. Taking you to login — just thumbprint, 2-3 seconds.';
            } else if (hasPipeline) {
                msg = L === 'hi'
                    ? 'गैस पाइपलाइन के लिए आधार लॉगिन ज़रूरी है। अंगूठा लगाइए।'
                    : 'Gas pipeline needs Aadhaar login. Place your thumb.';
            } else if (hasConnection) {
                msg = L === 'hi'
                    ? 'नया कनेक्शन लगवाने के लिए आधार लॉगिन चाहिए। अंगूठा लगाइए।'
                    : 'New connection needs Aadhaar login.';
            } else {
                msg = L === 'hi'
                    ? 'इस सेवा के लिए आधार लॉगिन ज़रूरी है। मैं लॉगिन पेज पर ले जा रहा हूँ।'
                    : 'This needs Aadhaar login. Taking you to login.';
            }

            await say(msg);
            convStateRef.current = CONV_STATES.CITIZEN_AUTH;
            setScreen('citizen-auth');
            done(); return;
        }

        // ── COMMON Q&A ──
        const qa = findCommonAnswer(transcript, L);
        if (qa) {
            log('📚 Q&A');
            await say(qa);
            done(); return;
        }

        // ═══ STATE MACHINE ═══════════════════════════

        const state = convStateRef.current;

        if (state === CONV_STATES.WAIT_PATH || state === CONV_STATES.INITIAL) {
            if (matchesKeywords(transcript, CITIZEN_KEYWORDS)) {
                log('→ Citizen');
                convStateRef.current = CONV_STATES.CITIZEN_AUTH;
                await say(getResponse('citizen_chosen', L));
                setScreen('citizen-auth');
                done(); return;
            }

            if (matchesKeywords(transcript, GUEST_KEYWORDS)) {
                log('→ Guest');
                convStateRef.current = CONV_STATES.GUEST_HOME;
                setScreen('guest');
                navigate('/');
                await say(getResponse('guest_chosen', L));
                done(); return;
            }

            const billType = detectBillType(transcript);
            if (billType) {
                log(`→ Bill: ${billType}`);
                convStateRef.current = CONV_STATES.BILL_INPUT;
                setScreen('guest');
                navigate(`/bill/${billType}`);
                done(); return;
            }

            if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
                log('→ Complaint');
                convStateRef.current = CONV_STATES.COMPLAINT_CAT;
                setScreen('guest');
                navigate('/complaint');
                done(); return;
            }
        }

        // Any state: direct nav
        const billType = detectBillType(transcript);
        if (billType) {
            log(`→ Bill: ${billType}`);
            navigate(`/bill/${billType}`);
            done(); return;
        }
        if (matchesKeywords(transcript, COMPLAINT_KEYWORDS)) {
            log('→ Complaint');
            navigate('/complaint');
            done(); return;
        }

        // ── GEMINI FALLBACK ──
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
                if (!bargedInRef.current) {
                    // Repeat page guidance instead of generic "maph kijiye"
                    const pageHelp = getCurrentGuidance(L);
                    await say(pageHelp);
                }
            }
        } else {
            if (!bargedInRef.current) {
                const pageHelp = getCurrentGuidance(L);
                await say(pageHelp);
            }
        }

        done();
    }, [navigate, setScreen, log, ttsSpeak, queueTTS]);

    // ══════════════════════════════════════════════════
    // SCREEN CHANGE → Cancel old + speak new
    // ══════════════════════════════════════════════════

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        if (screen === lastScreenRef.current) return;

        const prevScreen = lastScreenRef.current;
        lastScreenRef.current = screen;
        log(`📺 Screen: ${prevScreen} → ${screen}`);

        if (!prevScreen || screen === 'idle') return;

        // Cancel old TTS
        window.speechSynthesis?.cancel();
        isSpeakingRef.current = false;
        bargedInRef.current = true;

        const speakGuidance = async () => {
            if (!isActiveRef.current) return;
            bargedInRef.current = false;

            // Post-auth intent routing
            if (screen === 'citizen-dashboard' && postAuthIntentRef.current) {
                const intent = postAuthIntentRef.current;
                postAuthIntentRef.current = null;
                const L = langRef.current;

                let msg;
                if (intent === 'naam_change') {
                    msg = L === 'hi'
                        ? 'लॉगिन हो गया! नाम बदलने के लिए नीचे "✏️ Name Change" बटन दबाएं।'
                        : 'Logged in! Press "✏️ Name Change" below.';
                } else if (intent === 'pipeline') {
                    msg = L === 'hi'
                        ? 'लॉगिन हो गया! गैस पाइपलाइन के लिए "Apply New Connection" दबाएं।'
                        : 'Logged in! Press "Apply New Connection".';
                } else if (intent === 'new_connection') {
                    msg = L === 'hi'
                        ? 'लॉगिन हो गया! नया कनेक्शन के लिए "🆕 Apply New Connection" दबाएं।'
                        : 'Logged in! Press "🆕 Apply New Connection".';
                } else {
                    const g = SCREEN_GUIDANCE['citizen-dashboard'];
                    msg = g?.[L] || g?.en || '';
                }

                log(`🎯 Post-auth: ${intent}`);
                setLastReply(msg);
                await ttsSpeak(msg, langRef.current);
                if (isActiveRef.current) setStatus('listening');
                return;
            }

            const g = SCREEN_GUIDANCE[screen];
            if (g) {
                const text = g[langRef.current] || g.en;
                log(`📍 Screen: ${screen}`);
                setLastReply(text);
                await ttsSpeak(text, langRef.current);
                if (isActiveRef.current) setStatus('listening');
            }
        };

        setTimeout(speakGuidance, 600);
    }, [screen, voiceMode, log, ttsSpeak]);

    // Route change → cancel old + speak new
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
            setTimeout(async () => {
                if (isActiveRef.current) {
                    bargedInRef.current = false;
                    setLastReply(guidance);
                    await ttsSpeak(guidance, langRef.current);
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

        // Start recognition FIRST so it's ready when greeting ends
        startRecognition();

        const greeting = getInitialGreeting(langRef.current);
        setLastReply(greeting);
        setStatus('speaking');
        await ttsSpeak(greeting, langRef.current);

        if (isActiveRef.current) {
            log('📢 Listening');
            setStatus('listening');
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

    // Cleanup
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
                                    {lastReply?.substring(0, 90)}{lastReply?.length > 90 ? '...' : ''}
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
