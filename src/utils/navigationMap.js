/**
 * ═══════════════════════════════════════════════════════════
 * Navigation Map — Maps intents & labels to routes
 * Used by the Gemini voice agent to understand available actions
 * ═══════════════════════════════════════════════════════════
 */

/** All navigable routes with multilingual labels */
export const NAVIGATION_MAP = {
    home: {
        route: '/',
        action: 'navigate',
        labels: {
            en: ['home', 'go home', 'main page', 'start page', 'services'],
            hi: ['होम', 'घर', 'मुख्य पृष्ठ', 'शुरू', 'सेवाएं'],
            pa: ['ਹੋਮ', 'ਘਰ', 'ਮੁੱਖ ਪੰਨਾ', 'ਸੇਵਾਵਾਂ'],
        },
    },
    electricity_bill: {
        route: '/bill/electricity',
        action: 'navigate',
        labels: {
            en: ['electricity bill', 'pay electricity', 'electric bill', 'light bill', 'electricity payment'],
            hi: ['बिजली बिल', 'बिजली का बिल', 'बिजली भुगतान', 'लाइट बिल'],
            pa: ['ਬਿਜਲੀ ਬਿੱਲ', 'ਬਿਜਲੀ ਦਾ ਬਿੱਲ', 'ਬਿਜਲੀ ਭੁਗਤਾਨ'],
        },
    },
    water_bill: {
        route: '/bill/water',
        action: 'navigate',
        labels: {
            en: ['water bill', 'pay water', 'water payment'],
            hi: ['पानी बिल', 'पानी का बिल', 'जल बिल'],
            pa: ['ਪਾਣੀ ਬਿੱਲ', 'ਪਾਣੀ ਦਾ ਬਿੱਲ'],
        },
    },
    gas_bill: {
        route: '/bill/gas',
        action: 'navigate',
        labels: {
            en: ['gas bill', 'pay gas', 'gas payment', 'cooking gas'],
            hi: ['गैस बिल', 'गैस का बिल', 'रसोई गैस'],
            pa: ['ਗੈਸ ਬਿੱਲ', 'ਗੈਸ ਦਾ ਬਿੱਲ'],
        },
    },
    complaint: {
        route: '/complaint',
        action: 'navigate',
        labels: {
            en: ['file complaint', 'complaint', 'register complaint', 'report issue', 'report problem'],
            hi: ['शिकायत', 'शिकायत दर्ज करें', 'शिकायत करो', 'समस्या बताओ'],
            pa: ['ਸ਼ਿਕਾਇਤ', 'ਸ਼ਿਕਾਇਤ ਦਰਜ ਕਰੋ'],
        },
    },
    admin: {
        route: '/admin',
        action: 'navigate',
        labels: {
            en: ['admin', 'admin dashboard', 'administration'],
            hi: ['एडमिन', 'प्रशासक', 'डैशबोर्ड'],
            pa: ['ਐਡਮਿਨ', 'ਪ੍ਰਸ਼ਾਸਕ', 'ਡੈਸ਼ਬੋਰਡ'],
        },
    },
};

/** App-flow actions (non-route state changes) */
export const FLOW_ACTIONS = {
    quick_pay: {
        action: 'set_screen',
        value: 'guest',
        labels: {
            en: ['quick pay', 'guest mode', 'pay without login', 'guest'],
            hi: ['क्विक पे', 'बिना लॉगिन', 'गेस्ट'],
            pa: ['ਕੁਇੱਕ ਪੇ', 'ਬਿਨਾਂ ਲੌਗਇਨ', 'ਗੈਸਟ'],
        },
    },
    citizen_login: {
        action: 'set_screen',
        value: 'citizen-auth',
        labels: {
            en: ['citizen login', 'login', 'sign in', 'aadhaar login'],
            hi: ['नागरिक लॉगिन', 'लॉगिन', 'साइन इन', 'आधार लॉगिन'],
            pa: ['ਨਾਗਰਿਕ ਲੌਗਇਨ', 'ਲੌਗਇਨ', 'ਸਾਈਨ ਇਨ'],
        },
    },
    go_back: {
        action: 'go_back',
        labels: {
            en: ['go back', 'back', 'previous', 'return'],
            hi: ['वापस', 'पीछे', 'वापस जाओ'],
            pa: ['ਵਾਪਸ', 'ਪਿੱਛੇ'],
        },
    },
};

/**
 * Build a concise action description for the Gemini system prompt
 */
export function getNavigationPrompt() {
    const nav = Object.entries(NAVIGATION_MAP).map(([key, val]) => {
        return `- "${key}": navigates to ${val.route} (labels: ${val.labels.en.join(', ')})`;
    });
    const flow = Object.entries(FLOW_ACTIONS).map(([key, val]) => {
        return `- "${key}": ${val.action} → ${val.value || 'go back'} (labels: ${val.labels.en.join(', ')})`;
    });
    return [
        'Available navigation actions:',
        ...nav,
        '',
        'Available flow actions:',
        ...flow,
    ].join('\n');
}

/**
 * Language code → BCP 47 TTS code mapping
 */
export const LANG_TTS_MAP = {
    en: 'en-IN',
    hi: 'hi-IN',
    pa: 'pa-IN',
    bn: 'bn-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    ur: 'ur-IN',
};
