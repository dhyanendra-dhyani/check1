/**
 * ═══════════════════════════════════════════════════════════
 * SUVIDHA Setu - Voice Commands & Speech Utilities
 * Uses Web Speech API for recognition and synthesis
 * ═══════════════════════════════════════════════════════════
 */

import { speechLangCodes, voiceLangCodes } from './i18n';

/** Voice command to route mapping (English + Hindi) */
const voiceRoutes = {
    // English commands
    "pay electricity bill": "/bill/electricity",
    "electricity bill": "/bill/electricity",
    "electricity": "/bill/electricity",
    "bijli": "/bill/electricity",
    "bijli ka bill": "/bill/electricity",
    "pay water bill": "/bill/water",
    "water bill": "/bill/water",
    "water": "/bill/water",
    "pani": "/bill/water",
    "pani ka bill": "/bill/water",
    "pay gas bill": "/bill/gas",
    "gas bill": "/bill/gas",
    "gas": "/bill/gas",
    "gas ka bill": "/bill/gas",
    "file complaint": "/complaint",
    "complaint": "/complaint",
    "shikayat": "/complaint",
    "shikayat darj karo": "/complaint",
    "admin": "/admin",
    "dashboard": "/admin",
    "home": "/",
    "go home": "/",
    "ghar": "/",
};

/** Language change commands */
const langCommands = {
    "change language to hindi": "hi",
    "hindi": "hi",
    "hindi mein": "hi",
    "change language to english": "en",
    "english": "en",
    "angrezi": "en",
    "change language to punjabi": "pa",
    "punjabi": "pa",
    "punjabi vich": "pa",
};

/**
 * Process a voice transcript and determine action
 * @param {string} transcript - Raw speech transcript
 * @returns {{ type: 'navigate'|'language'|'unknown', value: string }}
 */
export function processVoiceCommand(transcript) {
    const normalized = transcript.toLowerCase().trim();

    // Check language commands first
    for (const [cmd, lang] of Object.entries(langCommands)) {
        if (normalized.includes(cmd)) {
            return { type: 'language', value: lang };
        }
    }

    // Check navigation commands
    for (const [cmd, route] of Object.entries(voiceRoutes)) {
        if (normalized.includes(cmd)) {
            return { type: 'navigate', value: route };
        }
    }

    return { type: 'unknown', value: transcript };
}

/**
 * Extract consumer ID from voice transcript
 * E.g., "My consumer ID is 1234567890" -> "1234567890"
 * Also handles: "PSEB-123456", "PHED 789012"
 */
export function extractConsumerId(transcript) {
    const normalized = transcript.trim();

    // Try to match PSEB/PHED/GPL format
    const prefixPattern = /(PSEB|PHED|GPL)[\s-]*(\d+)/i;
    const prefixMatch = normalized.match(prefixPattern);
    if (prefixMatch) {
        return `${prefixMatch[1].toUpperCase()}-${prefixMatch[2]}`;
    }

    // Try to extract just digits from phrases like "my ID is 123456"
    const digitsOnly = normalized.replace(/[^\d]/g, '');
    if (digitsOnly.length >= 5) {
        return digitsOnly;
    }

    return normalized;
}

/**
 * Start speech recognition
 * @param {string} lang - Language code ('en', 'hi', 'pa')
 * @param {function} onResult - Callback with transcript
 * @param {function} onError - Callback on error
 * @param {function} onEnd - Callback when recognition ends
 * @returns {SpeechRecognition|null} - Recognition instance or null
 */
export function startSpeechRecognition(lang, onResult, onError, onEnd) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        onError?.('Speech recognition is not supported in this browser. Please use Chrome.');
        return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = speechLangCodes[lang] || 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        onResult?.(transcript, confidence);
    };

    recognition.onerror = (event) => {
        onError?.(event.error);
    };

    recognition.onend = () => {
        onEnd?.();
    };

    recognition.start();
    return recognition;
}

/**
 * Speak text using speech synthesis
 * @param {string} text - Text to speak
 * @param {string} lang - Language code ('en', 'hi', 'pa')
 * @returns {Promise<void>}
 */
export function speak(text, lang = 'en') {
    return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) {
            console.warn('Speech synthesis not supported');
            resolve();
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voiceLangCodes[lang] || 'en-IN';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => resolve();
        utterance.onerror = (e) => {
            console.warn('Speech synthesis error:', e);
            resolve(); // Resolve anyway – voice is a nice-to-have
        };

        window.speechSynthesis.speak(utterance);
    });
}

/**
 * Check if the Speech Recognition API is available
 */
export function isSpeechRecognitionSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
