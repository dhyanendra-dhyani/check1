/**
 * ═══════════════════════════════════════════════════════════
 * Speech Processor v2 — Anti-Fragmentation Pipeline
 *
 * Fixes:
 * 1. Deduplicates & normalizes input ("gas gas" → "gas")
 * 2. Queues fragmented voice input into complete sentences
 * 3. Debounces duplicate STT firings
 * 4. Quick lookup for common single-word commands
 * ═══════════════════════════════════════════════════════════
 */

/**
 * STEP 1: Clean Speech Input
 * Removes: duplicates, extra spaces, punctuation
 * "gas gas" → "gas"
 * "bijli bijli kaise" → "bijli kaise"
 */
export function cleanSpeechInput(text) {
    if (!text || typeof text !== 'string') return '';

    // Lowercase & trim
    let cleaned = text.toLowerCase().trim();

    // Remove special punctuation at edges
    cleaned = cleaned.replace(/^[?!.,:;'"]+|[?!.,:;'"]+$/g, '');

    // Split into words, deduplicate consecutive duplicates
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    const deduped = [];
    let lastWord = '';

    for (const word of words) {
        // Skip if same as previous word (exact duplicate removal)
        if (word !== lastWord) {
            deduped.push(word);
            lastWord = word;
        }
    }

    return deduped.join(' ').trim();
}

/**
 * STEP 1B: Remove Filler Words
 * Strips common words that don't affect intent
 * "mai bijli ka bil bharung" → "bijli ka bil"
 * "humko naam badalna hai" → "naam badalna"
 */
export function removeFillerWords(text) {
    if (!text) return text;

    const fillerWords = [
        // Hindi pronouns & generic actions
        'main', 'mujhe', 'humko', 'hume', 'ham', 'aap', 'mera', 'hamara',
        // Hindi generic verbs (remove GENERIC actions only, not specific intents like "bharna")
        'dena', 'dung', 'dogi', 'denge', 'karunga', 'karogi', 'karenge',
        'chahiye', 'chahiyye', 'chahta', 'chahti', 'chahte', 'chahta hu', 'chahta hoon',
        // English pronouns & generic actions
        'i', 'you', 'we', 'me', 'us', 'my', 'your', 'our',
        'want', 'need', 'please', 'kindly', 'just', 'like', 'can', 'would', 'could',
        // Common neutral filler
        // NOTE: 'ka' is NOT a filler — it's critical for "bijli ka bill", "pani ka bill" etc.
        'to', 'se', 'ek', 'do', 'raha', 'rahe', 'rahi', 'ho', 'hum',
        'aur', 'hai', 'hain', 'that', 'the', 'a', 'an',
    ];

    const words = text.toLowerCase().split(/\s+/);
    const filtered = words.filter(word => !fillerWords.includes(word));

    return filtered.join(' ').trim();
}

/**
 * STEP 2: Quick Lookup Map
 * Instant matching for common single-word commands
 * Bypasses KB & fuse.js entirely for speed
 */
export const QUICK_LOOKUP = {
    // Yes/No (multi-language)
    'yes': { action: 'confirm_yes', text: { hi: 'ठीक है', en: 'Okay', pa: 'ਠੀਕ ਹੈ' } },
    'haan': { action: 'confirm_yes', text: { hi: 'ठीक है', en: 'Okay', pa: 'ਠੀਕ ਹੈ' } },
    'ha': { action: 'confirm_yes', text: { hi: 'ठीक है', en: 'Okay', pa: 'ਠੀਕ ਹੈ' } },
    'ji': { action: 'confirm_yes', text: { hi: 'ठीक है', en: 'Okay', pa: 'ਠੀਕ ਹੈ' } },
    'theek': { action: 'confirm_yes', text: { hi: 'ठीक है', en: 'Okay', pa: 'ਠੀਕ ਹੈ' } },
    'ok': { action: 'confirm_yes', text: { hi: 'ठीक है', en: 'Okay', pa: 'ਠੀਕ ਹੈ' } },
    'okay': { action: 'confirm_yes', text: { hi: 'ठीक है', en: 'Okay', pa: 'ਠੀਕ ਹੈ' } },
    'bilkul': { action: 'confirm_yes', text: { hi: 'ठीक है', en: 'Okay', pa: 'ਠੀਕ ਹੈ' } },

    'no': { action: 'confirm_no', text: { hi: 'ठीक, नहीं करेंगे', en: 'Okay, not now', pa: 'ਠੀਕ, ਨਹੀਂ' } },
    'nahi': { action: 'confirm_no', text: { hi: 'ठीक, नहीं करेंगे', en: 'Okay, not now', pa: 'ਠੀਕ, ਨਹੀਂ' } },
    'nah': { action: 'confirm_no', text: { hi: 'ठीक, नहीं करेंगे', en: 'Okay, not now', pa: 'ਠੀਕ, ਨਹੀਂ' } },
    'nai': { action: 'confirm_no', text: { hi: 'ठीक, नहीं करेंगे', en: 'Okay, not now', pa: 'ਠੀਕ, ਨਹੀਂ' } },

    // Service names — bill payments (with guidance)
    'bijli': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल का पेज खोल रहा हूँ। यहाँ आपको अपना खाता संख्या डालनी होगी — यह आपके पुराने बिजली बिल पर ऊपर बाईं तरफ लिखी होती है, जैसे PSEB-123456। नीचे नंबर पैड से डालें या QR कोड स्कैन करें।', en: 'Opening electricity bill page. Enter your consumer number — you\'ll find it on your previous bill, like PSEB-123456. Use the keypad or scan QR.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ। ਆਪਣਾ ਖਾਤਾ ਨੰਬਰ ਪਾਓ।' } },
    'bijlee': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल का पेज खोल रहा हूँ। अपना खाता संख्या डालें — जैसे PSEB-123456। यह आपके पुराने बिल पर लिखी होती है।', en: 'Opening electricity bill. Enter your consumer number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'light': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल का पेज खोल रहा हूँ। अपना खाता संख्या डालें — जैसे PSEB-123456।', en: 'Opening electricity bill. Enter your consumer number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'electricity': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल का पेज खोल रहा हूँ। अपना खाता संख्या डालें — जैसे PSEB-123456।', en: 'Opening electricity bill. Enter your consumer number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },

    'pani': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल का पेज खोल रहा हूँ। अपना खाता संख्या डालें — जैसे PHED-789012। यह आपके पानी के बिल पर ऊपर लिखी होती है।', en: 'Opening water bill. Enter your consumer number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'paani': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल का पेज खोल रहा हूँ। अपना खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter your consumer number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'water': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल का पेज खोल रहा हूँ। अपना खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter your consumer number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },

    'gas': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल का पेज खोल रहा हूँ। अपना LPG ID या खाता संख्या डालें — जैसे GPL-345678। यह आपकी गैस बुक या सिलेंडर रसीद पर लिखी होती है।', en: 'Opening gas bill. Enter your LPG ID like GPL-345678 from your gas book or cylinder receipt.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },

    'back': { action: 'go_back', text: { hi: 'वापस जा रहा हूँ', en: 'Going back', pa: 'ਵਾਪਸ ਜਾ ਰਿਹਾ ਹਾਂ' } },
    'wapas': { action: 'go_back', text: { hi: 'वापस जा रहा हूँ', en: 'Going back', pa: 'ਵਾਪਸ ਜਾ ਰਿਹਾ ਹਾਂ' } },
    'peeche': { action: 'go_back', text: { hi: 'वापस जा रहा हूँ', en: 'Going back', pa: 'ਵਾਪਸ ਜਾ ਰਿਹਾ ਹਾਂ' } },

    'home': { action: 'go_home', text: { hi: 'होम पर ले जा रहा हूँ', en: 'Going home', pa: 'ਹੋਮ ਤੇ ਲੈ ਕੇ ਜਾ ਰਿਹਾ ਹਾਂ' } },
    'ghar': { action: 'go_home', text: { hi: 'होम पर ले जा रहा हूँ', en: 'Going home', pa: 'ਹੋਮ ਤੇ ਲੈ ਕੇ ਜਾ ਰਿਹਾ ਹਾਂ' } },
    'shuru': { action: 'go_home', text: { hi: 'होम पर ले जा रहा हूँ', en: 'Going home', pa: 'ਹੋਮ ਤੇ ਲੈ ਕੇ ਜਾ ਰਿਹਾ ਹਾਂ' } },

    'stop': { action: 'stop_voice', text: { hi: 'ठीक, सुनना बंद करता हूँ', en: 'Stopping', pa: 'ਬੰਦ ਕਰ ਰਿਹਾ ਹਾਂ' } },
    'band': { action: 'stop_voice', text: { hi: 'ठीक, सुनना बंद करता हूँ', en: 'Stopping', pa: 'ਬੰਦ ਕਰ ਰਿਹਾ ਹਾਂ' } },
    'ruko': { action: 'stop_voice', text: { hi: 'ठीक, सुनना बंद करता हूँ', en: 'Stopping', pa: 'ਬੰਦ ਕਰ ਰਿਹਾ ਹਾਂ' } },

    'complaint': { action: 'navigate_complaint', text: { hi: '', en: '', pa: '' } },
    'shikayat': { action: 'navigate_complaint', text: { hi: '', en: '', pa: '' } },

    // Citizen-required features — SILENT REDIRECT (no confirmation)
    'naam': { action: 'navigate_naam_change', text: { hi: '', en: '', pa: '' } },
    'naam badal': { action: 'navigate_naam_change', text: { hi: '', en: '', pa: '' } },
    'naam badalna': { action: 'navigate_naam_change', text: { hi: '', en: '', pa: '' } },
    'naam badalna hai': { action: 'navigate_naam_change', text: { hi: '', en: '', pa: '' } },
    'name change': { action: 'navigate_naam_change', text: { hi: '', en: '', pa: '' } },
    'naya naam': { action: 'navigate_naam_change', text: { hi: '', en: '', pa: '' } },

    // New connection
    'naya connection': { action: 'navigate_new_connection', text: { hi: '', en: '', pa: '' } },
    'new connection': { action: 'navigate_new_connection', text: { hi: '', en: '', pa: '' } },
    'connection': { action: 'navigate_new_connection', text: { hi: '', en: '', pa: '' } },

    // Multi-word bill phrases — Direct redirect WITH DETAILED GUIDANCE
    // Electricity - all variations with detailed Hindi guidance about khata sankhya
    'bijli bil': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। यहाँ आपको अपनी खाता संख्या डालनी होगी जो आपके पास होगी — जैसे PSEB-123456। यह आपके पुराने बिजली बिल पर ऊपर बाईं तरफ लिखी होती है। नीचे नंबर पैड से डालें।', en: 'Opening electricity bill. Enter your account number like PSEB-123456 from your previous bill.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ। ਆਪਣਾ ਖਾਤਾ ਨੰਬਰ ਪਾਓ।' } },
    'bijli bill': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। यहाँ आपको अपनी खाता संख्या डालनी होगी जो आपके पास होगी — जैसे PSEB-123456। यह आपके पुराने बिजली बिल पर ऊपर बाईं तरफ लिखी होती है। नीचे नंबर पैड से डालें।', en: 'Opening electricity bill. Enter your account number like PSEB-123456 from your previous bill.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ। ਆਪਣਾ ਖਾਤਾ ਨੰਬਰ ਪਾਓ।' } },
    'bijli ka bil': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें जो आपके पास होगी — आपके पुराने बिजली बिल पर ऊपर लिखी होती है, जैसे PSEB-123456। नीचे नंबर पैड से डालें या QR कोड स्कैन करें।', en: 'Opening electricity bill. Enter your account number like PSEB-123456 from your previous bill. Use keypad or scan QR.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ। ਆਪਣਾ ਖਾਤਾ ਨੰਬਰ ਪਾਓ।' } },
    'bijli ka bill': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें जो आपके पास होगी — आपके पुराने बिजली बिल पर ऊपर लिखी होती है, जैसे PSEB-123456। नीचे नंबर पैड से डालें या QR कोड स्कैन करें।', en: 'Opening electricity bill. Enter your account number like PSEB-123456 from your previous bill. Use keypad or scan QR.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ। ਆਪਣਾ ਖਾਤਾ ਨੰਬਰ ਪਾਓ।' } },
    'bijli bil bharo': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें जो आपको यहाँ से मिली होगी — जैसे PSEB-123456। नंबर पैड से डालें।', en: 'Opening electricity bill. Enter your account number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'bijli bill bharo': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें जो आपको यहाँ से मिली होगी — जैसे PSEB-123456। नंबर पैड से डालें।', en: 'Opening electricity bill. Enter your account number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'electricity bill': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल का पेज खोल रहा हूँ। अपनी खाता संख्या डालें — जैसे PSEB-123456।', en: 'Opening electricity bill. Enter your consumer number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },

    // Water - all variations with detailed guidance
    'pani bil': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें जो आपके पानी के बिल पर ऊपर लिखी होती है — जैसे PHED-789012। नंबर पैड से डालें।', en: 'Opening water bill. Enter your account number like PHED-789012 from your water bill.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani bill': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें जो आपके पानी के बिल पर ऊपर लिखी होती है — जैसे PHED-789012। नंबर पैड से डालें।', en: 'Opening water bill. Enter your account number like PHED-789012 from your water bill.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani ka bil': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें — जैसे PHED-789012। यह आपके पानी के बिल पर ऊपर लिखी होती है।', en: 'Opening water bill. Enter your account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani ka bill': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें — जैसे PHED-789012। यह आपके पानी के बिल पर ऊपर लिखी होती है।', en: 'Opening water bill. Enter your account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani bil bharo': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani bill bharo': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'water bill': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल का पेज खोल रहा हूँ। अपनी खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter your consumer number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },

    // Gas - all variations with detailed guidance
    'gas bil': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। इसमें LPG ID या खाता संख्या डालें — जैसे GPL-345678। यह आपकी गैस बुक या सिलेंडर रसीद पर लिखी होती है।', en: 'Opening gas bill. Enter your LPG ID like GPL-345678 from gas book or cylinder receipt.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas bill': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। इसमें LPG ID या खाता संख्या डालें — जैसे GPL-345678। यह आपकी गैस बुक या सिलेंडर रसीद पर लिखी होती है।', en: 'Opening gas bill. Enter your LPG ID like GPL-345678 from gas book or cylinder receipt.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas ka bil': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। इसमें LPG ID डालें — जैसे GPL-345678। यह आपकी गैस बुक पर लिखी होती है।', en: 'Opening gas bill. Enter LPG ID like GPL-345678 from your gas book.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas ka bill': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। इसमें LPG ID डालें — जैसे GPL-345678। यह आपकी गैस बुक पर लिखी होती है।', en: 'Opening gas bill. Enter LPG ID like GPL-345678 from your gas book.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas bil bharo': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678।', en: 'Opening gas bill. Enter LPG ID like GPL-345678.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas bill bharo': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678।', en: 'Opening gas bill. Enter LPG ID like GPL-345678.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'cooking gas': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678।', en: 'Opening gas bill. Enter LPG ID like GPL-345678.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },

    // Common longer phrase variations — "bharna hai" (payment intent)
    'bijli bill bharna hai': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें जो आपको यहाँ से मिली होगी आपके पास होगी — जैसे PSEB-123456। नीचे नंबर पैड से डालें या QR कोड स्कैन करें।', en: 'Opening electricity bill. Enter your account number like PSEB-123456. Use keypad or scan QR.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'bijli bill bharna': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें जो आपको यहाँ से मिली होगी आपके पास होगी — जैसे PSEB-123456। नीचे नंबर पैड से डालें।', en: 'Opening electricity bill. Enter account number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'bijli ka bill bharna hai': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें जो आपको यहाँ से मिली होगी आपके पास होगी — जैसे PSEB-123456। नीचे नंबर पैड से डालें या QR कोड स्कैन करें।', en: 'Opening electricity bill. Enter your account number like PSEB-123456. Use keypad or scan QR.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'bijli ka bill bharna': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें — जैसे PSEB-123456। नंबर पैड से डालें।', en: 'Opening electricity bill. Enter account number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'bijli ka bil bharna hai': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें जो आपको यहाँ से मिली होगी — जैसे PSEB-123456। नंबर पैड से डालें।', en: 'Opening electricity bill. Enter account number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'bijli ka bil bharna': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PSEB-123456।', en: 'Opening electricity bill. Enter account number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani bill bharna hai': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। इसमें खाता संख्या डालें — जैसे PHED-789012। यह आपके पानी के बिल पर ऊपर लिखी होती है।', en: 'Opening water bill. Enter account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani bill bharna': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani ka bill bharna hai': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani ka bill bharna': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani ka bil bharna hai': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani ka bil bharna': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas bill bharna hai': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678। यह आपकी गैस बुक पर लिखी होती है।', en: 'Opening gas bill. Enter LPG ID like GPL-345678 from gas book.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas bill bharna': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678।', en: 'Opening gas bill. Enter LPG ID like GPL-345678.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas ka bill bharna hai': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678।', en: 'Opening gas bill. Enter LPG ID like GPL-345678.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas ka bill bharna': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678।', en: 'Opening gas bill. Enter LPG ID like GPL-345678.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas ka bil bharna hai': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678।', en: 'Opening gas bill. Enter LPG ID like GPL-345678.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas ka bil bharna': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678।', en: 'Opening gas bill. Enter LPG ID like GPL-345678.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },

    // Also add with "bil" (single L) variations for bharna
    'bijli bil bharna hai': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PSEB-123456।', en: 'Opening electricity bill. Enter account number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'bijli bil bharna': { action: 'navigate_bill_electricity', text: { hi: 'ठीक है, बिजली बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PSEB-123456।', en: 'Opening electricity bill. Enter account number like PSEB-123456.', pa: 'ਬਿਜਲੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani bil bharna hai': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'pani bil bharna': { action: 'navigate_bill_water', text: { hi: 'ठीक है, पानी बिल भरने का पेज खोल रहा हूँ। खाता संख्या डालें — जैसे PHED-789012।', en: 'Opening water bill. Enter account number like PHED-789012.', pa: 'ਪਾਣੀ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas bil bharna hai': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678।', en: 'Opening gas bill. Enter LPG ID like GPL-345678.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },
    'gas bil bharna': { action: 'navigate_bill_gas', text: { hi: 'ठीक है, गैस बिल भरने का पेज खोल रहा हूँ। LPG ID डालें — जैसे GPL-345678।', en: 'Opening gas bill. Enter LPG ID like GPL-345678.', pa: 'ਗੈਸ ਬਿੱਲ ਖੋਲ ਰਿਹਾ ਹਾਂ।' } },

    // Property tax
    'property': { action: 'navigate_property_tax', text: { hi: '', en: '', pa: '' } },
    'property tax': { action: 'navigate_property_tax', text: { hi: '', en: '', pa: '' } },
    'ghar ka tax': { action: 'navigate_property_tax', text: { hi: '', en: '', pa: '' } },

    // Admin
    'admin': { action: 'navigate_admin', text: { hi: '', en: '', pa: '' } },
    'admin panel': { action: 'navigate_admin', text: { hi: '', en: '', pa: '' } },
};

/**
 * STEP 3: Quick Lookup Search
 * 1. Tries prefix matching (first N words)
 * 2. If no prefix match, searches for key phrases ANYWHERE in input
 * 3. Prioritizes longest matches (e.g., "bijli bill" over "bijli")
 * Returns { action, text[lang], immediate: true } or null
 */
export function quickLookupSearch(cleanedInput, lang = 'hi') {
    if (!cleanedInput) return null;

    const words = cleanedInput.split(/\s+/);

    // STEP 1: Try prefix matching first (current words 0, 1, 2...)
    for (let len = Math.min(3, words.length); len >= 1; len--) {
        const phrase = words.slice(0, len).join(' ');
        const match = QUICK_LOOKUP[phrase];
        if (match) {
            console.log(`[QUICK-PREFIX] Matched "${phrase}" (${len} words)`);
            return {
                action: match.action,
                text: match.text[lang] || match.text.en || '',
                immediate: true,
                params: {},
            };
        }
    }

    // STEP 2: Try substring matching (find ANY key anywhere in the input)
    // Sort by longest key first to find most specific matches
    const sortedKeys = Object.keys(QUICK_LOOKUP)
        .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);

    for (const key of sortedKeys) {
        const keyWords = key.split(/\s+/);
        // Check if key words appear consecutively in input
        for (let i = 0; i <= words.length - keyWords.length; i++) {
            const inputPhrase = words.slice(i, i + keyWords.length).join(' ');
            if (inputPhrase === key) {
                const match = QUICK_LOOKUP[key];
                console.log(`[QUICK-SUBSTRING] Matched "${key}" in "${cleanedInput}"`);
                return {
                    action: match.action,
                    text: match.text[lang] || match.text.en || '',
                    immediate: true,
                    params: {},
                };
            }
        }
    }

    return null;
}

/**
 * STEP 4: Sentence Queue Manager
 * Accumulates fragments and detects sentence boundaries
 * 
 * Detects end-of-sentence when:
 * - User pauses > 1.5 seconds
 * - Input ends with Hindi/English sentence markers (।, ?, !, ।।)
 */
export class SentenceQueue {
    constructor() {
        this.fragments = [];
        this.lastFragmentTime = 0;
        this.pauseThreshold = 1500; // 1.5 seconds
    }

    /**
     * Add a fragment. Returns complete sentence if one is ready, null otherwise
     */
    addFragment(text) {
        if (!text || text.trim().length === 0) return null;

        const now = Date.now();
        const timeSinceLastFragment = now - this.lastFragmentTime;

        // If pause was long, finalize previous fragments
        if (this.fragments.length > 0 && timeSinceLastFragment > this.pauseThreshold) {
            const completeSentence = this.fragments.join(' ').trim();
            this.fragments = [text];
            this.lastFragmentTime = now;
            return completeSentence; // Return PREVIOUS sentence
        }

        // Add new fragment
        this.fragments.push(text);
        this.lastFragmentTime = now;

        // Check if this fragment ends sentence
        const sentenceEnders = ['।', '?', '!', '।।', '।']; // Hindi & English
        if (sentenceEnders.some(marker => text.endsWith(marker))) {
            const completeSentence = this.fragments.join(' ').trim();
            this.fragments = [];
            return completeSentence;
        }

        return null; // Still accumulating
    }

    /**
     * Finalize on timeout (user stopped speaking)
     */
    finalize() {
        if (this.fragments.length === 0) return null;
        const sentence = this.fragments.join(' ').trim();
        this.fragments = [];
        return sentence;
    }

    /**
     * Clear queue
     */
    reset() {
        this.fragments = [];
        this.lastFragmentTime = 0;
    }
}

/**
 * STEP 5: Debouncer for STT duplicates
 * Prevents "gas gas" from being processed twice
 */
export class TranscriptDebouncer {
    constructor(debounceMs = 300) {
        this.lastInput = '';
        this.lastProcessedTime = 0;
        this.debounceMs = debounceMs;
    }

    /**
     * Check if input should be processed
     * Returns true if different from last or timeout passed
     */
    shouldProcess(input) {
        const now = Date.now();
        const isDifferent = input !== this.lastInput;
        const isTimeoutPassed = (now - this.lastProcessedTime) > this.debounceMs;

        if (isDifferent || isTimeoutPassed) {
            this.lastInput = input;
            this.lastProcessedTime = now;
            return true;
        }

        return false; // Skip duplicate
    }

    reset() {
        this.lastInput = '';
        this.lastProcessedTime = 0;
    }
}

/**
 * STEP 6: Complete Pipeline
 * Combines all steps: Clean → Quick → Debounce → Queue
 */
export function processSpeechInput(rawInput, debouncer, sentenceQueue, lang = 'hi') {
    // 1. Clean & deduplicate
    const cleaned = cleanSpeechInput(rawInput);
    if (!cleaned) return null;

    // 2. Debounce (prevent "gas gas" from firing twice)
    if (!debouncer.shouldProcess(cleaned)) {
        return { skipped: true };
    }

    // 3. Quick lookup (instant single-word match)
    const quickMatch = quickLookupSearch(cleaned, lang);
    if (quickMatch) {
        // Clear the sentence queue since we got a direct match
        sentenceQueue.reset();
        return {
            ...quickMatch,
            layer: 'QUICK',
            cleaned,
        };
    }

    // 4. Add to sentence queue (accumulate fragments)
    const completeSentence = sentenceQueue.addFragment(cleaned);

    if (completeSentence) {
        // Sentence is ready — try quick lookup on the COMPLETE sentence first
        const completeQuickMatch = quickLookupSearch(completeSentence, lang);
        if (completeQuickMatch) {
            return {
                ...completeQuickMatch,
                layer: 'QUICK',
                cleaned: completeSentence,
            };
        }
        // No quick match — send to KB/Gemini
        return {
            text: completeSentence,
            layer: 'QUEUE',
            cleaned,
            isComplete: true,
        };
    }

    // SMOOTHNESS FIX: Check if the combined buffer so far matches any QUICK_LOOKUP
    // This prevents needing a second speech input when fragments accumulate
    const bufferText = sentenceQueue.fragments.join(' ').trim();
    if (bufferText) {
        const bufferQuickMatch = quickLookupSearch(bufferText, lang);
        if (bufferQuickMatch) {
            console.log(`[QUICK-BUFFER] Matched "${bufferText}" from accumulated buffer`);
            sentenceQueue.reset(); // Clear since we're processing now
            return {
                ...bufferQuickMatch,
                layer: 'QUICK',
                cleaned: bufferText,
            };
        }
    }

    // Still accumulating fragments
    return {
        text: cleaned,
        layer: 'QUEUE',
        cleaned,
        isComplete: false,
        message: 'Accumulating fragments...',
    };
}
