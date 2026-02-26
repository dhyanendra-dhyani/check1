/**
 * ═══════════════════════════════════════════════════════════
 * Voice Knowledge Base — Conversational Decision Tree
 *
 * This is the "brain" of the voice agent. Instead of just keyword
 * navigation, the agent guides users through a natural conversation.
 *
 * FLOW:
 *   1. INITIAL: "आधार है या किसी और का बिल?"
 *   2. CITIZEN: "अंगूठा/OTP से पंजीकरण करें"
 *   3. GUEST:  "कौन सा बिल? बिजली/पानी/गैस"
 *   4. PAGE-SPECIFIC guidance for every screen
 *   5. COMMON Q&A (consumer number kaha, payment kaise, receipt)
 * ═══════════════════════════════════════════════════════════
 */

// ── CONVERSATION STATES ─────────────────────────────
export const CONV_STATES = {
    INITIAL: 'initial',       // First question after voice mode
    WAIT_PATH: 'wait_path',   // Waiting for citizen/guest answer
    GUEST_HOME: 'guest_home', // On guest home, asking which bill
    CITIZEN_AUTH: 'citizen_auth', // Guiding through login
    CITIZEN_DASH: 'citizen_dash', // On citizen dashboard
    BILL_PAGE: 'bill_page',   // On bill payment page
    COMPLAINT: 'complaint',   // On complaint page
    FREE_TALK: 'free_talk',   // General conversation (Gemini handles)
};

// ── INITIAL GREETING (after voice mode activated) ───
export const INITIAL_GREETINGS = {
    hi: 'ठीक है! बताइए, क्या आपके पास आधार कार्ड है, या आप किसी और का बिल जमा करने आये हैं? अपना बिल है तो अंगूठा लगाकर लॉगिन भी कर सकते हैं।',
    en: 'Tell me, do you have an Aadhaar card, or are you here to pay someone else\'s bill? If it\'s your own, you can login with your thumbprint too.',
    pa: 'ਦੱਸੋ, ਤੁਹਾਡੇ ਕੋਲ ਆਧਾਰ ਕਾਰਡ ਹੈ, ਜਾਂ ਤੁਸੀਂ ਕਿਸੇ ਹੋਰ ਦਾ ਬਿੱਲ ਭਰਨ ਆਏ ਹੋ?',
};

// ── KEYWORD DETECTORS ───────────────────────────────

// Citizen path keywords (own bill, has Aadhaar)
export const CITIZEN_KEYWORDS = [
    'apna', 'mera', 'aadhaar', 'aadhar', 'angootha', 'finger', 'thumb',
    'my own', 'meri', 'khud', 'haan', 'yes', 'ha', 'ji',
    'login', 'citizen', 'panjikaran', 'register',
    'अपना', 'मेरा', 'आधार', 'अंगूठा', 'खुद', 'हाँ', 'जी', 'पंजीकरण',
    'ਆਪਣਾ', 'ਮੇਰਾ', 'ਆਧਾਰ', 'ਅੰਗੂਠਾ', 'ਹਾਂ',
];

// Guest path keywords (someone else's bill, no Aadhaar)
export const GUEST_KEYWORDS = [
    'rishtedar', 'kisi aur', 'kisi ka', 'dusre', 'nahi', 'no', 'nah',
    'guest', 'bina login', 'bina', 'someone', 'else', 'other',
    'quick', 'jaldi', 'seedha', 'direct',
    'रिश्तेदार', 'किसी और', 'किसी का', 'दूसरे', 'नहीं', 'बिना',
    'ਕਿਸੇ ਹੋਰ', 'ਰਿਸ਼ਤੇਦਾਰ', 'ਨਹੀਂ', 'ਬਿਨਾਂ',
];

// Bill type keywords
export const BILL_KEYWORDS = {
    electricity: ['bijli', 'electricity', 'electric', 'light', 'lite', 'bijlee', 'बिजली', 'ਬਿਜਲੀ', 'vij'],
    water: ['paani', 'water', 'jal', 'pani', 'पानी', 'जल', 'ਪਾਣੀ', 'neeru'],
    gas: ['gas', 'lpg', 'cylinder', 'rasoi', 'गैस', 'रसोई', 'ਗੈਸ', 'silinder'],
};

export const COMPLAINT_KEYWORDS = [
    'complaint', 'shikayat', 'problem', 'samasya', 'issue', 'report',
    'शिकायत', 'समस्या', 'ਸ਼ਿਕਾਇਤ',
];

export const BACK_KEYWORDS = ['back', 'peeche', 'wapas', 'vapas', 'पीछे', 'वापस', 'ਪਿੱਛੇ', 'ਵਾਪਸ'];
export const HOME_KEYWORDS = ['home', 'ghar', 'shuru', 'होम', 'घर', 'ਹੋਮ', 'ਘਰ'];
export const STOP_KEYWORDS = ['stop', 'band', 'ruko', 'chup', 'bye', 'बंद', 'रुको', 'ਬੰਦ'];

// ── RESPONSE TEMPLATES (by state + by page) ─────────

export const RESPONSES = {
    // After detecting citizen path
    citizen_chosen: {
        hi: 'बहुत अच्छा! चलिए पंजीकरण करते हैं। नीचे तीन तरीके हैं — अंगूठा लगाइए, आँख स्कैन कराइए, या OTP से लॉगिन करें।',
        en: 'Great! Let\'s register. Three options below — thumbprint, iris scan, or OTP login.',
        pa: 'ਬਹੁਤ ਵਧੀਆ! ਚੱਲੋ ਪੰਜੀਕਰਣ ਕਰੀਏ। ਅੰਗੂਠਾ, ਅੱਖ ਸਕੈਨ, ਜਾਂ OTP।',
    },

    // After detecting guest path
    guest_chosen: {
        hi: 'ठीक है, बिना लॉगिन के भी सारे काम हो जाएँगे! बताइए कौन सा बिल भरना है — बिजली का, पानी का, या गैस का? शिकायत भी दर्ज कर सकते हैं।',
        en: 'No problem! You can do everything without login. Which bill — electricity, water, or gas? You can also file a complaint.',
        pa: 'ਠੀਕ ਹੈ, ਬਿਨਾਂ ਲੌਗਇਨ ਸਭ ਹੋ ਜਾਵੇਗਾ! ਕਿਹੜਾ ਬਿੱਲ — ਬਿਜਲੀ, ਪਾਣੀ, ਜਾਂ ਗੈਸ?',
    },

    // Page-specific guidance (spoken on navigation)
    page_guidance: {
        '/bill/electricity': {
            hi: 'बिजली बिल का पेज खुल गया। अब नीचे दिए नंबर पैड से consumer number डालें। Consumer number आपके पुराने बिजली बिल पर लिखा होता है। QR स्कैन भी कर सकते हैं।',
            en: 'Electricity bill page is open. Enter your consumer number using the keypad below. It\'s on your previous bill. You can also scan QR.',
            pa: 'ਬਿਜਲੀ ਬਿੱਲ ਦਾ ਪੰਨਾ ਖੁੱਲ ਗਿਆ। ਨੰਬਰ ਪੈਡ ਤੋਂ consumer number ਪਾਓ।',
        },
        '/bill/water': {
            hi: 'पानी बिल का पेज खुल गया। Consumer number डालें, यह आपके पिछले बिल पर लिखा होता है।',
            en: 'Water bill page is open. Enter your consumer number from your previous bill.',
            pa: 'ਪਾਣੀ ਬਿੱਲ ਦਾ ਪੰਨਾ ਖੁੱਲ ਗਿਆ। Consumer number ਪਾਓ।',
        },
        '/bill/gas': {
            hi: 'गैस बिल का पेज खुल गया। LPG ID या consumer number डालें।',
            en: 'Gas bill page is open. Enter your LPG ID or consumer number.',
            pa: 'ਗੈਸ ਬਿੱਲ ਦਾ ਪੰਨਾ ਖੁੱਲ ਗਿਆ। LPG ID ਜਾਂ consumer number ਪਾਓ।',
        },
        '/complaint': {
            hi: 'शिकायत का पेज खुल गया। नीचे से श्रेणी चुनें — बिजली, पानी, सड़क, या अन्य। या मुझे बताएं क्या समस्या है, मैं खुद श्रेणी चुन लूँगा।',
            en: 'Complaint page is open. Choose a category — electricity, water, road, or other. Or tell me the issue and I\'ll pick the category.',
            pa: 'ਸ਼ਿਕਾਇਤ ਦਾ ਪੰਨਾ ਖੁੱਲ ਗਿਆ। ਸ਼੍ਰੇਣੀ ਚੁਣੋ ਜਾਂ ਮੈਨੂੰ ਸਮੱਸਿਆ ਦੱਸੋ।',
        },
        '/': {
            hi: 'होम पेज खुल गया। कौन सा बिल भरना है — बिजली, पानी, या गैस? शिकायत भी दर्ज कर सकते हैं।',
            en: 'Home page is open. Which bill — electricity, water, or gas? You can also file a complaint.',
            pa: 'ਹੋਮ ਪੰਨਾ ਖੁੱਲ ਗਿਆ। ਕਿਹੜਾ ਬਿੱਲ — ਬਿਜਲੀ, ਪਾਣੀ, ਜਾਂ ਗੈਸ?',
        },
    },

    // After citizen auth success
    citizen_dashboard: {
        hi: 'आपका डैशबोर्ड खुल गया। यहाँ से बिल भर सकते हैं, शिकायत दर्ज कर सकते हैं, और अपनी सारी जानकारी देख सकते हैं। बोलिए क्या करना है?',
        en: 'Your dashboard is open. You can pay bills, file complaints, and view your information. What would you like to do?',
        pa: 'ਤੁਹਾਡਾ ਡੈਸ਼ਬੋਰਡ ਖੁੱਲ ਗਿਆ। ਬਿੱਲ, ਸ਼ਿਕਾਇਤ, ਜਾਂ ਜਾਣਕਾਰੀ — ਕੀ ਕਰਨਾ ਹੈ?',
    },

    // Not understood
    not_understood: {
        hi: 'माफ कीजिए, मैं समझ नहीं पाया। क्या आप बिल भरना चाहते हैं, शिकायत दर्ज करना चाहते हैं, या कुछ और?',
        en: 'Sorry, I didn\'t understand. Do you want to pay a bill, file a complaint, or something else?',
        pa: 'ਮਾਫ਼ ਕਰਨਾ, ਸਮਝ ਨਹੀਂ ਆਇਆ। ਬਿੱਲ ਭਰਨਾ ਹੈ, ਸ਼ਿਕਾਇਤ, ਜਾਂ ਕੁਝ ਹੋਰ?',
    },

    // Stop command
    stopping: {
        hi: 'ठीक है, बंद कर रहा हूँ। फिर से बात करनी हो तो माइक बटन दबाएं।',
        en: 'Okay, stopping. Press the mic button to talk again.',
        pa: 'ਠੀਕ ਹੈ, ਬੰਦ ਕਰ ਰਿਹਾ ਹਾਂ।',
    },
};

// ── COMMON Q&A (hardcoded for instant response) ─────

export const COMMON_QA = [
    {
        keywords: ['consumer number', 'consumer', 'number kahan', 'kaha se', 'kaise milega', 'कंज्यूमर', 'नंबर कहाँ', 'कहाँ से'],
        answer: {
            hi: 'Consumer number आपके पुराने बिजली या पानी बिल पर ऊपर लिखा होता है। अगर बिल नहीं है, तो QR कोड स्कैन करें या नजदीकी ऑफिस से पूछें।',
            en: 'Consumer number is printed on top of your previous electricity or water bill. If you don\'t have the bill, scan QR or ask at the nearest office.',
            pa: 'Consumer number ਤੁਹਾਡੇ ਪੁਰਾਣੇ ਬਿੱਲ \'ਤੇ ਲਿਖਿਆ ਹੁੰਦਾ ਹੈ।',
        },
    },
    {
        keywords: ['kitna paisa', 'kitna', 'amount', 'bill kitna', 'कितना', 'कितने पैसे', 'ਕਿੰਨਾ'],
        answer: {
            hi: 'बिल की राशि जानने के लिए पहले consumer number डालें, फिर बिल दिखेगा।',
            en: 'Enter your consumer number first, then the bill amount will be shown.',
            pa: 'ਪਹਿਲਾਂ consumer number ਪਾਓ, ਫਿਰ ਬਿੱਲ ਦੀ ਰਕਮ ਦਿਖੇਗੀ।',
        },
    },
    {
        keywords: ['upi', 'card', 'cash', 'payment', 'bhugtan', 'kaise', 'pay kaise', 'भुगतान', 'कैसे', 'ਕਿਵੇਂ'],
        answer: {
            hi: 'UPI, कार्ड, या कैश — तीनों तरीके से भुगतान कर सकते हैं। Consumer number डालने के बाद भुगतान के विकल्प आएंगे।',
            en: 'You can pay via UPI, card, or cash. Options will appear after entering the consumer number.',
            pa: 'UPI, ਕਾਰਡ, ਜਾਂ ਕੈਸ਼ — ਤਿੰਨੋਂ ਤਰੀਕਿਆਂ ਨਾਲ ਭੁਗਤਾਨ ਹੋ ਸਕਦਾ ਹੈ।',
        },
    },
    {
        keywords: ['receipt', 'raseed', 'download', 'print', 'रसीद', 'ਰਸੀਦ'],
        answer: {
            hi: 'भुगतान सफल होने के बाद रसीद डाउनलोड और प्रिंट का बटन आएगा।',
            en: 'After successful payment, you\'ll see download and print buttons for the receipt.',
            pa: 'ਭੁਗਤਾਨ ਤੋਂ ਬਾਅਦ ਰਸੀਦ ਡਾਊਨਲੋਡ ਅਤੇ ਪ੍ਰਿੰਟ ਦਾ ਬਟਨ ਆਵੇਗਾ।',
        },
    },
    {
        keywords: ['help', 'madad', 'sahayata', 'kya kar', 'मदद', 'सहायता', 'ਮਦਦ'],
        answer: {
            hi: 'आप यहाँ बिजली, पानी, गैस बिल भर सकते हैं। शिकायत भी दर्ज कर सकते हैं। बोलिए क्या करना है!',
            en: 'You can pay electricity, water, gas bills here. You can also file complaints. Tell me what you need!',
            pa: 'ਇੱਥੇ ਬਿਜਲੀ, ਪਾਣੀ, ਗੈਸ ਬਿੱਲ ਭਰ ਸਕਦੇ ਹੋ। ਸ਼ਿਕਾਇਤ ਵੀ ਦਰਜ ਕਰ ਸਕਦੇ ਹੋ।',
        },
    },
    {
        keywords: ['shikayat kaise', 'complaint kaise', 'शिकायत कैसे', 'ਸ਼ਿਕਾਇਤ ਕਿਵੇਂ'],
        answer: {
            hi: 'शिकायत दर्ज करने के लिए बोलें "शिकायत" या "complaint"। फिर श्रेणी चुनें और समस्या बताएं।',
            en: 'Say "complaint" to file a complaint. Then choose a category and describe your issue.',
            pa: 'ਸ਼ਿਕਾਇਤ ਦਰਜ ਕਰਨ ਲਈ "ਸ਼ਿਕਾਇਤ" ਬੋਲੋ। ਫਿਰ ਸ਼੍ਰੇਣੀ ਚੁਣੋ।',
        },
    },
];

// ── HELPER FUNCTIONS ────────────────────────────────

/**
 * Check if transcript matches any keyword list
 */
export function matchesKeywords(text, keywords) {
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
}

/**
 * Detect which bill type from transcript
 */
export function detectBillType(text) {
    const lower = text.toLowerCase();
    for (const [type, words] of Object.entries(BILL_KEYWORDS)) {
        if (words.some(w => lower.includes(w))) return type;
    }
    return null;
}

/**
 * Check common Q&A — returns answer or null
 */
export function findCommonAnswer(text, lang) {
    const lower = text.toLowerCase();
    for (const qa of COMMON_QA) {
        if (qa.keywords.some(k => lower.includes(k))) {
            return qa.answer[lang] || qa.answer.en;
        }
    }
    return null;
}

/**
 * Get page guidance for a route
 */
export function getPageGuidance(route, lang) {
    const g = RESPONSES.page_guidance[route];
    if (g) return g[lang] || g.en;
    return null;
}

/**
 * Get a response by key
 */
export function getResponse(key, lang) {
    const r = RESPONSES[key];
    if (r) return r[lang] || r.en;
    return null;
}

/**
 * Get initial greeting
 */
export function getInitialGreeting(lang) {
    return INITIAL_GREETINGS[lang] || INITIAL_GREETINGS.en;
}
