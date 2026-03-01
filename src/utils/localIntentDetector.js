/**
 * ═══════════════════════════════════════════════════════════
 * LAYER 1 — Local Intent Detector (0ms Response)
 *
 * Detects ultra-simple commands from Web Speech API interim results
 * WITHOUT any API calls. Instant navigation for:
 *   - Yes/No confirmations
 *   - Number pad input (1-9, 0)
 *   - Navigation commands (back, home, stop, cancel)
 *   - Simple greerings (hello, hi, namaste)
 *
 * Returns { text, action, params } or null if not a simple intent
 * ═══════════════════════════════════════════════════════════
 */

const SIMPLE_INTENTS = {
  // YES variations
  yes: {
    keywords: ['yes', 'haan', 'ha', 'ji', 'theek', 'thik', 'ok', 'okay',
               'bilkul', 'sahi', 'hnji', 'yup', 'yeah',
               'हाँ', 'हां', 'जी', 'ठीक', 'बिल्कुल', 'सही',
               'ਹਾਂ', 'ਜੀ', 'ਠੀਕ'],
    action: 'confirm_yes',
  },
  
  // NO variations
  no: {
    keywords: ['no', 'nahi', 'nai', 'mat', 'nahin', 'nope', 'nah',
               'नहीं', 'नही', 'ना',
               'ਨਹੀਂ', 'ਚਾਲੇ ਨਹੀਂ'],
    action: 'confirm_no',
  },

  // Number pad (0-9)
  '0': { keywords: ['zero', 'o', '0', 'सून्य', '०', 'ਸਿਫਰ'], action: 'numpad_0' },
  '1': { keywords: ['one', '1', 'ek', 'एक', 'ਇੱਕ'], action: 'numpad_1' },
  '2': { keywords: ['two', '2', 'do', 'दो', 'ਦੋ'], action: 'numpad_2' },
  '3': { keywords: ['three', '3', 'teen', 'तीन', 'ਤਿੰਨ'], action: 'numpad_3' },
  '4': { keywords: ['four', '4', 'char', 'चार', 'ਚਾਰ'], action: 'numpad_4' },
  '5': { keywords: ['five', '5', 'paanch', 'पाँच', 'ਪੰਜ'], action: 'numpad_5' },
  '6': { keywords: ['six', '6', 'chey', 'छः', 'ਛੇ'], action: 'numpad_6' },
  '7': { keywords: ['seven', '7', 'saat', 'सात', 'ਸੱਤ'], action: 'numpad_7' },
  '8': { keywords: ['eight', '8', 'aath', 'आठ', 'ਅਠ'], action: 'numpad_8' },
  '9': { keywords: ['nine', '9', 'nau', 'नौ', 'ਨੌ'], action: 'numpad_9' },

  // Navigation
  back: {
    keywords: ['back', 'peeche', 'wapas', 'previous',
               'पीछे', 'वापस', 'पहले',
               'ਪਿੱਛੇ', 'ਵਾਪਸ'],
    action: 'go_back',
  },
  
  home: {
    keywords: ['home', 'ghar', 'shuru', 'start', 'main', 'menu',
               'होम', 'शुरू', 'मुख्य',
               'ਹੋਮ', 'ਸ਼ੁਰੂ', 'ਮੁੱਖ'],
    action: 'go_home',
  },

  stop: {
    keywords: ['stop', 'band', 'ruko', 'bas', 'chup', 'silent', 'mute',
               'बंद', 'रुको', 'बस', 'चुप', 'शांत',
               'ਬੰਦ', 'ਰੁਕੋ', 'ਸੁਣੋ ਨਹੀਂ'],
    action: 'stop_voice',
  },

  cancel: {
    keywords: ['cancel', 'skip', 'chhod', 'mat karo', 'abort',
               'छोड़', 'मत करो', 'रद्द',
               'ਛੱਡ', 'ਮਤ ਕਰੋ'],
    action: 'cancel_action',
  },

  // Greetings (low priority, handled after KB usually)
  hello: {
    keywords: ['hello', 'hi', 'namaste', 'namaskar', 'sat sri akal', 'howdy',
               'नमस्ते', 'नमस्कार', 'आदाब',
               'ਸਤ', 'ਸ੍ਰੀ', 'ਅਲਾਕ'],
    action: 'acknowledge_greeting',
  },
};

/**
 * Detect if input text is a simple intent command
 * Returns { text: "Acknowledgment", action: "action_name", immediate: true }
 * or null if not a simple intent
 */
export function detectLocalIntent(transcript, lang = 'hi') {
  if (!transcript || transcript.trim().length < 1) return null;

  const lower = transcript.trim().toLowerCase();

  // Check each intent
  for (const [key, config] of Object.entries(SIMPLE_INTENTS)) {
    if (config.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      // Map action to response text
      const responseMap = {
        confirm_yes: {
          hi: 'ठीक है',
          en: 'Okay',
          pa: 'ਠੀਕ ਹੈ',
        },
        confirm_no: {
          hi: 'ठीक, नहीं करेंगे',
          en: 'Okay, not now',
          pa: 'ਠੀਕ, ਨਹੀਂ',
        },
        go_back: {
          hi: 'वापस जा रहा हूँ',
          en: 'Going back',
          pa: 'ਵਾਪਸ ਜਾ ਰਿਹਾ ਹਾਂ',
        },
        go_home: {
          hi: 'होम पर ले जा रहा हूँ',
          en: 'Going home',
          pa: 'ਹੋਮ ਵਿੱਚ ਲੈ ਕੇ ਜਾ ਰਿਹਾ ਹਾਂ',
        },
        stop_voice: {
          hi: 'ठीक, सुनना बंद करता हूँ',
          en: 'Stopping voice assistant',
          pa: 'ਸੁਣਨਾ ਬੰਦ ਕਰ ਰਿਹਾ ਹਾਂ',
        },
        cancel_action: {
          hi: 'रद्द कर दिया',
          en: 'Cancelled',
          pa: 'ਰੱਦ ਕਰ ਦਿੱਤਾ',
        },
        acknowledge_greeting: {
          hi: 'नमस्ते!',
          en: 'Hello!',
          pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ!',
        },
      };

      // Number pad should not speak — just execute
      if (config.action.startsWith('numpad_')) {
        return {
          text: '', // No spoken response for numpad
          action: config.action,
          immediate: true,
          params: { digit: key },
        };
      }

      return {
        text: responseMap[config.action]?.[lang] || responseMap[config.action]?.en || '',
        action: config.action,
        immediate: true,
        params: {},
      };
    }
  }

  return null; // Not a simple intent
}

/**
 * Check if input might be a number pad command (for early detection)
 * Useful for avoiding GB lookup on pure numbers
 */
export function isNumberPadCommand(transcript) {
  if (!transcript) return false;
  const lower = transcript.trim().toLowerCase();
  // Check if it's purely a digit or digit keywords
  return /^[0-9]$/.test(lower) ||
    ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'o',
     'ek', 'do', 'teen', 'char', 'paanch', 'chey', 'saat', 'aath', 'nau',
     'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छः', 'सात', 'आठ', 'नौ'].includes(lower);
}
