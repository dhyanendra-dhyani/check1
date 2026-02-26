/**
 * ═══════════════════════════════════════════════════════════
 * VoiceButton — Reusable mic component v3.0 (Zero Framer-Motion)
 * Uses CSS keyframes for pulse and waveform animations.
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef } from 'react';
import { startSpeechRecognition, isSpeechRecognitionSupported } from '../utils/voiceCommands';

export default function VoiceButton({
    lang = 'en',
    size = 100,
    showLabel = false,
    labelText = 'Tap to speak',
    onResult,
    onError,
    className = '',
}) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const stopRef = useRef(null);

    const handleStart = useCallback(() => {
        if (!isSpeechRecognitionSupported()) {
            onError?.('Speech recognition not supported');
            return;
        }

        setIsListening(true);
        setTranscript('');

        const stop = startSpeechRecognition(
            lang,
            (text) => {
                setTranscript(text);
                setIsListening(false);
                onResult?.(text);
                setTimeout(() => setTranscript(''), 4000);
            },
            (err) => {
                setIsListening(false);
                onError?.(err);
            },
            () => setIsListening(false),
        );
        stopRef.current = stop;
    }, [lang, onResult, onError]);

    const handleStop = useCallback(() => {
        if (stopRef.current) stopRef.current();
        setIsListening(false);
    }, []);

    const supported = isSpeechRecognitionSupported();
    const iconSize = Math.max(size * 0.35, 20);

    return (
        <div className={`flex flex-col items-center gap-2 ${className}`}>
            <button
                onClick={isListening ? handleStop : handleStart}
                disabled={!supported}
                className={`rounded-full flex items-center justify-center cursor-pointer border-2 transition-all hover:scale-105 active:scale-95 ${isListening ? 'mic-pulse' : ''}`}
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    background: isListening
                        ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                        : 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(99,102,241,0.1))',
                    borderColor: isListening ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.35)',
                    backdropFilter: 'blur(12px)', // Kept blur here as it's small and circular
                }}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                aria-pressed={isListening}
            >
                {isListening ? (
                    /* Waveform bars */
                    <div className="flex items-center gap-1 h-1/2">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1 bg-white rounded-full animate-pulse"
                                style={{
                                    height: `${Math.random() * 60 + 40}%`,
                                    animationDelay: `${i * 0.1}s`,
                                    animationDuration: '0.6s'
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    /* Mic icon */
                    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                )}
            </button>

            {/* Label */}
            {showLabel && (
                <p className="text-white/40 text-sm font-medium text-center">
                    {isListening ? 'Listening...' : (supported ? labelText : 'Voice not supported')}
                </p>
            )}

            {/* Transcript bubble */}
            {transcript && (
                <div className="bg-indigo-600/20 border border-indigo-500/20 rounded-xl px-4 py-2 max-w-xs fast-scale-in origin-top">
                    <p className="text-indigo-300 text-sm text-center">"{transcript}"</p>
                </div>
            )}
        </div>
    );
}
