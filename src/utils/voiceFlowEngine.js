/**
 * ═══════════════════════════════════════════════════════════
 * Voice Flow Engine — Zero-Latency Hardcoded Conversation Brain
 *
 * Handles ALL common interactions with pre-written responses.
 * Gemini API is ONLY called for unknown/unexpected queries.
 *
 * Design: keyword matching → instant response → action
 * Supports: Hindi, English, Punjabi
 * ═══════════════════════════════════════════════════════════
 */

// ── Keyword Dictionaries ──────────────────────────────────

const KW = {
    // Service keywords (all variations)
    electricity: ['bijli', 'electricity', 'electric', 'light', 'बिजली', 'ਬਿਜਲੀ', 'light bill', 'bijlee', 'bijali'],
    water: ['paani', 'water', 'jal', 'पानी', 'जल', 'ਪਾਣੀ', 'pani'],
    gas: ['gas', 'गैस', 'ਗੈਸ', 'lpg', 'cylinder', 'silinder'],
    property: ['property', 'tax', 'ghar', 'makan', 'house', 'संपत्ति', 'प्रॉपर्टी', 'घर', 'ਜਾਇਦਾਦ', 'ਘਰ'],
    complaint: ['complaint', 'shikayat', 'problem', 'issue', 'शिकायत', 'समस्या', 'ਸ਼ਿਕਾਇਤ', 'shikaayat'],

    // Intent keywords
    bill: ['bill', 'bil', 'बिल', 'ਬਿੱਲ', 'bharna', 'jama', 'pay', 'payment', 'भरना', 'जमा', 'भुगतान'],
    yes: ['yes', 'haan', 'ha', 'ji', 'theek', 'thik', 'ok', 'okay', 'hnji', 'bilkul', 'sahi', 'हाँ', 'हां', 'जी', 'ठीक', 'ਹਾਂ', 'ਜੀ'],
    no: ['no', 'nahi', 'nai', 'mat', 'nahin', 'नहीं', 'नही', 'ना', 'ਨਹੀਂ'],
    voice: ['voice', 'awaaz', 'bol', 'bolo', 'aawaz', 'आवाज़', 'बोल', 'ਆਵਾਜ਼', 'ਬੋਲ'],
    button: ['button', 'btn', 'dabao', 'touch', 'screen', 'बटन', 'दबाओ', 'ਬਟਨ'],
    own: ['apna', 'mera', 'khud', 'own', 'अपना', 'मेरा', 'खुद', 'ਆਪਣਾ', 'ਮੇਰਾ', 'naam', 'नाम', 'aadhaar', 'aadhar'],
    relative: ['rishtedar', 'relative', 'dusra', 'kisi', 'someone', 'guest', 'bina', 'रिश्तेदार', 'दूसरा', 'किसी', 'बिना', 'ਰਿਸ਼ਤੇਦਾਰ'],
    help: ['help', 'madad', 'kaise', 'kahan', 'kya', 'how', 'where', 'what', 'मदद', 'कैसे', 'कहाँ', 'क्या', 'ਮਦਦ', 'ਕਿਵੇਂ', 'ਕਿੱਥੇ'],
    consumer: ['consumer', 'number', 'sankhya', 'id', 'account', 'नंबर', 'संख्या', 'ਨੰਬਰ', 'khata'],
    back: ['back', 'peeche', 'wapas', 'पीछे', 'वापस', 'ਪਿੱਛੇ', 'ਵਾਪਸ'],
    home: ['home', 'ghar', 'shuru', 'start', 'main', 'होम', 'शुरू', 'ਹੋਮ', 'ਸ਼ੁਰੂ'],
    stop: ['stop', 'band', 'ruko', 'bas', 'chup', 'बंद', 'रुको', 'बस', 'ਬੰਦ', 'ਰੁਕੋ'],
    greet: ['hello', 'hi', 'namaste', 'namaskar', 'sat sri akal', 'नमस्ते', 'नमस्कार', 'ਸਤ', 'ਸ੍ਰੀ'],
};

// ── Match helpers ─────────────────────────────────────────

function matchesAny(text, keywords) {
    const lower = text.toLowerCase().trim();
    return keywords.some(kw => lower.includes(kw));
}

function detectService(text) {
    if (matchesAny(text, KW.electricity)) return 'electricity';
    if (matchesAny(text, KW.water)) return 'water';
    if (matchesAny(text, KW.gas)) return 'gas';
    if (matchesAny(text, KW.property)) return 'property';
    if (matchesAny(text, KW.complaint)) return 'complaint';
    return null;
}

function detectIntent(text) {
    if (matchesAny(text, KW.stop)) return 'stop';
    if (matchesAny(text, KW.back)) return 'back';
    if (matchesAny(text, KW.home)) return 'home';
    if (matchesAny(text, KW.yes)) return 'yes';
    if (matchesAny(text, KW.no)) return 'no';
    if (matchesAny(text, KW.voice)) return 'voice';
    if (matchesAny(text, KW.button)) return 'button';
    if (matchesAny(text, KW.own)) return 'own';
    if (matchesAny(text, KW.relative)) return 'relative';
    if (matchesAny(text, KW.consumer)) return 'consumer_help';
    if (matchesAny(text, KW.help)) return 'help';
    if (matchesAny(text, KW.greet)) return 'greet';
    const svc = detectService(text);
    if (svc) return `service_${svc}`;
    if (matchesAny(text, KW.bill)) return 'bill_general';
    return null;
}

// ── Pre-built Responses (per language) ────────────────────

const RESPONSES = {
    // ─── GATEWAY FLOWS ────────────────────────
    gateway_greeting: {
        hi: 'नमस्ते! मैं सुविधा सेतु का सहायक हूँ। क्या आपके नाम पर बिल है और आपके पास आधार कार्ड है? या आप किसी रिश्तेदार का बिल जमा कर रहे हैं?',
        en: 'Hello! I am your SUVIDHA Setu assistant. Is the bill in your name and do you have your Aadhaar card? Or are you paying a relative\'s bill?',
        pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਸੁਵਿਧਾ ਸੇਤੂ ਦਾ ਸਹਾਇਕ ਹਾਂ। ਕੀ ਬਿੱਲ ਤੁਹਾਡੇ ਨਾਂ ਤੇ ਹੈ? ਜਾਂ ਕਿਸੇ ਰਿਸ਼ਤੇਦਾਰ ਦਾ ਬਿੱਲ ਭਰ ਰਹੇ ਹੋ?',
    },
    gateway_own: {
        hi: 'ठीक है, आपको सिटीज़न लॉगिन करना होगा। आधार नंबर से लॉगिन करेंगे। ले जा रहा हूँ।',
        en: 'Okay, you need to login as a citizen using your Aadhaar. Taking you to login.',
        pa: 'ਠੀਕ ਹੈ, ਤੁਹਾਨੂੰ ਸਿਟੀਜ਼ਨ ਲੌਗਇਨ ਕਰਨਾ ਹੋਵੇਗਾ। ਲੈ ਕੇ ਜਾ ਰਿਹਾ ਹਾਂ।',
    },
    gateway_relative: {
        hi: 'ठीक है, बिना लॉगिन के बिल भर सकते हैं। गेस्ट मोड में ले जा रहा हूँ।',
        en: 'Okay, you can pay bills without login. Taking you to guest mode.',
        pa: 'ਠੀਕ ਹੈ, ਬਿਨਾਂ ਲੌਗਇਨ ਦੇ ਬਿੱਲ ਭਰ ਸਕਦੇ ਹੋ। ਗੈਸਟ ਮੋਡ ਵਿੱਚ ਲੈ ਕੇ ਜਾ ਰਿਹਾ ਹਾਂ।',
    },

    // ─── HOME / SERVICE SELECTION ─────────────
    home_greeting: {
        hi: 'आप क्या करना चाहते हैं? बिल जमा करना है तो बोलें — बिजली, पानी, गैस, प्रॉपर्टी टैक्स। या शिकायत दर्ज करनी है?',
        en: 'What would you like to do? For bill payment, say — electricity, water, gas, or property tax. Or you can file a complaint.',
        pa: 'ਤੁਸੀਂ ਕੀ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ? ਬਿੱਲ ਭਰਨਾ ਹੈ ਤਾਂ ਬੋਲੋ — ਬਿਜਲੀ, ਪਾਣੀ, ਗੈਸ, ਜਾਂ ਪ੍ਰਾਪਰਟੀ ਟੈਕਸ।',
    },
    bill_general: {
        hi: 'कौन सा बिल जमा करना है? बोलें — बिजली का, पानी का, गैस का, या प्रॉपर्टी टैक्स?',
        en: 'Which bill do you want to pay? Say — electricity, water, gas, or property tax.',
        pa: 'ਕਿਹੜਾ ਬਿੱਲ ਭਰਨਾ ਹੈ? ਬੋਲੋ — ਬਿਜਲੀ, ਪਾਣੀ, ਗੈਸ, ਜਾਂ ਪ੍ਰਾਪਰਟੀ ਟੈਕਸ?',
    },

    // ─── SERVICE NAVIGATION ───────────────────
    navigate_electricity: {
        hi: 'ठीक है, बिजली का बिल। यहाँ अपना कंस्यूमर नंबर डालें। कंस्यूमर नंबर आपके बिजली के बिल पर सबसे ऊपर लिखा होता है।',
        en: 'Okay, electricity bill. Please enter your consumer number. You can find it at the top of your electricity bill.',
        pa: 'ਠੀਕ ਹੈ, ਬਿਜਲੀ ਦਾ ਬਿੱਲ। ਆਪਣਾ ਕੰਸਿਊਮਰ ਨੰਬਰ ਪਾਓ। ਇਹ ਤੁਹਾਡੇ ਬਿਜਲੀ ਦੇ ਬਿੱਲ ਤੇ ਸਭ ਤੋਂ ਉੱਪਰ ਲਿਖਿਆ ਹੁੰਦਾ ਹੈ।',
    },
    navigate_water: {
        hi: 'ठीक है, पानी का बिल। यहाँ अपना कंस्यूमर नंबर डालें। यह आपके पानी के बिल पर टॉप पर लिखा होता है।',
        en: 'Okay, water bill. Enter your consumer number. It\'s printed at the top of your water bill.',
        pa: 'ਠੀਕ ਹੈ, ਪਾਣੀ ਦਾ ਬਿੱਲ। ਆਪਣਾ ਕੰਸਿਊਮਰ ਨੰਬਰ ਪਾਓ।',
    },
    navigate_gas: {
        hi: 'ठीक है, गैस का बिल। अपना कंस्यूमर नंबर डालें। यह आपके गैस बिल पर या सिलेंडर की रसीद पर होता है।',
        en: 'Okay, gas bill. Enter your consumer number from your gas bill or cylinder receipt.',
        pa: 'ਠੀਕ ਹੈ, ਗੈਸ ਦਾ ਬਿੱਲ। ਆਪਣਾ ਕੰਸਿਊਮਰ ਨੰਬਰ ਪਾਓ।',
    },
    navigate_property: {
        hi: 'ठीक है, प्रॉपर्टी टैक्स। अपना प्रॉपर्टी ID या खाता नंबर डालें। यह आपकी पिछली रसीद पर होता है।',
        en: 'Okay, property tax. Enter your property ID or account number from your previous receipt.',
        pa: 'ਠੀਕ ਹੈ, ਪ੍ਰਾਪਰਟੀ ਟੈਕਸ। ਆਪਣਾ ਪ੍ਰਾਪਰਟੀ ID ਪਾਓ।',
    },
    navigate_complaint: {
        hi: 'शिकायत दर्ज करते हैं। अपनी शिकायत बताएं — क्या समस्या है?',
        en: 'Let\'s file a complaint. What\'s the issue?',
        pa: 'ਸ਼ਿਕਾਇਤ ਦਰਜ ਕਰਦੇ ਹਾਂ। ਆਪਣੀ ਸ਼ਿਕਾਇਤ ਦੱਸੋ।',
    },

    // ─── HELP / FAQ ───────────────────────────
    consumer_help: {
        hi: 'कंस्यूमर नंबर आपके बिल पर सबसे ऊपर छपा होता है। अगर बिल नहीं है तो मीटर के ऊपर भी लिखा होता है। बिजली का 10-12 अंक, पानी का 8-10 अंक होता है।',
        en: 'Your consumer number is printed at the top of your bill. If you don\'t have the bill, it\'s also on your meter. Electricity numbers are 10-12 digits, water numbers are 8-10 digits.',
        pa: 'ਕੰਸਿਊਮਰ ਨੰਬਰ ਤੁਹਾਡੇ ਬਿੱਲ ਤੇ ਸਭ ਤੋਂ ਉੱਪਰ ਛਪਿਆ ਹੁੰਦਾ ਹੈ। ਜੇ ਬਿੱਧ ਨਹੀਂ ਹੈ ਤਾਂ ਮੀਟਰ ਤੇ ਵੀ ਲਿਖਿਆ ਹੁੰਦਾ ਹੈ।',
    },
    general_help: {
        hi: 'मैं आपकी मदद कर सकता हूँ। आप बोल सकते हैं: बिजली का बिल, पानी का बिल, गैस का बिल, प्रॉपर्टी टैक्स, या शिकायत। और कुछ पूछना हो तो बताइए।',
        en: 'I can help you. You can say: electricity bill, water bill, gas bill, property tax, or complaint. Ask me anything else!',
        pa: 'ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ। ਤੁਸੀਂ ਬੋਲ ਸਕਦੇ ਹੋ: ਬਿਜਲੀ, ਪਾਣੀ, ਗੈਸ, ਪ੍ਰਾਪਰਟੀ ਟੈਕਸ, ਜਾਂ ਸ਼ਿਕਾਇਤ।',
    },
    greet: {
        hi: 'नमस्ते! बताइए क्या करना है? बिल भरना है, शिकायत करनी है, या कुछ और?',
        en: 'Hello! What would you like to do? Pay a bill, file a complaint, or something else?',
        pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਦੱਸੋ ਕੀ ਕਰਨਾ ਹੈ?',
    },
    go_back: {
        hi: 'ठीक है, पीछे जा रहा हूँ।',
        en: 'Okay, going back.',
        pa: 'ਠੀਕ ਹੈ, ਪਿੱਛੇ ਜਾ ਰਿਹਾ ਹਾਂ।',
    },
    go_home: {
        hi: 'होम पेज पर ले जा रहा हूँ।',
        en: 'Taking you to the home page.',
        pa: 'ਹੋਮ ਪੇਜ ਤੇ ਲੈ ਕੇ ਜਾ ਰਿਹਾ ਹਾਂ।',
    },
    stop_voice: {
        hi: 'ठीक है, बंद कर रहा हूँ। जब चाहें माइक दबाएं।',
        en: 'Okay, stopping. Tap the mic anytime to start again.',
        pa: 'ਠੀਕ ਹੈ, ਬੰਦ ਕਰ ਰਿਹਾ ਹਾਂ। ਜਦੋਂ ਚਾਹੋ ਮਾਈਕ ਦਬਾਓ।',
    },
    not_understood: {
        hi: 'माफ़ कीजिए, समझ नहीं आया। क्या आप बिल भरना चाहते हैं या शिकायत करनी है?',
        en: 'Sorry, I didn\'t understand. Do you want to pay a bill or file a complaint?',
        pa: 'ਮਾਫ਼ ਕਰਨਾ, ਸਮਝ ਨਹੀਂ ਆਇਆ। ਕੀ ਤੁਸੀਂ ਬਿੱਲ ਭਰਨਾ ਚਾਹੁੰਦੇ ਹੋ ਜਾਂ ਸ਼ਿਕਾਇਤ?',
    },
};

// ── Route map ─────────────────────────────────────────────
const SERVICE_ROUTES = {
    electricity: '/bill/electricity',
    water: '/bill/water',
    gas: '/bill/gas',
    property: '/bill/electricity', // same component, different type
    complaint: '/complaint',
};

// ── Main Flow Processor ───────────────────────────────────

/**
 * Process a transcript and return an immediate response.
 *
 * @param {string} transcript - What the user said
 * @param {string} lang - Current app language (en/hi/pa)
 * @param {string} currentScreen - Current screen state
 * @param {string} currentPath - Current route path
 * @returns {{ text: string, action: string|null, route: string|null, screenChange: string|null, shouldStop: boolean, needsGemini: boolean }}
 */
export function processVoiceFlow(transcript, lang = 'en', currentScreen = 'guest', currentPath = '/') {
    const intent = detectIntent(transcript);
    const service = detectService(transcript);
    const r = (key) => RESPONSES[key]?.[lang] || RESPONSES[key]?.en || '';

    // ── Universal intents ──────────────────
    if (intent === 'stop') {
        return { text: r('stop_voice'), action: null, route: null, screenChange: null, shouldStop: true, needsGemini: false };
    }
    if (intent === 'back') {
        return { text: r('go_back'), action: 'go_back', route: null, screenChange: null, shouldStop: false, needsGemini: false };
    }
    if (intent === 'home') {
        return { text: r('go_home'), action: 'go_home', route: '/', screenChange: null, shouldStop: false, needsGemini: false };
    }

    // ── GATEWAY SCREEN flows ──────────────
    if (currentScreen === 'gateway') {
        if (intent === 'voice' || intent === 'greet') {
            return { text: r('gateway_greeting'), action: null, route: null, screenChange: null, shouldStop: false, needsGemini: false };
        }
        if (intent === 'own' || intent === 'yes') {
            return { text: r('gateway_own'), action: 'set_screen', route: null, screenChange: 'citizen', shouldStop: false, needsGemini: false };
        }
        if (intent === 'relative' || intent === 'no') {
            return { text: r('gateway_relative'), action: 'set_screen', route: null, screenChange: 'guest', shouldStop: false, needsGemini: false };
        }
        if (intent === 'button') {
            return { text: lang === 'hi' ? 'ठीक है, स्क्रीन पर बटन दबाकर आगे बढ़ें।' : 'Okay, use the buttons on screen.', action: null, route: null, screenChange: null, shouldStop: true, needsGemini: false };
        }
        // If they mention a bill directly from gateway
        if (service) {
            return { text: r('gateway_relative'), action: 'set_screen', route: SERVICE_ROUTES[service], screenChange: 'guest', shouldStop: false, needsGemini: false };
        }
        if (intent === 'bill_general') {
            return { text: r('gateway_greeting'), action: null, route: null, screenChange: null, shouldStop: false, needsGemini: false };
        }
        // Unknown on gateway — use gentle Gemini, or default
        return { text: r('gateway_greeting'), action: null, route: null, screenChange: null, shouldStop: false, needsGemini: false };
    }

    // ── HOME SCREEN / SERVICE SELECTION flows ──
    if (currentScreen === 'guest' || currentScreen === 'citizen-dashboard') {
        // Direct service request
        if (service) {
            const route = SERVICE_ROUTES[service];
            return { text: r(`navigate_${service}`), action: 'navigate', route, screenChange: null, shouldStop: false, needsGemini: false };
        }

        // On home page asking what to do
        if (currentPath === '/') {
            if (intent === 'greet' || intent === 'help') {
                return { text: r('home_greeting'), action: null, route: null, screenChange: null, shouldStop: false, needsGemini: false };
            }
            if (intent === 'bill_general') {
                return { text: r('bill_general'), action: null, route: null, screenChange: null, shouldStop: false, needsGemini: false };
            }
        }

        // On a bill page
        if (currentPath.startsWith('/bill/') || currentPath === '/complaint') {
            if (intent === 'consumer_help') {
                return { text: r('consumer_help'), action: null, route: null, screenChange: null, shouldStop: false, needsGemini: false };
            }
            if (intent === 'help') {
                return { text: r('consumer_help'), action: null, route: null, screenChange: null, shouldStop: false, needsGemini: false };
            }
        }

        // General help
        if (intent === 'help' || intent === 'greet') {
            return { text: r('general_help'), action: null, route: null, screenChange: null, shouldStop: false, needsGemini: false };
        }
        if (intent === 'consumer_help') {
            return { text: r('consumer_help'), action: null, route: null, screenChange: null, shouldStop: false, needsGemini: false };
        }
    }

    // ── FALLBACK: needs Gemini ─────────────
    return { text: null, action: null, route: null, screenChange: null, shouldStop: false, needsGemini: true };
}

/**
 * Get an initial greeting for when voice is first activated on a screen.
 */
export function getScreenGreeting(screen, lang = 'en') {
    const r = (key) => RESPONSES[key]?.[lang] || RESPONSES[key]?.en || '';
    if (screen === 'gateway') return r('gateway_greeting');
    if (screen === 'guest' || screen === 'citizen-dashboard') return r('home_greeting');
    return r('greet');
}

/**
 * Get the speech recognition language code for Web Speech API.
 */
export function getSpeechLangCode(lang) {
    const codes = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN', gu: 'gu-IN', ur: 'ur-IN' };
    return codes[lang] || 'hi-IN';
}
