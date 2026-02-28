/**
 * ═══════════════════════════════════════════════════════════
 * Speech Hooks — Gemini TTS + Web Speech API fallback
 * Ported from suvidha_2.0's useSpeech.ts
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback } from 'react';
import { Modality } from "@google/genai";
import { getRotatedAIClient } from '../utils/apiClient';

const SPEECH_LANGS = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN',
    gu: 'gu-IN', ml: 'ml-IN', ur: 'ur-IN',
};

/**
 * Hook: Speech recognition using Web Speech API
 */
export function useSpeechRecognition(onResult) {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState(null);

    const startListening = useCallback((lang = 'hi') => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = SPEECH_LANGS[lang] || 'hi-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => setError(event.error);
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            onResult(text);
        };

        recognition.start();
    }, [onResult]);

    return { isListening, startListening, error };
}

/**
 * Hook: Text-to-Speech with Gemini TTS primary + browser fallback
 */
export function useTextToSpeech() {
    const [isSpeaking, setIsSpeaking] = useState(false);

    const stop = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }, []);

    const speak = async (text, lang = 'hi-IN') => {
        if (!text) return;

        stop();
        setIsSpeaking(true);

        const fallback = () => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = 0.9;
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
        };

        try {
            const ai = getRotatedAIClient();
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: `Say in ${lang === 'hi-IN' ? 'Hindi' : 'English'}: ${text}` }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioSrc = `data:audio/wav;base64,${base64Audio}`;
                const audio = new Audio(audioSrc);
                audio.onended = () => setIsSpeaking(false);
                audio.onerror = () => {
                    console.warn("Audio element error, falling back to browser TTS");
                    fallback();
                };
                try {
                    await audio.play();
                } catch (e) {
                    console.warn("Audio playback blocked or failed, falling back to browser TTS");
                    fallback();
                }
            } else {
                fallback();
            }
        } catch (error) {
            if (error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
                console.warn("Gemini TTS Quota Exceeded. Using browser fallback.");
            } else {
                console.error("Gemini TTS Error:", error);
            }
            fallback();
        }
    };

    return { speak, stop, isSpeaking };
}
