/**
 * ═══════════════════════════════════════════════════════════
 * Regional Language Database — India
 *
 * Maps states → their official/regional languages.
 * Uses reverse geocoding via Nominatim (free, no API key).
 * Voice auto-detect via Web Speech API language hints.
 * ═══════════════════════════════════════════════════════════
 */

/** All supported Indian languages */
export const ALL_LANGUAGES = [
    { code: 'en', name: 'English', native: 'English', script: 'Latin', speechCode: 'en-IN', flag: '🇬🇧' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी', script: 'Devanagari', speechCode: 'hi-IN', flag: '🇮🇳' },
    { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', script: 'Gurmukhi', speechCode: 'pa-IN', flag: '🏳️' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা', script: 'Bengali', speechCode: 'bn-IN', flag: '🏳️' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்', script: 'Tamil', speechCode: 'ta-IN', flag: '🏳️' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు', script: 'Telugu', speechCode: 'te-IN', flag: '🏳️' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', script: 'Kannada', speechCode: 'kn-IN', flag: '🏳️' },
    { code: 'ml', name: 'Malayalam', native: 'മലയാളം', script: 'Malayalam', speechCode: 'ml-IN', flag: '🏳️' },
    { code: 'mr', name: 'Marathi', native: 'मराठी', script: 'Devanagari', speechCode: 'mr-IN', flag: '🏳️' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', script: 'Gujarati', speechCode: 'gu-IN', flag: '🏳️' },
    { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', script: 'Odia', speechCode: 'or-IN', flag: '🏳️' },
    { code: 'as', name: 'Assamese', native: 'অসমীয়া', script: 'Bengali', speechCode: 'as-IN', flag: '🏳️' },
    { code: 'ur', name: 'Urdu', native: 'اردو', script: 'Nastaliq', speechCode: 'ur-IN', flag: '🏳️' },
    { code: 'ks', name: 'Kashmiri', native: 'कॉशुर', script: 'Devanagari', speechCode: 'ks-IN', flag: '🏳️' },
    { code: 'ne', name: 'Nepali', native: 'नेपाली', script: 'Devanagari', speechCode: 'ne-IN', flag: '🏳️' },
    { code: 'sd', name: 'Sindhi', native: 'سنڌي', script: 'Arabic', speechCode: 'sd-IN', flag: '🏳️' },
    { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', script: 'Devanagari', speechCode: 'sa-IN', flag: '🏳️' },
    { code: 'doi', name: 'Dogri', native: 'डोगरी', script: 'Devanagari', speechCode: 'doi-IN', flag: '🏳️' },
    { code: 'kok', name: 'Konkani', native: 'कोंकणी', script: 'Devanagari', speechCode: 'kok-IN', flag: '🏳️' },
    { code: 'mni', name: 'Manipuri', native: 'মৈতৈলোন্', script: 'Bengali', speechCode: 'mni-IN', flag: '🏳️' },
    { code: 'sat', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ', script: 'Ol Chiki', speechCode: 'sat-IN', flag: '🏳️' },
    { code: 'bo', name: 'Bodo', native: 'बड़ो', script: 'Devanagari', speechCode: 'bo-IN', flag: '🏳️' },
    { code: 'mai', name: 'Maithili', native: 'मैथिली', script: 'Devanagari', speechCode: 'mai-IN', flag: '🏳️' },
];

/**
 * State → language code mapping.
 * First code in the array is the default/primary regional language.
 * English and Hindi are always added on top.
 */
export const STATE_LANGUAGES = {
    // North India
    'Punjab': ['pa', 'hi'],
    'Haryana': ['hi', 'pa'],
    'Himachal Pradesh': ['hi', 'pa'],
    'Uttarakhand': ['hi', 'sa'],
    'Uttar Pradesh': ['hi', 'ur'],
    'Delhi': ['hi', 'pa', 'ur'],
    'Rajasthan': ['hi', 'ur'],
    'Madhya Pradesh': ['hi', 'ur'],
    'Chhattisgarh': ['hi'],
    'Bihar': ['hi', 'mai', 'ur'],
    'Jharkhand': ['hi', 'sat', 'ur', 'bn'],
    'Chandigarh': ['pa', 'hi'],

    // West India
    'Maharashtra': ['mr', 'hi', 'ur'],
    'Gujarat': ['gu', 'hi'],
    'Goa': ['kok', 'mr', 'hi'],
    'Dadra and Nagar Haveli and Daman and Diu': ['gu', 'hi', 'mr'],

    // South India
    'Karnataka': ['kn', 'te', 'ta', 'ur'],
    'Tamil Nadu': ['ta', 'te', 'kn'],
    'Kerala': ['ml', 'ta'],
    'Andhra Pradesh': ['te', 'ur', 'ta'],
    'Telangana': ['te', 'ur', 'hi'],
    'Puducherry': ['ta', 'te', 'ml'],
    'Lakshadweep': ['ml'],

    // East India
    'West Bengal': ['bn', 'hi', 'ur', 'ne'],
    'Odisha': ['or', 'hi'],
    'Sikkim': ['ne', 'bn', 'hi'],

    // Northeast India
    'Assam': ['as', 'bn', 'bo'],
    'Meghalaya': ['bn', 'hi'],
    'Arunachal Pradesh': ['hi', 'as'],
    'Manipur': ['mni', 'hi'],
    'Mizoram': ['hi'],
    'Nagaland': ['hi'],
    'Tripura': ['bn', 'kok'],

    // Union Territories
    'Jammu and Kashmir': ['ur', 'ks', 'doi', 'hi'],
    'Ladakh': ['hi', 'ur'],
    'Andaman and Nicobar Islands': ['hi', 'bn', 'ta', 'te'],
};

/** Get language object by code */
export function getLang(code) {
    return ALL_LANGUAGES.find(l => l.code === code) || ALL_LANGUAGES[0];
}

/**
 * Get recommended languages for a state/region.
 * Always includes English + Hindi + the regional languages.
 */
export function getLanguagesForState(stateName) {
    const regionCodes = STATE_LANGUAGES[stateName] || ['hi'];
    // Always ensure en and hi are present
    const allCodes = ['en', 'hi', ...regionCodes].filter((c, i, a) => a.indexOf(c) === i);
    return allCodes.map(getLang);
}

/**
 * Reverse-geocode coordinates to an Indian state name.
 * Uses free Nominatim API (no key needed).
 * Returns the state name or null.
 */
export async function getStateFromCoords(lat, lng) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=5&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        return data?.address?.state || null;
    } catch {
        return null;
    }
}

/**
 * Detect the user's state via browser geolocation + reverse geocode.
 * Returns { state, languages[], reason } where reason is:
 *   'success'     — got location + state
 *   'denied'      — user blocked permission
 *   'unavailable' — browser doesn't support geolocation
 *   'timeout'     — took too long
 *   'fallback'    — got coords but couldn't resolve state
 */
export function detectRegion() {
    return new Promise((resolve) => {
        const fallback = getLanguagesForState('Delhi');

        if (!navigator.geolocation) {
            resolve({ state: null, languages: fallback, reason: 'unavailable' });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const state = await getStateFromCoords(pos.coords.latitude, pos.coords.longitude);
                if (state && STATE_LANGUAGES[state]) {
                    resolve({ state, languages: getLanguagesForState(state), reason: 'success' });
                } else {
                    const match = Object.keys(STATE_LANGUAGES).find(
                        s => state && (s.toLowerCase().includes(state.toLowerCase()) || state.toLowerCase().includes(s.toLowerCase()))
                    );
                    resolve({
                        state: match || state || 'Unknown',
                        languages: getLanguagesForState(match || 'Delhi'),
                        reason: match ? 'success' : 'fallback',
                    });
                }
            },
            (err) => {
                // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
                const reason = err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable';
                resolve({ state: null, languages: fallback, reason });
            },
            { timeout: 5000, maximumAge: 300000 }
        );
    });
}

/**
 * Detect language from a spoken phrase.
 * Tries recognition in multiple languages and picks the one with highest confidence.
 * Simplified approach: just checks if speech API returns valid result for each lang.
 */
export function detectSpokenLanguage(audioCallback) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    // Common greetings/phrases per language for heuristic matching
    const LANGUAGE_HINTS = {
        hi: ['namaste', 'namaskar', 'kaise', 'kya', 'mujhe', 'chahiye', 'hai', 'haan', 'nahi', 'aap', 'main', 'bill', 'bijli', 'pani'],
        pa: ['sat sri akal', 'kiddan', 'ki', 'tussi', 'menu', 'chaida', 'haan ji', 'paani', 'bijli'],
        bn: ['namaskar', 'kemon', 'acho', 'ami', 'chai', 'jol', 'bidyut', 'korbo'],
        ta: ['vanakkam', 'naan', 'vendum', 'tanneer', 'bill', 'kattu'],
        te: ['namaskaram', 'nenu', 'kaavali', 'neellu', 'bill', 'kattu'],
        kn: ['namaskara', 'naanu', 'beku', 'neeru', 'bili'],
        ml: ['namaskaaram', 'njaan', 'venam', 'vellam', 'bill'],
        mr: ['namaskar', 'mala', 'pahije', 'paani', 'bill', 'vij'],
        gu: ['namaste', 'mane', 'joie', 'paani', 'bill', 'vij'],
    };

    return {
        LANGUAGE_HINTS,
        /**
         * Given a transcript, guess which language it might be.
         * Returns language code or null.
         */
        guessFromTranscript(transcript) {
            const lower = transcript.toLowerCase();
            let bestMatch = null;
            let bestScore = 0;

            for (const [langCode, hints] of Object.entries(LANGUAGE_HINTS)) {
                const score = hints.filter(h => lower.includes(h)).length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = langCode;
                }
            }

            return bestScore > 0 ? bestMatch : null;
        },
    };
}

/** Search languages by name, native name, or script */
export function searchLanguages(query) {
    if (!query || query.trim().length === 0) return ALL_LANGUAGES;
    const q = query.toLowerCase().trim();
    return ALL_LANGUAGES.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q) ||
        l.script.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
}
