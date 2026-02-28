/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent v19 — Bulletproof Listening + Blind Mode
 *
 * KEY IMPROVEMENTS over v18:
 *   1. isRecognizingRef tracks ACTUAL running state, not just object existence
 *   2. forceRestartRecognition() — unconditional kill+restart
 *   3. Proactive announcements on EVERY page/route change
 *   4. Blind mode: passes pageData to Gemini for full screen reading
 *   5. Open-ended conversation — no option limits
 *   6. Recognition lifecycle is bulletproof
 *
 * Architecture:
 *   - Recognition runs CONTINUOUSLY (never paused during TTS)
 *   - Gemini handles ALL conversation intelligence
 *   - Gemini TTS primary, browser SpeechSynthesis fallback
 *   - Smart barge-in: user speaks → cancel TTS → process immediately
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useLocation } from 'react-router-dom';
import VoiceContext from './VoiceContext';
import { getAssistantGuidance, getProactiveHelp, resetChatSession } from '../utils/geminiService';
import { playClickSound, playSuccessSound } from '../utils/audioService';

const SPEECH_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
    gu: 'gu-IN', ml: 'ml-IN', ur: 'ur-IN',
};

const VoiceAgent = memo(function VoiceAgent({
    lang, setLang, screen, setScreen, voiceMode,
    navigate, setCitizen, addLog, blindMode: blindModeProp, setBlindMode: setBlindModeProp, children,
}) {
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState('idle');
    const [lastTranscript, setLastTranscript] = useState('');
    const [lastReply, setLastReply] = useState('');
    const [interimText, setInterimText] = useState('');
    const [pageData, setPageData] = useState(null);

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
    const historyRef = useRef([]);
    const rePromptTimerRef = useRef(null);
    const rePromptCountRef = useRef(0);
    const hasInteractedRef = useRef(false);
    const isRecognizingRef = useRef(false);  // TRUE = recognition is actually running
    const recGenRef = useRef(0);  // generation counter prevents stale callbacks
    const geminiTtsAudioRef = useRef(null);
    const ttsResolverRef = useRef(null);
    const pageDataRef = useRef(null);
    const blindModeRef = useRef(blindModeProp || false);
    // Guard against double-greeting on initial mount
    const initialGreetingDoneRef = useRef(false);

    const location = useLocation();

    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { screenRef.current = screen; }, [screen]);
    useEffect(() => { pageDataRef.current = pageData; }, [pageData]);
    useEffect(() => { blindModeRef.current = blindModeProp || false; }, [blindModeProp]);

    const log = useCallback((msg) => {
        console.log(`[VA] ${msg}`);
        addLog?.(msg);
    }, [addLog]);

    // ══════════════════════════════════════════════════
    // STOP ALL TTS — resolves pending promises
    // ══════════════════════════════════════════════════

    const stopAllTTS = useCallback(() => {
        window.speechSynthesis?.cancel();
        if (geminiTtsAudioRef.current) {
            try {
                geminiTtsAudioRef.current.pause();
                geminiTtsAudioRef.current.currentTime = 0;
            } catch { }
            geminiTtsAudioRef.current = null;
        }
        isSpeakingRef.current = false;
        // Resolve any pending TTS promise so pipeline doesn't hang
        if (ttsResolverRef.current) {
            ttsResolverRef.current();
            ttsResolverRef.current = null;
        }
    }, []);

    // ══════════════════════════════════════════════════
    // TTS — Direct browser SpeechSynthesis (fast, reliable)
    // Gemini TTS SDK was removed: it always fails, blocks for
    // seconds, and kills recognition while waiting.
    // ══════════════════════════════════════════════════

    const ttsSpeak = useCallback((text, langCode) => {
        return new Promise((resolve) => {
            if (!text || bargedInRef.current) {
                isSpeakingRef.current = false;
                resolve();
                return;
            }

            isSpeakingRef.current = true;
            setStatus('speaking');
            ttsResolverRef.current = resolve;

            if (!window.speechSynthesis) {
                isSpeakingRef.current = false;
                ttsResolverRef.current = null;
                resolve();
                return;
            }

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            const u = new SpeechSynthesisUtterance(text);
            u.lang = SPEECH_LANGS[langCode] || 'hi-IN';
            u.rate = 1.05;
            u.pitch = 1;
            u.volume = 1;

            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang === u.lang) || voices.find(v => v.lang.startsWith(langCode));
            if (v) u.voice = v;

            const finish = () => {
                isSpeakingRef.current = false;
                ttsResolverRef.current = null;
                setStatus('listening');
                // CRITICAL: force-restart recognition after every TTS completion
                if (isActiveRef.current && !isRecognizingRef.current) {
                    try { recognitionRef.current?.abort(); } catch { }
                    recognitionRef.current = null;
                    isRecognizingRef.current = false;
                }
                resolve();
            };

            u.onend = finish;
            u.onerror = finish;

            // Safety: if onend never fires (Chrome bug), force-resolve after text length * 80ms + 3s
            const safetyMs = Math.max(text.length * 80, 3000) + 3000;
            const safetyTimer = setTimeout(() => {
                if (isSpeakingRef.current) {
                    console.warn('[VA] TTS safety timeout — force finishing');
                    window.speechSynthesis.cancel();
                    finish();
                }
            }, safetyMs);

            const origFinish = finish;
            u.onend = () => { clearTimeout(safetyTimer); origFinish(); };
            u.onerror = () => { clearTimeout(safetyTimer); origFinish(); };

            window.speechSynthesis.speak(u);
        });
    }, []);

    // ═══ RE-PROMPT ═══════════════════════════════════

    const RE_PROMPTS = [
        { hi: 'बोलिए, मैं सुन रहा हूँ। क्या करना है बताइए।', en: 'I\'m listening. What would you like to do?' },
        { hi: 'अभी भी यहाँ हूँ। बताइए क्या मदद चाहिए?', en: 'Still here. How can I help?' },
        { hi: 'कोई बात नहीं, जब चाहें बोलिए।', en: 'No worries, speak whenever you\'re ready.' },
    ];

    const startRePromptTimer = useCallback(() => {
        clearTimeout(rePromptTimerRef.current);
        if (!isActiveRef.current) return;
        rePromptTimerRef.current = setTimeout(async () => {
            if (!isActiveRef.current || processingRef.current || isSpeakingRef.current) return;
            const idx = Math.min(rePromptCountRef.current, RE_PROMPTS.length - 1);
            const rp = RE_PROMPTS[idx];
            const text = rp[langRef.current] || rp.en;
            log(`🔁 Re-prompt #${rePromptCountRef.current + 1}`);
            setLastReply(text);
            await ttsSpeak(text, langRef.current);
            rePromptCountRef.current++;
            if (isActiveRef.current && rePromptCountRef.current < 3) startRePromptTimer();
        }, 15000);
    }, [log, ttsSpeak]);

    // ══════════════════════════════════════════════════
    // RECOGNITION — Continuous, never paused
    // Barge-in processes transcript immediately
    // ══════════════════════════════════════════════════

    const startRecognition = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR || !isActiveRef.current) return;

        // Kill any existing recognition
        try { recognitionRef.current?.abort(); } catch { }
        recognitionRef.current = null;
        isRecognizingRef.current = false;

        // Generation counter prevents stale onend/onerror from restarting old instances
        const gen = ++recGenRef.current;

        const r = new SR();
        r.lang = SPEECH_LANGS[langRef.current] || 'hi-IN';
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 1;

        r.onstart = () => {
            if (gen !== recGenRef.current) return; // stale
            log('🎧 Recognition started');
            isRecognizingRef.current = true;
            restartCountRef.current = 0;
            if (!isSpeakingRef.current) setStatus('listening');
        };

        r.onresult = (e) => {
            if (gen !== recGenRef.current) return; // stale
            const last = e.results[e.results.length - 1];

            // ═══ SMART BARGE-IN ═══
            if (isSpeakingRef.current) {
                if (last.isFinal) {
                    const conf = last[0].confidence || 0;
                    const txt = last[0].transcript.trim();
                    if (conf > 0.4 && txt.length >= 2) {
                        log(`🔇 Barge-in: "${txt}" (${(conf * 100).toFixed(0)}%)`);
                        stopAllTTS();
                        bargedInRef.current = true;
                        setStatus('listening');
                    } else {
                        return;
                    }
                } else {
                    const interimTxt = last[0].transcript.trim();
                    if (interimTxt.length >= 4) {
                        log(`🔇 Barge-in (interim): "${interimTxt}"`);
                        stopAllTTS();
                        bargedInRef.current = true;
                        setStatus('listening');
                    }
                    return;
                }
            }

            clearTimeout(rePromptTimerRef.current);

            if (last.isFinal) {
                const t = last[0].transcript.trim();
                const confidence = last[0].confidence || 0;

                if (t.length < 2) return;
                if (confidence > 0 && confidence < 0.3) { log(`🔇 Low: "${t}"`); return; }
                const NOISE = ['hmm', 'hm', 'uh', 'uhh', 'ah', 'ahh', 'um', 'umm', 'oh', 'mm', 'ha', 'aah'];
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
                if (!isSpeakingRef.current) setStatus('listening');

                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    const t = lastInterimRef.current?.trim();
                    if (t && t.length > 1 && !processingRef.current && !isSpeakingRef.current) {
                        log(`⏱️ Silence commit: "${t}"`);
                        handleTranscript(t);
                        lastInterimRef.current = '';
                        setInterimText('');
                    }
                }, 1200);
            }
        };

        r.onerror = (e) => {
            if (gen !== recGenRef.current) return; // stale
            isRecognizingRef.current = false;
            // no-speech and aborted are normal — restart quickly
            if (['no-speech', 'aborted'].includes(e.error)) {
                if (isActiveRef.current) setTimeout(() => startRecognition(), 150);
                return;
            }
            log(`⚠️ Rec error: ${e.error}`);
            if (isActiveRef.current) setTimeout(() => startRecognition(), 300);
        };

        r.onend = () => {
            if (gen !== recGenRef.current) return; // stale — new instance superseded us
            isRecognizingRef.current = false;
            recognitionRef.current = null;
            // ALWAYS restart unless deactivated
            if (isActiveRef.current) {
                setTimeout(() => startRecognition(), 80);
            }
        };

        recognitionRef.current = r;
        try {
            r.start();
        } catch (err) {
            log(`⚠️ Rec start fail: ${err.message}`);
            isRecognizingRef.current = false;
            recognitionRef.current = null;
            if (isActiveRef.current) setTimeout(() => startRecognition(), 300);
        }
    }, [log, stopAllTTS]);

    // ══════════════════════════════════════════════════
    // HANDLE TRANSCRIPT — Gemini-powered intelligence
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
        log(`🎤 "${transcript}"`);

        const L = langRef.current;

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
            if (isActiveRef.current && !bargedInRef.current) {
                setStatus('listening');
                startRePromptTimer();
                // FORCE restart recognition — don't just check, GUARANTEE it's running
                log('🔄 Post-processing: force-restarting recognition');
                try { recognitionRef.current?.abort(); } catch { }
                recognitionRef.current = null;
                isRecognizingRef.current = false;
                setTimeout(() => startRecognition(), 200);
            }
        };

        // ═══ TRY KNOWLEDGE BASE FIRST (instant, no API) ═══
        try {
            const { findCommonAnswer } = await import('../utils/voiceKnowledgeBase');
            const kbResult = findCommonAnswer(transcript, L);
            if (kbResult && kbResult.text) {
                log(`📚 KB match: "${kbResult.text.substring(0, 50)}..."`);
                playClickSound();
                hasInteractedRef.current = true;
                historyRef.current = [
                    ...historyRef.current.slice(-8),
                    `User: ${transcript}`,
                    `Assistant: ${kbResult.text}`
                ];
                if (!bargedInRef.current) await say(kbResult.text);
                if (!bargedInRef.current && kbResult.action) {
                    log(`🎯 KB Action: ${kbResult.action}`);
                    executeAction(kbResult.action, {});
                }
                done();
                return;
            }
        } catch (kbErr) {
            log(`⚠️ KB lookup error: ${kbErr.message}`);
        }

        // ═══ FALLBACK: SEND TO GEMINI ═══
        try {
            playClickSound();
            hasInteractedRef.current = true;

            const result = await getAssistantGuidance(
                transcript,
                screenRef.current,
                window.location.pathname,
                L,
                historyRef.current,
                blindModeRef.current,
                pageDataRef.current
            );

            // Update history
            historyRef.current = [
                ...historyRef.current.slice(-8),
                `User: ${transcript}`,
                `Assistant: ${result.text || ''}`
            ];

            // Speak the response
            if (result.text && !bargedInRef.current) {
                await say(result.text);
            }

            // Execute action
            if (!bargedInRef.current && result.action) {
                log(`🎯 Action: ${result.action}`);
                executeAction(result.action, result.params);
            }

        } catch (err) {
            log(`❌ Gemini: ${err.message}`);
            if (!bargedInRef.current) {
                const fallbackMsg = L === 'hi'
                    ? 'माफ़ कीजिए, कुछ समस्या हुई। कृपया फिर से बोलिए।'
                    : 'Sorry, there was an issue. Please try again.';
                await say(fallbackMsg);
            }
        }

        done();
    }, [log, ttsSpeak, startRePromptTimer]);

    // ═══ FORCE RESTART RECOGNITION ═══
    // Unconditional: abort whatever exists, start fresh
    const forceRestartRecognition = useCallback(() => {
        if (!isActiveRef.current) return;
        log('🔄 Force-restarting recognition');
        try { recognitionRef.current?.abort(); } catch { }
        recognitionRef.current = null;
        isRecognizingRef.current = false;
        setTimeout(() => startRecognition(), 150);
    }, [log, startRecognition]);

    // ═══ ENSURE RECOGNITION IS ALIVE ═══
    // Checks the ACTUAL running state, not just object existence
    const ensureRecognitionAlive = useCallback(() => {
        if (!isActiveRef.current) return;
        if (!isRecognizingRef.current) {
            log('🔄 Recognition not running, force-restarting');
            forceRestartRecognition();
        }
    }, [log, forceRestartRecognition]);

    // ══════════════════════════════════════════════════
    // ACTION EXECUTOR — maps Gemini actions to navigation
    // ══════════════════════════════════════════════════

    const executeAction = useCallback((action, params) => {
        switch (action) {
            case 'navigate_to_gateway':
                setScreen('gateway');
                break;
            case 'set_screen_guest':
                setScreen('guest');
                navigate('/');
                break;
            case 'set_screen_citizen_auth':
                setScreen('citizen-auth');
                break;
            case 'navigate_bill_electricity':
                setScreen('guest');
                navigate('/bill/electricity');
                break;
            case 'navigate_bill_water':
                setScreen('guest');
                navigate('/bill/water');
                break;
            case 'navigate_bill_gas':
                setScreen('guest');
                navigate('/bill/gas');
                break;
            case 'navigate_complaint':
                setScreen('guest');
                navigate('/complaint');
                break;
            case 'navigate_home':
                navigate('/');
                break;
            case 'navigate_admin':
                navigate('/admin');
                break;
            case 'go_back':
                navigate(-1);
                break;
            case 'stop_voice':
                deactivateVoice();
                break;
            default:
                // Handle legacy intent format from Gemini
                if (action === 'navigate' && params?.route) {
                    navigate(params.route);
                } else if (action === 'set_screen' && params?.screen) {
                    setScreen(params.screen);
                }
                break;
        }
    }, [navigate, setScreen]);

    // ══════════════════════════════════════════════════
    // SCREEN/ROUTE CHANGE → Proactive help
    // Ensures recognition stays alive after changes
    // ══════════════════════════════════════════════════

    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        if (screen === lastScreenRef.current) return;

        const prevScreen = lastScreenRef.current;
        lastScreenRef.current = screen;
        log(`📺 Screen: ${prevScreen} → ${screen}`);

        if (!prevScreen || screen === 'idle') return;

        // Cancel old TTS immediately
        stopAllTTS();
        bargedInRef.current = true;

        // Success sound on auth completion
        if (prevScreen === 'citizen-auth' && screen === 'citizen-dashboard') {
            playSuccessSound();
        }

        const speakGuidance = async () => {
            if (!isActiveRef.current) return;
            bargedInRef.current = false;

            // ALWAYS ensure recognition is running after screen change
            ensureRecognitionAlive();

            try {
                const proactive = await getProactiveHelp(
                    screen,
                    window.location.pathname,
                    langRef.current,
                    historyRef.current,
                    blindModeRef.current,
                    pageDataRef.current
                );
                if (proactive.text && isActiveRef.current && !bargedInRef.current) {
                    setLastReply(proactive.text);
                    await ttsSpeak(proactive.text, langRef.current);
                    if (isActiveRef.current) {
                        setStatus('listening');
                        startRePromptTimer();
                        ensureRecognitionAlive();
                    }
                } else if (isActiveRef.current) {
                    setStatus('listening');
                    startRePromptTimer();
                    ensureRecognitionAlive();
                }
            } catch (err) {
                log(`⚠️ Proactive help error: ${err.message}`);
                if (isActiveRef.current) {
                    setStatus('listening');
                    startRePromptTimer();
                    ensureRecognitionAlive();
                }
            }
        };

        setTimeout(speakGuidance, 600);
    }, [screen, voiceMode, log, ttsSpeak, stopAllTTS, startRePromptTimer, startRecognition, ensureRecognitionAlive]);

    // Route change → proactive help
    useEffect(() => {
        if (!isActiveRef.current || !voiceMode) return;
        const currentPath = location.pathname;
        if (currentPath === lastRouteRef.current) return;

        const prevPath = lastRouteRef.current;
        lastRouteRef.current = currentPath;
        log(`📍 Route: ${prevPath} → ${currentPath}`);

        stopAllTTS();
        bargedInRef.current = true;

        const speakGuidance = async () => {
            if (!isActiveRef.current) return;
            bargedInRef.current = false;

            // ALWAYS ensure recognition is running after route change
            ensureRecognitionAlive();

            try {
                const proactive = await getProactiveHelp(
                    screenRef.current,
                    currentPath,
                    langRef.current,
                    historyRef.current,
                    blindModeRef.current,
                    pageDataRef.current
                );
                if (proactive.text && isActiveRef.current && !bargedInRef.current) {
                    setLastReply(proactive.text);
                    await ttsSpeak(proactive.text, langRef.current);
                    if (isActiveRef.current) {
                        setStatus('listening');
                        startRePromptTimer();
                        ensureRecognitionAlive();
                    }
                } else if (isActiveRef.current) {
                    setStatus('listening');
                    ensureRecognitionAlive();
                }
            } catch (err) {
                log(`⚠️ Route guidance error: ${err.message}`);
                if (isActiveRef.current) {
                    setStatus('listening');
                    ensureRecognitionAlive();
                }
            }
        };

        setTimeout(speakGuidance, 400);
    }, [location.pathname, voiceMode, log, ttsSpeak, stopAllTTS, startRecognition, startRePromptTimer, ensureRecognitionAlive]);

    // ═══ PERIODIC RECOGNITION HEALTH CHECK (1.5s) ═══
    // Runs ALWAYS while active — checks every 1.5s and force-restarts if dead
    useEffect(() => {
        if (!isActive) return;
        const interval = setInterval(() => {
            if (!isActiveRef.current) return;
            // Always check, even during speaking (recognition should still be running)
            if (!isRecognizingRef.current && !processingRef.current) {
                log('🔄 Health check: recognition dead → force-restarting');
                try { recognitionRef.current?.abort(); } catch { }
                recognitionRef.current = null;
                isRecognizingRef.current = false;
                startRecognition();
            }
        }, 1500);
        return () => clearInterval(interval);
    }, [isActive, startRecognition, log]);

    // ═══ ACTIVATE ═══════════════════════════════════

    const activateVoice = useCallback(async () => {
        if (isActiveRef.current) return;
        isActiveRef.current = true;
        setIsActive(true);
        setLastTranscript('');
        setLastReply('');
        setInterimText('');
        stopAllTTS();
        restartCountRef.current = 0;
        rePromptCountRef.current = 0;
        lastRouteRef.current = window.location.pathname;
        lastScreenRef.current = screen;
        pendingTranscriptRef.current = null;
        historyRef.current = [];
        initialGreetingDoneRef.current = false;
        log('🟢 Activated');

        // Start recognition FIRST so it's ready when greeting ends
        startRecognition();

        // Feature-listing greeting — tells user what services are available
        // Barge-in is active so user can interrupt as soon as they hear their need
        const isBlind = blindModeRef.current;
        let greeting;
        if (isBlind) {
            greeting = langRef.current === 'hi'
                ? 'नमस्ते! मैं सुविधा हूँ, आपकी सहायक। यहाँ आप ये सब कर सकते हैं — बिजली, पानी, गैस का बिल भरना, नया कनेक्शन लेना, नाम बदलवाना, Property Tax भरना, शिकायत दर्ज करना, और रसीद डाउनलोड करना। जब चाहें बीच में बोल दीजिए, मैं सुन रही हूँ। बताइए क्या करना है?'
                : 'Hello! I\'m SUVIDHA, your assistant. Here you can pay electricity, water, gas bills, apply for new connections, change names, pay property tax, file complaints, and download receipts. Feel free to interrupt anytime — I\'m listening. What would you like to do?';
        } else {
            greeting = langRef.current === 'hi'
                ? 'नमस्ते! मैं सुविधा हूँ। यहाँ आप बिजली, पानी, गैस बिल भर सकते हैं, शिकायत दर्ज कर सकते हैं, नया कनेक्शन ले सकते हैं, नाम बदलवा सकते हैं, और Property Tax भर सकते हैं। बताइए क्या करना है?'
                : 'Hello! I\'m SUVIDHA. You can pay electricity, water, gas bills, file complaints, apply for new connections, change names, and pay property tax. What would you like to do?';
        }

        setLastReply(greeting);
        setStatus('speaking');
        await ttsSpeak(greeting, langRef.current);

        if (isActiveRef.current) {
            initialGreetingDoneRef.current = true;
            log('📢 Listening');
            setStatus('listening');
            // Force-restart recognition after greeting TTS
            startRecognition();
            startRePromptTimer();
        }
    }, [screen, startRecognition, startRePromptTimer, log, ttsSpeak, stopAllTTS]);

    // ═══ DEACTIVATE ═════════════════════════════════

    const deactivateVoice = useCallback(() => {
        isActiveRef.current = false;
        setIsActive(false);
        setStatus('idle');
        setInterimText('');
        isSpeakingRef.current = false;
        processingRef.current = false;
        pendingTranscriptRef.current = null;
        stopAllTTS();
        clearTimeout(silenceTimerRef.current);
        clearTimeout(rePromptTimerRef.current);
        try { recognitionRef.current?.abort(); } catch { }
        recognitionRef.current = null;
        resetChatSession();
        log('🔴 Deactivated');
    }, [log, stopAllTTS]);

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
            recognitionRef.current = null;
            stopAllTTS();
            clearTimeout(rePromptTimerRef.current);
            clearTimeout(silenceTimerRef.current);
        };
    }, [stopAllTTS]);

    const ctx = {
        voiceMode, isActive, status, lastTranscript, lastReply,
        blindMode: blindModeProp || false,
        setBlindMode: setBlindModeProp || (() => { }),
        pageData, setPageData,
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
                            ? () => { stopAllTTS(); bargedInRef.current = true; setStatus('listening'); }
                            : deactivateVoice}>
                        {status === 'speaking' ? '⏭' : '✕'}
                    </button>
                </div>
            )}
        </VoiceContext.Provider>
    );
});

export default VoiceAgent;
