/**
 * ═══════════════════════════════════════════════════════════
 * Gemini Service v5 — Multi-Model Fallback
 *
 * ALL queries go directly to Gemini. No local KB.
 * 15 API keys deduplicated, round-robin.
 * Model fallback chain: 2.0-flash-lite → 2.0-flash → 1.5-flash
 * Offline fallback for common queries when all APIs fail.
 * ═══════════════════════════════════════════════════════════
 */

// ── API Key Pool (deduplicated, round-robin) ────────
const _rawKeys = [];
for (let i = 1; i <= 15; i++) {
    const key = import.meta.env[`VITE_GEMINI_KEY_${i}`];
    if (key) _rawKeys.push(key.trim());
}
const API_KEYS = [...new Set(_rawKeys)]; // remove duplicates
let keyIndex = 0;
function getNextKey() {
    if (API_KEYS.length === 0) return null;
    const key = API_KEYS[keyIndex % API_KEYS.length];
    keyIndex++;
    return key;
}

// ── Model Fallback Chain ──────────────────────────
const MODEL_CHAIN = [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
];

console.log(`[Gemini] Loaded ${API_KEYS.length} unique API keys (from ${_rawKeys.length} total)`);

// ── Chat History ─────────────────────────────────
let chatHistory = [];
const MAX_HISTORY = 10;

export function resetChatSession() {
    chatHistory = [];
}

// ── Language Helpers ─────────────────────────────
const LANG_NAMES = {
    en: 'English', hi: 'Hindi', pa: 'Punjabi', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati',
};

// ═══════════════════════════════════════════════════
// THE SYSTEM PROMPT — This is the brain of the assistant
// ═══════════════════════════════════════════════════

function buildSystemPrompt(lang, screen, path, history, blindMode, pageData) {
    const languageName = LANG_NAMES[lang] || 'Hindi';

    const blindInstructions = blindMode ? `
    BLIND MODE ACTIVE:
    - Read ALL on-screen data digit-by-digit: "4-0-0-0 rupees"
    - Describe every button and field visible
    - Current page data: ${JSON.stringify(pageData || {})}
    ` : '';

    const historyBlock = (history || []).length > 0
        ? `\nRECENT CONVERSATION:\n${history.slice(-6).join('\n')}`
        : '';

    return `You are SUVIDHA Setu's voice assistant on an Indian government kiosk.

STATE: lang=${lang}, screen=${screen}, path=${path}
${blindInstructions}${historyBlock}

AVAILABLE ACTIONS (return in "action" field):
- navigate_bill_electricity → electricity bill page
- navigate_bill_water → water bill page
- navigate_bill_gas → gas bill page
- navigate_bill_property_tax → property tax page
- navigate_complaint → file a complaint
- navigate_naam_change → name change form (needs citizen login)
- navigate_new_connection → new connection form (needs citizen login)
- navigate_home → home page
- navigate_admin → admin dashboard
- navigate_to_gateway → path selection (citizen/guest)
- set_screen_guest → guest mode
- set_screen_citizen_auth → start Aadhaar login
- go_back → go to previous page
- stop_voice → turn off voice assistant
- confirm_yes → user confirmed yes
- confirm_no → user said no
- confirm_pay → user wants to pay (when on bill details page)
- pay_upi → pay via UPI/QR
- pay_cash → pay via cash/naqd
- pay_card → pay via card/debit/credit
- fetch_bill → user wants to look up their bill

BILL FLOW (context-aware):
- On bill details page: haan/yes/pay/paisa jama → confirm_pay
- On payment method page: UPI/QR → pay_upi, cash/naqd → pay_cash, card/debit/credit → pay_card
- On input page: bill dhundho/bill dikhao/fetch/submit → fetch_bill

BILL PAGE GUIDANCE (when navigating to a bill):
- Electricity: "khata sankhya daalein — jaise PSEB-123456"
- Water: "khata sankhya daalein — jaise PHED-789012"
- Gas: "LPG ID daalein — jaise GPL-345678"

CITIZEN-REQUIRED FEATURES:
naam_change, new_connection, meter_reading, FASTag, LPG_subsidy → need citizen login first.
If user isn't logged in (screen is NOT "citizen-dashboard"), set action to "set_screen_citizen_auth" and say "पहले आधार से लॉगिन करना होगा।"

RULES:
1. RESPOND IN ${languageName} ONLY.
2. Keep answers SHORT — 1-2 sentences MAXIMUM. Be concise like a real person.
3. NEVER repeat yourself. NEVER give long lists unless explicitly asked.
4. Auto-detect language from user's speech and match it.
5. If user says stop/band/ruko → action: "stop_voice"
6. If user says yes/haan/ji → action: "confirm_yes"
7. If user says no/nahi/nai → action: "confirm_no"
8. If user asks for a bill directly (bijli, pani, gas) → navigate IMMEDIATELY + give khata sankhya guidance.
9. Be warm, helpful, conversational. Like talking to a friend.

RESPOND ONLY IN THIS JSON FORMAT:
{
  "text": "your spoken response in ${languageName}",
  "action": "action_name or null",
  "params": {}
}`;
}

// ── Core API Call (multi-model fallback) ────────
async function callGemini(systemPrompt, userText) {
    const body = {
        contents: [{
            parts: [
                { text: systemPrompt },
                { text: `User: "${userText}"` },
            ],
        }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 150,
            responseMimeType: 'application/json',
        },
    };

    // Try each model in the fallback chain
    for (const model of MODEL_CHAIN) {
        // Try 3 different keys per model
        for (let keyAttempt = 0; keyAttempt < 3; keyAttempt++) {
            const apiKey = getNextKey();
            if (!apiKey) throw new Error('No API keys configured');

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                if (response.status === 429) {
                    console.warn(`[Gemini] 429 on ${model} (key #${keyIndex % API_KEYS.length})`);
                    await new Promise(r => setTimeout(r, 200));
                    continue; // try next key
                }

                if (!response.ok) {
                    console.warn(`[Gemini] ${response.status} on ${model}`);
                    continue;
                }

                const data = await response.json();
                const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!textContent) {
                    console.warn(`[Gemini] Empty response from ${model}`);
                    continue;
                }

                // Parse JSON
                let parsed = null;
                const cleaned = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

                try {
                    parsed = JSON.parse(cleaned);
                } catch {
                    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = { text: textContent, action: null, params: {} }; }
                    } else {
                        parsed = { text: textContent, action: null, params: {} };
                    }
                }

                if (!parsed.text) parsed.text = '';
                if (!parsed.action) parsed.action = null;
                if (!parsed.params) parsed.params = {};

                console.log(`[Gemini] ✅ ${model} | Key #${keyIndex % API_KEYS.length} | "${parsed.text.substring(0, 40)}..."`);
                return parsed;
            } catch (err) {
                console.warn(`[Gemini] ${model} error: ${err.message}`);
                await new Promise(r => setTimeout(r, 150));
            }
        }
        console.warn(`[Gemini] All keys failed on ${model}, trying next model...`);
    }

    // ═══ ALL MODELS FAILED — Offline Fallback ═══
    console.warn('[Gemini] All models and keys exhausted. Using offline fallback.');
    return getOfflineFallback(userText);
}

// ── Offline Fallback (when all API keys are rate-limited) ────
function getOfflineFallback(userText) {
    const t = userText.toLowerCase();

    // Bill navigation
    if (t.includes('bijli') || t.includes('बिजली') || t.includes('electricity') || t.includes('light'))
        return { text: 'बिजली बिल का पेज खोल रहा हूँ। खाता संख्या डालें जैसे PSEB-123456।', action: 'navigate_bill_electricity', params: {} };
    if (t.includes('pani') || t.includes('पानी') || t.includes('water'))
        return { text: 'पानी बिल का पेज खोल रहा हूँ। खाता संख्या डालें जैसे PHED-789012।', action: 'navigate_bill_water', params: {} };
    if (t.includes('gas') || t.includes('गैस') || t.includes('rasoi'))
        return { text: 'गैस बिल का पेज खोल रहा हूँ। LPG ID डालें जैसे GPL-345678।', action: 'navigate_bill_gas', params: {} };
    if (t.includes('property') || t.includes('tax') || t.includes('टैक्स'))
        return { text: 'Property Tax का पेज खोल रहा हूँ।', action: 'navigate_bill_property_tax', params: {} };

    // ═══ Context-aware bill flow (ONLY on bill pages) ═══
    const onBillPage = typeof window !== 'undefined' && window.location.pathname.includes('/bill/');

    if (onBillPage) {
        // Confirmation (haan/yes/hn/ha/hnn/हाँ → confirm_pay) supports repeated words like "hn hn hn"
        if (t.match(/^(hn|hnn|hm|ha|han|haan|ha+n|yes|theek|thik|ok|ji|pay|jama|bharo|karo|kar do|kr do|paisa|hnji|हाँ|हां|हँ)(?:\s+(hn|hnn|hm|ha|han|haan|ha+n|yes|theek|thik|ok|ji|pay|jama|bharo|karo|kar do|kr do|paisa|hnji|हाँ|हां|हँ))*$/i) ||
            t.includes('paisa jama') || t.includes('pay karo') || t.includes('haan') || t.includes('भरो') || t.includes('हाँ'))
            return { text: '', action: 'confirm_pay', params: {} };

        // Payment methods
        if (t.includes('upi') || t.includes('यूपीआई') || t.includes('qr'))
            return { text: 'UPI से पेमेंट शुरू कर रहा हूँ।', action: 'pay_upi', params: {} };
        if (t.match(/\b(cash|naqd|naqdi|nakad|कैश|नकद)\b/i))
            return { text: 'कैश से पेमेंट शुरू कर रहा हूँ।', action: 'pay_cash', params: {} };
        if (t.match(/\b(card|debit|credit|कार्ड)\b/i))
            return { text: 'कार्ड से पेमेंट शुरू कर रहा हूँ।', action: 'pay_card', params: {} };

        // Fetch/search bill
        if (t.includes('fetch') || t.includes('dhundho') || t.includes('dikhao') || t.includes('submit') || t.includes('ढूंढो') || t.includes('दिखाओ'))
            return { text: 'बिल ढूंढ रहा हूँ।', action: 'fetch_bill', params: {} };
    }

    // Complaint (needs citizen login — executeAction handles auth check)
    if (t.includes('shikayat') || t.includes('शिकायत') || t.includes('complaint') || t.includes('problem'))
        return { text: 'शिकायत दर्ज करने के लिए पहले लॉगिन करना होगा।', action: 'navigate_complaint', params: {} };

    // Name change
    if (t.includes('naam') || t.includes('नाम') || t.includes('name change'))
        return { text: 'नाम बदलवाने के लिए पहले लॉगिन करना होगा।', action: 'set_screen_citizen_auth', params: {} };

    // New connection
    if (t.includes('naya') || t.includes('new connection') || t.includes('नया कनेक्शन'))
        return { text: 'नया कनेक्शन के लिए पहले लॉगिन करना होगा।', action: 'set_screen_citizen_auth', params: {} };

    // Home / services
    if (t.includes('home') || t.includes('घर') || t.includes('ghar') || t.includes('services'))
        return { text: 'होम पेज पर ले जा रहा हूँ।', action: 'navigate_home', params: {} };

    // Stop
    if (t.includes('stop') || t.includes('band') || t.includes('ruko') || t.includes('बंद'))
        return { text: 'ठीक है, बंद कर रहा हूँ।', action: 'stop_voice', params: {} };

    // Bill generic
    if (t.includes('bill') || t.includes('बिल'))
        return { text: 'कौन सा बिल भरना है? बिजली, पानी, या गैस?', action: null, params: {} };

    // Help
    if (t.includes('help') || t.includes('madad') || t.includes('मदद') || t.includes('kya kar'))
        return { text: 'यहाँ आप बिजली, पानी, गैस बिल भर सकते हैं, शिकायत दर्ज कर सकते हैं, नाम बदलवा सकते हैं, या नया कनेक्शन ले सकते हैं।', action: null, params: {} };

    // Default
    return { text: 'मैं समझ नहीं पाया। कृपया दोबारा बोलिए — जैसे बिजली बिल, पानी बिल, या शिकायत।', action: null, params: {} };
}


// ═══════════════════════════════════════════════════
// MAIN: getAssistantGuidance — THE ONLY ENTRY POINT
// All voice queries go through here. No KB, no quick lookup.
// ═══════════════════════════════════════════════════

export async function getAssistantGuidance(
    userInput, currentScreen, currentPath, lang, history, blindMode, pageData
) {
    const systemPrompt = buildSystemPrompt(lang, currentScreen, currentPath, history, blindMode, pageData);

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
        console.error('[Gemini] Guidance error:', error);
        throw error;
    }
}

// ═══════════════════════════════════════════════════
// PROACTIVE HELP — page navigation announcements
// ═══════════════════════════════════════════════════

export async function getProactiveHelp(currentScreen, currentPath, lang, history, blindMode, pageData) {
    const languageName = LANG_NAMES[lang] || 'Hindi';

    const blindInfo = blindMode && pageData
        ? `\nBLIND MODE ACTIVE. Page data: ${JSON.stringify(pageData)}\nDescribe ALL on-screen elements.`
        : '';

    const systemPrompt = `You are SUVIDHA Setu's voice assistant. User just navigated to a new page.

STATE: screen=${currentScreen}, path=${currentPath}, lang=${lang}
${blindInfo}

Tell user what this page is for and how to use it. Include specific guidance:
- Bill pages: tell them to enter khata sankhya with example (PSEB-123456, PHED-789012, GPL-345678)
- Complaint: tell them the categories available
- Name change / New connection: tell them the steps
- Home: tell them what services are available

Keep it SHORT (2-3 sentences max). Be warm and helpful. Respond in ${languageName}.

Respond ONLY in JSON:
{
  "text": "your announcement in ${languageName}"
}`;

    try {
        const result = await callGemini(systemPrompt, `User navigated to ${currentScreen} at ${currentPath}`);
        // If callGemini returned an offline fallback (generic text), use page-specific instead
        if (result && result.text && !result.text.includes('समझ नहीं पाया') && !result.text.includes('दोबारा बोलिए')) {
            return result;
        }
    } catch (error) {
        console.error('[Gemini] Proactive help error:', error);
    }

    // ═══ Page-specific offline fallback ═══
    return { text: getPageGuidance(currentPath, currentScreen, lang) };
}

// ── Page-Specific Guidance (offline) ────────────────
function getPageGuidance(path, screen, lang) {
    const isHi = lang !== 'en';

    // Screen-based guidance (for screens without routes)
    if (screen === 'idle' || screen === 'gateway') {
        return isHi
            ? 'सुविधा सेतु में आपका स्वागत है। यहाँ आप बिजली, पानी, गैस बिल भर सकते हैं, शिकायत दर्ज कर सकते हैं, या नया कनेक्शन ले सकते हैं। बोलिए क्या करना है?'
            : 'Welcome to SUVIDHA Setu. Pay bills, file complaints, or apply for new connections. What would you like to do?';
    }
    if (screen === 'citizen-auth') {
        return isHi
            ? 'आधार लॉगिन का पेज खुल गया है। अपना आधार नंबर डालें और अंगूठा, आइरिस, या OTP से वेरिफाई करें।'
            : 'Aadhaar login page is open. Enter your Aadhaar number and verify with thumb, iris, or OTP.';
    }
    if (screen === 'citizen-dashboard') {
        return isHi
            ? 'सिटीज़न डैशबोर्ड खुल गया है। यहाँ से नाम बदलवाना, नया कनेक्शन, या बिल भरना — सब कर सकते हैं।'
            : 'Citizen dashboard is open. Name change, new connection, or bill payment — you can do everything from here.';
    }

    // Route-based guidance
    if (path.includes('/bill/electricity')) {
        return isHi
            ? 'बिजली बिल का पेज खुल गया है। नीचे दिए नंबर पैड के बटन से अपनी खाता संख्या डालें, जैसे PSEB-123456। पूरी संख्या डालने के बाद ओके बोलें या नीचे हरा बटन दबाएं।'
            : 'Electricity bill page is open. Use the numpad buttons below to enter your account number like PSEB-123456. After entering, say OK or press the green button.';
    }
    if (path.includes('/bill/water')) {
        return isHi
            ? 'पानी बिल का पेज खुल गया है। नीचे नंबर पैड से खाता संख्या डालें, जैसे PHED-789012। पूरा नंबर डालकर ओके बोलें।'
            : 'Water bill page is open. Enter your account number using the numpad, like PHED-789012. Say OK when done.';
    }
    if (path.includes('/bill/gas')) {
        return isHi
            ? 'गैस बिल का पेज खुल गया है। नीचे नंबर पैड से LPG ID डालें, जैसे GPL-345678। पूरा नंबर डालकर ओके बोलें।'
            : 'Gas bill page is open. Enter your LPG ID using the numpad, like GPL-345678. Say OK when done.';
    }
    if (path.includes('/bill/property-tax')) {
        return isHi
            ? 'Property Tax का पेज खुल गया है। अपनी Property ID डालें — यह आपकी पिछली टैक्स रसीद पर या नगरपालिका ऑफिस से मिलेगी।'
            : 'Property Tax page is open. Enter your Property ID from your previous tax receipt.';
    }
    if (path.includes('/complaint')) {
        return isHi
            ? 'शिकायत का पेज खुल गया है। छह श्रेणियां हैं — टूटी स्ट्रीटलाइट, पानी सप्लाई, कचरा, बिजली वोल्टेज, सड़क गड्ढा, या अन्य। बोलें क्या समस्या है, मैं खुद श्रेणी चुन लूँगा।'
            : 'Complaint page is open. Six categories — streetlight, water, garbage, voltage, road damage, or other. Tell me your issue.';
    }
    if (path.includes('/name-change')) {
        return isHi
            ? 'नाम बदलाव का फॉर्म खुल गया है। कनेक्शन का प्रकार चुनें — बिजली, पानी, या गैस। फिर पुराना और नया नाम डालें, दस्तावेज़ अपलोड करें, और सबमिट करें।'
            : 'Name change form is open. Select connection type, enter old and new name, upload documents, and submit.';
    }
    if (path.includes('/new-connection')) {
        return isHi
            ? 'नया कनेक्शन का फॉर्म खुल गया है। कनेक्शन का प्रकार चुनें, DigiLocker से दस्तावेज़ लिए जाएंगे, फॉर्म भरें और सबमिट करें। 7-15 दिन में कनेक्शन हो जाएगा।'
            : 'New connection form is open. Select type, documents from DigiLocker, fill form and submit. Connection in 7-15 days.';
    }
    if (path.includes('/admin')) {
        return isHi
            ? 'एडमिन डैशबोर्ड खुल गया है। यहाँ सभी लेनदेन, शिकायतें, और किओस्क स्थिति दिखती है।'
            : 'Admin dashboard is open. Shows all transactions, complaints, and kiosk status.';
    }

    // Home page
    if (path === '/' || path === '') {
        return isHi
            ? 'होम पेज खुल गया है। यहाँ चार सेवाएं हैं — बिजली बिल, पानी बिल, गैस बिल, और Property Tax। बोलें कौन सा बिल भरना है, या शिकायत दर्ज करनी है।'
            : 'Home page is open. Four services — electricity, water, gas, and property tax. Tell me which bill to pay or file a complaint.';
    }

    // Generic fallback
    return isHi
        ? 'इस पेज पर आपका स्वागत है। बताइए क्या करना है?'
        : 'Welcome to this page. How can I help?';
}
