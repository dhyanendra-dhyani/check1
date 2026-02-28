/**
 * ═══════════════════════════════════════════════════════════
 * Gemini Service v3 — Direct REST API (no SDK dependency)
 *
 * Uses direct fetch() calls to Gemini REST API, proven working
 * from suvidha2.0 reference. Round-robin key rotation.
 * ═══════════════════════════════════════════════════════════
 */

// ── API Key Pool ─────────────────────────────────
const API_KEYS = [];
for (let i = 1; i <= 10; i++) {
    const key = import.meta.env[`VITE_GEMINI_KEY_${i}`];
    if (key) API_KEYS.push(key.trim());
}
let keyIndex = 0;
function getNextKey() {
    const key = API_KEYS[keyIndex % API_KEYS.length];
    keyIndex++;
    return key;
}

// ── Chat History ─────────────────────────────────
let chatHistory = [];
const MAX_HISTORY = 12;

export function resetChatSession() {
    chatHistory = [];
}

// ── Language Helpers ─────────────────────────────
const LANG_NAMES = {
    en: 'English', hi: 'Hindi', pa: 'Punjabi', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati',
};

// ── Core API Call ────────────────────────────────
async function callGemini(systemPrompt, userText, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const apiKey = getNextKey();
        if (!apiKey) throw new Error('No API keys configured');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const body = {
            contents: [{
                parts: [
                    { text: systemPrompt },
                    { text: `User says: "${userText}"\n\nRespond with JSON only.` },
                ],
            }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 250,
                responseMimeType: 'application/json',
            },
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errText = await response.text();
                console.warn(`Gemini API error (attempt ${attempt + 1}): ${response.status}`, errText);
                if (attempt < retries) continue; // try next key
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textContent) {
                console.warn('Empty Gemini response, retrying...');
                if (attempt < retries) continue;
                throw new Error('Empty response from Gemini');
            }

            // Parse JSON from response
            const cleaned = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned);
        } catch (err) {
            if (err.message?.includes('API error') || err.message?.includes('Empty')) {
                if (attempt < retries) continue;
            }
            // JSON.parse errors — try to salvage
            if (err instanceof SyntaxError) {
                const data = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }).then(r => r.json()).catch(() => null);
                const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                return { text: raw.replace(/[{}"]/g, '').trim(), action: null, params: {} };
            }
            throw err;
        }
    }
}

// ═══════════════════════════════════════════════════
// MAIN: getAssistantGuidance
// ═══════════════════════════════════════════════════

export async function getAssistantGuidance(
    userInput, currentScreen, currentPath, lang, history, blindMode, pageData
) {
    const languageName = LANG_NAMES[lang] || 'Hindi';

    const blindModeInstructions = blindMode ? `
    BLIND MODE IS ACTIVE:
    - Read ALL on-screen data to the user step by step.
    - Describe numbers digit by digit: "4-0-0-0 rupees" not "four thousand".
    - Tell them what buttons/fields are visible and what each does.
    - If page has data: ${JSON.stringify(pageData || {})}
    ` : '';

    const pageInfo = pageData ? `\nCURRENT PAGE DATA: ${JSON.stringify(pageData)}` : '';

    const systemPrompt = `You are SUVIDHA Setu's voice assistant — a helpful, warm, intelligent AI for an Indian government services kiosk.

    CURRENT STATE: lang=${lang}, screen=${currentScreen}, path=${currentPath}
    ${pageInfo}
    ${blindModeInstructions}

    CONVERSATION HISTORY:
    ${(history || []).slice(-8).join('\n')}

    ACTIONS YOU CAN DISPATCH:
    - navigate_to_gateway: Takes user to the choose path screen (citizen/guest)
    - set_screen_guest: Sets to guest mode (quick bill payment without login)
    - set_screen_citizen_auth: Start citizen Aadhaar login flow
    - navigate_bill_electricity: Go to electricity bill payment
    - navigate_bill_water: Go to water bill payment
    - navigate_bill_gas: Go to gas bill payment
    - navigate_complaint: Go to complaint filing form
    - navigate_home: Go to the home/services page
    - navigate_admin: Go to admin dashboard
    - go_back: Return to the previous screen
    - stop_voice: Deactivate voice assistant

    SPECIAL BEHAVIORS:
    1. If user is on citizen-auth screen, guide them to use thumb/iris/OTP authentication.
    2. If user wants naam change (name change), pipeline, new connection, meter reading, FASTag, LPG subsidy, property tax details —
       these REQUIRE citizen login first. Set action to "set_screen_citizen_auth" and explain:
       "इसके लिए पहले आधार से लॉगिन करना होगा, ले जा रहा हूँ।"
    3. If user says stop/band karo/ruko — set action to "stop_voice".
    4. If user asks about a bill type directly (bijli, pani, gas) — navigate directly.
    5. Auto-detect the user's language from their speech and respond in that language.
    6. If user asks "kya kya kar sakte hain" — explain ALL available services naturally.

    CONVERSATION STYLE:
    - Keep replies SHORT — 1-2 sentences max. Like a REAL conversation.
    - Be warm and natural. Use informal Hindi/Punjabi (tum/aap style).
    - NEVER repeat yourself. NEVER give long lists unless asked.
    - If blind mode: be more descriptive about on-screen content but still conversational.
    - IMPORTANT: You MUST respond in ${languageName}.

    Respond ONLY in JSON format:
    {
      "text": "Your spoken response in ${languageName}",
      "action": "action_name or null",
      "params": { "key": "value" }
    }`;

    try {
        const result = await callGemini(systemPrompt, userInput);

        // Update history
        chatHistory.push(
            { role: 'user', content: userInput },
            { role: 'assistant', content: result.text || '' }
        );
        if (chatHistory.length > MAX_HISTORY * 2) {
            chatHistory = chatHistory.slice(-MAX_HISTORY * 2);
        }

        return result;
    } catch (error) {
        console.error('Gemini guidance error:', error);
        throw error;
    }
}

// ═══════════════════════════════════════════════════
// PROACTIVE HELP — page navigation announcements
// ═══════════════════════════════════════════════════

export async function getProactiveHelp(currentScreen, currentPath, lang, history, blindMode, pageData) {
    const languageName = LANG_NAMES[lang] || 'Hindi';

    const blindInfo = blindMode && pageData
        ? `\nBLIND MODE ACTIVE. Page data: ${JSON.stringify(pageData)}\nDescribe ALL on-screen elements in detail.`
        : '';

    const systemPrompt = `You are SUVIDHA Setu's voice assistant. The user just navigated to a new page.
    
    CURRENT STATE: screen=${currentScreen}, path=${currentPath}, lang=${lang}
    ${blindInfo}

    Give a SHORT (1 sentence) welcoming announcement about this page.
    Tell the user what they can do here. Be warm and conversational.
    Respond in ${languageName}.

    Respond ONLY in JSON:
    {
      "text": "Your announcement in ${languageName}"
    }`;

    try {
        const result = await callGemini(systemPrompt, `User navigated to ${currentScreen} page at ${currentPath}`);
        return result;
    } catch (error) {
        console.error('Proactive help error:', error);
        // Return a simple fallback instead of throwing
        const fallbacks = {
            hi: 'इस पेज पर आपका स्वागत है। बताइए क्या करना है?',
            en: 'Welcome to this page. How can I help?',
            pa: 'ਇਸ ਪੇਜ ਤੇ ਜੀ ਆਇਆਂ ਨੂੰ। ਦੱਸੋ ਕੀ ਕਰਨਾ ਹੈ?',
        };
        return { text: fallbacks[lang] || fallbacks.hi };
    }
}
