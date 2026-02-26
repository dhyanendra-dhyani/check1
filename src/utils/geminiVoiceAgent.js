/**
 * ═══════════════════════════════════════════════════════════
 * Gemini Voice Agent — Core AI Module
 *
 * Uses Gemini 2.5 Flash for:
 *   • Speech-to-text (via native audio input)
 *   • Language auto-detection
 *   • Natural Language Understanding (intent + navigation)
 *   • Conversational replies
 *
 * Features:
 *   • Round-robin API key rotation (4 keys)
 *   • Conversation memory (last 10 exchanges)
 *   • Auto language detection after 1-2 exchanges
 *   • Graceful fallback to Web Speech API
 * ═══════════════════════════════════════════════════════════
 */

import { getNavigationPrompt } from './navigationMap';

/* ── API Key Pool ─────────────────────────────────── */
const API_KEYS = [
    import.meta.env.VITE_GEMINI_KEY_1,
    import.meta.env.VITE_GEMINI_KEY_2,
    import.meta.env.VITE_GEMINI_KEY_3,
    import.meta.env.VITE_GEMINI_KEY_4,
].filter(Boolean);

let keyIndex = 0;
function getNextKey() {
    const key = API_KEYS[keyIndex % API_KEYS.length];
    keyIndex++;
    return key;
}

/* ── Conversation Memory ──────────────────────────── */
const MAX_HISTORY = 10;
let conversationHistory = [];
let detectedLangCount = {};  // Track language occurrences for auto-switch

export function clearConversation() {
    conversationHistory = [];
    detectedLangCount = {};
}

export function getConversationHistory() {
    return [...conversationHistory];
}

/* ── System Prompt ────────────────────────────────── */
function buildSystemPrompt(currentLang, currentScreen) {
    const navPrompt = getNavigationPrompt();

    return `You are SUVIDHA Setu's voice assistant — a helpful, friendly AI agent for an Indian government civic services kiosk.

ROLE:
- Help citizens navigate the kiosk, pay bills, file complaints, and find information
- You speak the user's language. Auto-detect their language from their speech.
- Be concise, warm, and helpful. Keep responses under 2-3 sentences.

CURRENT STATE:
- App language: ${currentLang}
- Current screen: ${currentScreen}

${navPrompt}

RESPONSE FORMAT:
You MUST respond with valid JSON only, no markdown, no extra text. Use this exact format:
{
  "transcript": "what the user said (transcribed)",
  "language": "detected language code (en, hi, pa, bn, ta, te, kn, ml, mr, gu, ur)",
  "intent": "one of: navigate, set_screen, go_back, inform, greet, help, unknown",
  "action_key": "navigation key if intent is navigate/set_screen/go_back, else null",
  "reply": "your helpful response in the detected language"
}

INTENT RULES:
- If user wants to go somewhere → intent="navigate", action_key=matching key
- If user wants quick pay or citizen login → intent="set_screen", action_key="quick_pay" or "citizen_login"
- If user says go back → intent="go_back", action_key="go_back"
- If user asks a question about services → intent="inform", reply with helpful info
- If user greets → intent="greet", reply warmly
- If unclear → intent="help", ask for clarification in their language
- ALWAYS detect and reply in the user's language, not just English`;
}

/* ── Audio Recording ──────────────────────────────── */

/**
 * Record audio from the user's microphone
 * @param {number} maxDurationMs - Maximum recording duration (default 8s)
 * @param {function} onStart - Called when recording starts
 * @returns {Promise<{ blob: Blob, mimeType: string }>}
 */
export function recordAudio(maxDurationMs = 8000, onStart) {
    return new Promise(async (resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });

            // Pick best available MIME type
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4';

            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(chunks, { type: mimeType });
                resolve({ blob, mimeType });
            };

            recorder.onerror = (e) => {
                stream.getTracks().forEach(t => t.stop());
                reject(e.error || new Error('Recording failed'));
            };

            recorder.start();
            onStart?.();

            // Auto-stop after max duration
            setTimeout(() => {
                if (recorder.state === 'recording') {
                    recorder.stop();
                }
            }, maxDurationMs);

            // Return a stop function
            resolve.__stopRecording = () => {
                if (recorder.state === 'recording') {
                    recorder.stop();
                }
            };
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Record audio with manual stop control
 * @param {function} onStart - Called when recording starts
 * @returns {{ promise: Promise<{blob, mimeType}>, stop: function }}
 */
export function startRecording(onStart) {
    let resolvePromise, rejectPromise;
    let recorder = null;
    let stream = null;

    const promise = new Promise(async (resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4';

            recorder = new MediaRecorder(stream, { mimeType });
            const chunks = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(chunks, { type: mimeType });
                resolve({ blob, mimeType });
            };

            recorder.onerror = (e) => {
                stream.getTracks().forEach(t => t.stop());
                reject(e.error || new Error('Recording failed'));
            };

            recorder.start();
            onStart?.();

            // Safety: auto-stop after 15s
            setTimeout(() => {
                if (recorder?.state === 'recording') recorder.stop();
            }, 15000);
        } catch (err) {
            reject(err);
        }
    });

    const stop = () => {
        if (recorder?.state === 'recording') recorder.stop();
    };

    return { promise, stop };
}

/* ── Gemini API Call ──────────────────────────────── */

/**
 * Send audio + conversation context to Gemini 2.5 Flash
 * @param {Blob} audioBlob - Recorded audio blob
 * @param {string} mimeType - Audio MIME type
 * @param {string} currentLang - Current app language code
 * @param {string} currentScreen - Current screen name
 * @returns {Promise<Object>} Parsed response
 */
export async function sendToGemini(audioBlob, mimeType, currentLang, currentScreen) {
    const apiKey = getNextKey();
    if (!apiKey) throw new Error('No API keys configured');

    // Convert audio blob to base64
    const base64Audio = await blobToBase64(audioBlob);

    // Build conversation context
    const historyContext = conversationHistory.length > 0
        ? '\n\nPrevious conversation:\n' + conversationHistory
            .map(m => `${m.role}: ${m.content}`)
            .join('\n')
        : '';

    const systemPrompt = buildSystemPrompt(currentLang, currentScreen) + historyContext;

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: systemPrompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Audio,
                        },
                    },
                    { text: 'Listen to the audio and respond with the JSON format specified. Remember: respond ONLY with valid JSON.' },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 300,
            responseMimeType: 'application/json',
        },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini API error:', response.status, errText);
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract the text response
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) throw new Error('Empty response from Gemini');

    // Parse JSON response
    let parsed;
    try {
        // Clean up any markdown formatting that might sneak in
        const cleaned = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
    } catch {
        console.warn('Failed to parse Gemini JSON, raw:', textContent);
        // Create a fallback response
        parsed = {
            transcript: textContent,
            language: currentLang,
            intent: 'inform',
            action_key: null,
            reply: textContent,
        };
    }

    // Update conversation history
    conversationHistory.push(
        { role: 'user', content: parsed.transcript || '(audio)' },
        { role: 'assistant', content: parsed.reply || '' }
    );
    if (conversationHistory.length > MAX_HISTORY * 2) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    }

    // Track language detection for auto-switch
    if (parsed.language && parsed.language !== 'en') {
        detectedLangCount[parsed.language] = (detectedLangCount[parsed.language] || 0) + 1;
    }

    return parsed;
}

/**
 * Send a text message to Gemini (for typed input or fallback)
 */
export async function sendTextToGemini(text, currentLang, currentScreen) {
    const apiKey = getNextKey();
    if (!apiKey) throw new Error('No API keys configured');

    const historyContext = conversationHistory.length > 0
        ? '\n\nPrevious conversation:\n' + conversationHistory
            .map(m => `${m.role}: ${m.content}`)
            .join('\n')
        : '';

    const systemPrompt = buildSystemPrompt(currentLang, currentScreen) + historyContext;

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: systemPrompt },
                    { text: `User says: "${text}"\n\nRespond with the JSON format specified. Remember: respond ONLY with valid JSON.` },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 300,
            responseMimeType: 'application/json',
        },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) throw new Error('Empty response from Gemini');

    let parsed;
    try {
        const cleaned = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
    } catch {
        parsed = {
            transcript: text,
            language: currentLang,
            intent: 'inform',
            action_key: null,
            reply: textContent,
        };
    }

    conversationHistory.push(
        { role: 'user', content: text },
        { role: 'assistant', content: parsed.reply || '' }
    );
    if (conversationHistory.length > MAX_HISTORY * 2) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    }

    if (parsed.language && parsed.language !== 'en') {
        detectedLangCount[parsed.language] = (detectedLangCount[parsed.language] || 0) + 1;
    }

    return parsed;
}

/* ── Language Auto-Switch ─────────────────────────── */

/**
 * Check if we should auto-switch the app language
 * based on consecutive detections (threshold: 2)
 * @returns {string|null} Language code to switch to, or null
 */
export function shouldAutoSwitchLang() {
    for (const [lang, count] of Object.entries(detectedLangCount)) {
        if (count >= 2) return lang;
    }
    return null;
}

/* ── TTS (Web Speech Synthesis) ───────────────────── */

const TTS_LANG_MAP = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN',
    mr: 'mr-IN', gu: 'gu-IN', ur: 'ur-IN',
};

/**
 * Speak text using Web Speech Synthesis
 * @param {string} text - Text to speak
 * @param {string} lang - Language code
 * @returns {Promise<void>}
 */
export function speakText(text, lang = 'en') {
    return new Promise((resolve) => {
        if (!window.speechSynthesis || !text) {
            resolve();
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = TTS_LANG_MAP[lang] || 'en-IN';
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        // Chrome bug workaround: voices may not be loaded yet
        const voices = window.speechSynthesis.getVoices();
        const targetLang = TTS_LANG_MAP[lang] || 'en-IN';
        const voice = voices.find(v => v.lang === targetLang) || voices.find(v => v.lang.startsWith(lang));
        if (voice) utterance.voice = voice;

        window.speechSynthesis.speak(utterance);
    });
}

/** Stop any ongoing speech */
export function stopSpeaking() {
    window.speechSynthesis?.cancel();
}

/* ── Web Speech API Fallback STT ──────────────────── */

/**
 * Fallback: Use Web Speech API for speech-to-text
 * Then send the transcript to Gemini as text
 */
export function fallbackSTT(lang = 'en') {
    return new Promise((resolve, reject) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            reject(new Error('Speech recognition not supported'));
            return;
        }

        const recognition = new SpeechRecognition();
        const langMap = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' };
        recognition.lang = langMap[lang] || 'en-IN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            resolve(transcript);
        };

        recognition.onerror = (event) => reject(new Error(event.error));
        recognition.onend = () => { }; // Will resolve or reject above

        recognition.start();

        // Auto-stop after 10s
        setTimeout(() => {
            try { recognition.stop(); } catch { }
        }, 10000);
    });
}

/* ── Helpers ──────────────────────────────────────── */

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/** Check if MediaRecorder is available */
export function isMediaRecorderSupported() {
    return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

/** Check if any Gemini API keys are configured */
export function hasApiKeys() {
    return API_KEYS.length > 0;
}
