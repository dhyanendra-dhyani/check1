/**
 * ═══════════════════════════════════════════════════════════
 * Gemini Voice Agent v5 — Streaming + Parallel Pipeline
 *
 * KEY UPGRADES:
 *   • streamGenerateContent → TTS starts on FIRST sentence
 *   • Sentence-level chunking → natural speech flow
 *   • Conversation memory for multi-turn context
 *   • Round-robin API key rotation
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

export function clearConversation() {
    conversationHistory = [];
}

/* ── System Prompt ────────────────────────────────── */
function buildSystemPrompt(currentLang, currentScreen) {
    const navPrompt = getNavigationPrompt();

    return `You are SUVIDHA Setu's voice assistant — a helpful, warm, concise AI for an Indian government kiosk.

RULES:
- Speak the USER's language. Auto-detect from their speech.
- Keep replies SHORT — 1-2 sentences max. Like a REAL conversation, not a lecture.
- Be warm and natural. Use informal Hindi/Punjabi (tum/aap style) when they speak Hindi.
- If user asks to navigate, respond AND specify intent.
- If user asks a question, answer briefly.
- NEVER repeat yourself. NEVER give long lists unless asked.

CURRENT STATE: lang=${currentLang}, screen=${currentScreen}

${navPrompt}

RESPONSE FORMAT (JSON only):
{
  "language": "detected lang code (en/hi/pa/bn/ta/te/kn/mr/gu/ur)",
  "intent": "navigate|set_screen|go_back|inform|greet|help|unknown",
  "action_key": "navigation key or null",
  "reply": "your SHORT response in detected language"
}

INTENT RULES:
- navigate → action_key = electricity/water/gas/complaint
- set_screen → action_key = quick_pay/citizen_login  
- go_back → action_key = go_back
- inform/greet/help → action_key = null
- ALWAYS reply in user's language`;
}

/* ── STREAMING Gemini API Call ────────────────────── */

/**
 * Send text to Gemini with STREAMING response.
 * Calls onSentence() as each sentence arrives → TTS can start immediately.
 * Returns the full parsed result at the end.
 *
 * @param {string} text - User's transcript
 * @param {string} currentLang - App language
 * @param {string} currentScreen - Current screen
 * @param {function} onSentence - Called with each sentence chunk as it arrives
 * @returns {Promise<Object>} Full parsed response
 */
export async function streamGeminiResponse(text, currentLang, currentScreen, onSentence) {
    const apiKey = getNextKey();
    if (!apiKey) throw new Error('No API keys configured');

    const historyContext = conversationHistory.length > 0
        ? '\n\nRecent conversation:\n' + conversationHistory
            .slice(-6) // Only last 3 exchanges for speed
            .map(m => `${m.role}: ${m.content}`)
            .join('\n')
        : '';

    const systemPrompt = buildSystemPrompt(currentLang, currentScreen) + historyContext;

    const requestBody = {
        contents: [{
            parts: [
                { text: systemPrompt },
                { text: `User says: "${text}"\n\nRespond with JSON only.` },
            ],
        }],
        generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 200,
            responseMimeType: 'application/json',
        },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini streaming error:', response.status, errText);
        throw new Error(`Gemini API error: ${response.status}`);
    }

    // Read the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let sentenceBuffer = '';
    let sentenceCount = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE events
        const lines = chunk.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    fullText += text;

                    // Stream sentence-by-sentence for TTS
                    sentenceBuffer += text;
                    // Split on sentence-ending punctuation (Hindi/English)
                    const sentences = sentenceBuffer.split(/(?<=[।.!?])\s*/);
                    if (sentences.length > 1) {
                        // All but last are complete sentences
                        for (let i = 0; i < sentences.length - 1; i++) {
                            const s = sentences[i].trim();
                            if (s && onSentence) {
                                onSentence(s, sentenceCount++);
                            }
                        }
                        sentenceBuffer = sentences[sentences.length - 1];
                    }
                } catch { /* skip unparseable chunks */ }
            }
        }
    }

    // Flush remaining buffer
    if (sentenceBuffer.trim() && onSentence) {
        onSentence(sentenceBuffer.trim(), sentenceCount);
    }

    // Parse the full JSON response
    let parsed;
    try {
        const cleaned = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
    } catch {
        parsed = {
            language: currentLang,
            intent: 'inform',
            action_key: null,
            reply: fullText.replace(/[{}"\n]/g, '').trim(),
        };
    }

    // Update history
    conversationHistory.push(
        { role: 'user', content: text },
        { role: 'assistant', content: parsed.reply || '' }
    );
    if (conversationHistory.length > MAX_HISTORY * 2) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    }

    return parsed;
}

/**
 * Non-streaming fallback (for when streaming isn't needed)
 */
export async function sendTextToGemini(text, currentLang, currentScreen) {
    const apiKey = getNextKey();
    if (!apiKey) throw new Error('No API keys configured');

    const historyContext = conversationHistory.length > 0
        ? '\n\nRecent conversation:\n' + conversationHistory
            .slice(-6)
            .map(m => `${m.role}: ${m.content}`)
            .join('\n')
        : '';

    const systemPrompt = buildSystemPrompt(currentLang, currentScreen) + historyContext;

    const requestBody = {
        contents: [{
            parts: [
                { text: systemPrompt },
                { text: `User says: "${text}"\n\nRespond with JSON only.` },
            ],
        }],
        generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 200,
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
        parsed = { language: currentLang, intent: 'inform', action_key: null, reply: textContent };
    }

    conversationHistory.push(
        { role: 'user', content: text },
        { role: 'assistant', content: parsed.reply || '' }
    );
    if (conversationHistory.length > MAX_HISTORY * 2) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    }

    return parsed;
}

/* ── TTS (Web Speech Synthesis) ───────────────────── */

const TTS_LANG_MAP = {
    en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN',
    ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN',
    mr: 'mr-IN', gu: 'gu-IN', ur: 'ur-IN',
};

/**
 * Speak text. Returns a promise that resolves when speech ends.
 * Can be cancelled mid-sentence by calling stopSpeaking().
 */
export function speakText(text, lang = 'en') {
    return new Promise((resolve) => {
        if (!window.speechSynthesis || !text) { resolve(); return; }
        window.speechSynthesis.cancel();

        const u = new SpeechSynthesisUtterance(text);
        u.lang = TTS_LANG_MAP[lang] || 'en-IN';
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
}

/** Speak text WITHOUT cancelling current speech (for queuing) */
export function queueSpeak(text, lang = 'en') {
    return new Promise((resolve) => {
        if (!window.speechSynthesis || !text) { resolve(); return; }

        const u = new SpeechSynthesisUtterance(text);
        u.lang = TTS_LANG_MAP[lang] || 'en-IN';
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
}

export function stopSpeaking() {
    window.speechSynthesis?.cancel();
}

export function hasApiKeys() {
    return API_KEYS.length > 0;
}
