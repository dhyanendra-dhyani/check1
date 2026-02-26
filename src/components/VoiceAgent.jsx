/**
 * ═══════════════════════════════════════════════════════════
 * VoiceAgent — Invisible Continuous Voice Controller
 *
 * Renders NO visible UI elements. Instead:
 *   • Provides voice context (activate/deactivate) to all screens
 *   • Uses Web Speech API for instant STT (no audio upload)
 *   • Hardcoded responses from voiceFlowEngine (0ms latency)
 *   • Gemini API fallback only for unknown questions
 *   • Continuous loop: listen → process → speak → listen again
 *   • Minimal status overlays only (bottom bar indicators)
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import VoiceContext from './VoiceContext';
import { processVoiceFlow, getScreenGreeting, getSpeechLangCode } from '../utils/voiceFlowEngine';
import { sendTextToGemini, speakText, stopSpeaking } from '../utils/geminiVoiceAgent';

const VoiceAgent = memo(function VoiceAgent({
    lang,
    setLang,
    screen,
    setScreen,
    navigate,
    setCitizen,
    addLog,
    children,
}) {
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState('idle'); // idle | listening | processing | speaking
    const [lastTranscript, setLastTranscript] = useState('');
    const [lastReply, setLastReply] = useState('');
    const recognitionRef = useRef(null);
    const isSpeakingRef = useRef(false);
    const isActiveRef = useRef(false);
    const langRef = useRef(lang);
    const screenRef = useRef(screen);
    const locationRef = useRef('/');

    // Keep refs in sync
    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { screenRef.current = screen; }, [screen]);

    // Track current path for flow engine
    useEffect(() => {
        locationRef.current = window.location.pathname;
        const observer = new MutationObserver(() => {
            locationRef.current = window.location.pathname;
        });
        observer.observe(document.querySelector('body'), { childList: true, subtree: true });
        return () => observer.disconnect();
    }, []);

    /** Start Web Speech API recognition */
    const startListening = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            addLog?.('Voice: SpeechRecognition not supported');
            return;
        }

        // Stop any existing recognition
        try { recognitionRef.current?.stop(); } catch { }

        const r = new SR();
        r.lang = getSpeechLangCode(langRef.current);
        r.continuous = false;
        r.interimResults = true;
        r.maxAlternatives = 1;

        r.onresult = (e) => {
            const result = e.results[e.results.length - 1];
            if (result.isFinal) {
                const transcript = result[0].transcript.trim();
                if (transcript) {
                    setLastTranscript(transcript);
                    handleTranscript(transcript);
                }
            }
        };

        r.onerror = (e) => {
            if (e.error === 'no-speech' || e.error === 'aborted') {
                // Silence or user hasn't spoken — restart if still active
                if (isActiveRef.current && !isSpeakingRef.current) {
                    setTimeout(() => startListening(), 300);
                }
                return;
            }
            addLog?.(`Voice error: ${e.error}`);
            setStatus('idle');
        };

        r.onend = () => {
            // Auto-restart listening if still active and not speaking
            if (isActiveRef.current && !isSpeakingRef.current) {
                setTimeout(() => startListening(), 200);
            }
        };

        recognitionRef.current = r;
        r.start();
        setStatus('listening');
    }, [addLog]);

    /** Process a transcript through the flow engine */
    const handleTranscript = useCallback(async (transcript) => {
        setStatus('processing');
        addLog?.(`Voice heard: "${transcript}"`);

        const result = processVoiceFlow(
            transcript,
            langRef.current,
            screenRef.current,
            locationRef.current
        );

        // Should stop?
        if (result.shouldStop) {
            await respond(result.text);
            deactivateVoice();
            return;
        }

        // Has hardcoded response?
        if (!result.needsGemini && result.text) {
            await respond(result.text);
            executeAction(result);
            return;
        }

        // Fallback to Gemini
        try {
            const geminiResult = await sendTextToGemini(transcript, langRef.current, screenRef.current);
            await respond(geminiResult.reply);
            // If Gemini detected navigation intent
            if (geminiResult.intent === 'navigate' && geminiResult.action_key) {
                executeAction({
                    action: 'navigate',
                    route: `/bill/${geminiResult.action_key}`,
                });
            }
        } catch (err) {
            console.error('Gemini fallback error:', err);
            const fallback = langRef.current === 'hi'
                ? 'माफ़ कीजिए, समझ नहीं आया। कृपया फिर से बोलें।'
                : 'Sorry, I didn\'t understand. Please try again.';
            await respond(fallback);
        }
    }, [addLog]);

    /** Speak a response and resume listening after */
    const respond = useCallback(async (text) => {
        if (!text) return;
        setLastReply(text);
        setStatus('speaking');
        isSpeakingRef.current = true;

        try {
            await speakText(text, langRef.current);
        } catch (err) {
            console.error('TTS error:', err);
        }

        isSpeakingRef.current = false;
        // Resume listening if still active
        if (isActiveRef.current) {
            setStatus('listening');
            startListening();
        } else {
            setStatus('idle');
        }
    }, [startListening]);

    /** Execute navigation/screen changes */
    const executeAction = useCallback((result) => {
        if (!result) return;

        if (result.action === 'navigate' && result.route) {
            setTimeout(() => {
                navigate(result.route);
                addLog?.(`Voice nav → ${result.route}`);
            }, 500);
        } else if (result.action === 'go_back') {
            setTimeout(() => navigate(-1), 500);
        } else if (result.action === 'go_home') {
            setTimeout(() => navigate('/'), 500);
        } else if (result.action === 'set_screen' && result.screenChange) {
            setTimeout(() => {
                if (result.screenChange === 'citizen') {
                    setScreen('citizen-auth');
                } else {
                    setScreen('guest');
                    navigate('/');
                }
                // If a specific route was also requested (e.g. user asked for bijli from gateway)
                if (result.route) {
                    setTimeout(() => navigate(result.route), 400);
                }
                addLog?.(`Voice: screen → ${result.screenChange}`);
            }, 500);
        }
    }, [navigate, setScreen, addLog]);

    /** Activate the voice agent — starts greeting + listening loop */
    const activateVoice = useCallback(() => {
        if (isActiveRef.current) return;
        isActiveRef.current = true;
        setIsActive(true);
        setLastTranscript('');
        setLastReply('');
        stopSpeaking();
        addLog?.('Voice agent activated');

        // Speak greeting first, then start listening
        const greeting = getScreenGreeting(screenRef.current, langRef.current);
        respond(greeting);
    }, [respond, addLog]);

    /** Deactivate — stop everything */
    const deactivateVoice = useCallback(() => {
        isActiveRef.current = false;
        setIsActive(false);
        setStatus('idle');
        isSpeakingRef.current = false;
        stopSpeaking();
        try { recognitionRef.current?.stop(); } catch { }
        addLog?.('Voice agent deactivated');
    }, [addLog]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            try { recognitionRef.current?.stop(); } catch { }
            stopSpeaking();
        };
    }, []);

    const contextValue = {
        isActive,
        status,
        activate: activateVoice,
        deactivate: deactivateVoice,
        lastTranscript,
        lastReply,
    };

    return (
        <VoiceContext.Provider value={contextValue}>
            {children}

            {/* ═══ MINIMAL STATUS OVERLAYS ═══ */}
            {/* These are the ONLY visible elements — thin bottom bars */}

            {/* Listening indicator */}
            {status === 'listening' && isActive && (
                <div className="vo-status-bar vo-status-listening fast-fade-in">
                    <div className="vo-status-waves">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="vo-status-wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
                        ))}
                    </div>
                    <span>
                        {lang === 'hi' ? 'सुन रहा हूँ... बोलिए' : lang === 'pa' ? 'ਸੁਣ ਰਿਹਾ ਹਾਂ...' : 'Listening... speak now'}
                    </span>
                    <button className="vo-status-stop" onClick={deactivateVoice}>✕</button>
                </div>
            )}

            {/* Processing indicator */}
            {status === 'processing' && (
                <div className="vo-status-bar vo-status-processing fast-fade-in">
                    <div className="vo-status-spinner" />
                    <span>{lang === 'hi' ? 'समझ रहा हूँ...' : 'Understanding...'}</span>
                    {lastTranscript && <span className="vo-status-transcript">"{lastTranscript}"</span>}
                </div>
            )}

            {/* Speaking indicator */}
            {status === 'speaking' && (
                <div className="vo-status-bar vo-status-speaking fast-fade-in">
                    <div className="vo-status-waves">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="vo-status-speak-bar" style={{ animationDelay: `${i * 0.1}s` }} />
                        ))}
                    </div>
                    <span className="vo-status-reply">{lastReply?.substring(0, 80)}{lastReply?.length > 80 ? '...' : ''}</span>
                    <button className="vo-status-stop" onClick={() => { stopSpeaking(); isSpeakingRef.current = false; setStatus('listening'); startListening(); }}>⏭</button>
                </div>
            )}
        </VoiceContext.Provider>
    );
});

export default VoiceAgent;
