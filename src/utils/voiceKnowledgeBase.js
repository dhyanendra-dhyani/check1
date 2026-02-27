/**
 * ═══════════════════════════════════════════════════════════
 * Voice Knowledge Base v2 — Comprehensive
 *
 * Deep knowledge of every page, every feature, every field.
 * Handles 100+ questions instantly without API calls.
 *
 * PAGES COVERED:
 *   - IdleScreen: Language selection + voice/touch
 *   - GatewayScreen: Guest vs Citizen choice
 *   - HomeScreen: 4 services (electricity, water, gas, property tax)
 *   - BillPayment: 3 steps (input → bill → pay → success)
 *     - Numpad, QR scan, consumer ID
 *     - Payment methods: UPI, Card, Cash (note counting)
 *     - Receipt download + PDF
 *   - ComplaintForm: 3 steps (category → details → done)
 *     - 6 categories with keywords
 *     - Photo upload, location detect, voice description
 *     - Complaint receipt PDF
 *   - AuthScreen: 3 methods (thumb, iris, OTP)
 *     - Mock citizen: Vivek Kumar, Aadhaar XXXX-XXXX-4829
 *   - CitizenDashboard: Bills, complaints, services
 *
 * MOCK DATA:
 *   - PSEB-123456 → Electricity ₹450 (Rajesh Kumar)
 *   - PHED-789012 → Water ₹280 (Paramjit Singh)
 *   - GPL-345678  → Gas ₹620 (Sunita Devi)
 * ═══════════════════════════════════════════════════════════
 */

// ── CONVERSATION STATES ─────────────────────────────
export const CONV_STATES = {
    INITIAL: 'initial',
    WAIT_PATH: 'wait_path',
    GUEST_HOME: 'guest_home',
    CITIZEN_AUTH: 'citizen_auth',
    CITIZEN_DASH: 'citizen_dash',
    BILL_INPUT: 'bill_input',
    BILL_VIEW: 'bill_view',
    BILL_PAY: 'bill_pay',
    BILL_SUCCESS: 'bill_success',
    COMPLAINT_CAT: 'complaint_cat',
    COMPLAINT_DETAIL: 'complaint_detail',
    COMPLAINT_DONE: 'complaint_done',
    FREE_TALK: 'free_talk',
};

// ── INITIAL GREETING ────────────────────────────────
export const INITIAL_GREETINGS = {
    hi: 'ठीक है! बताइए, क्या यह आपका अपना बिल है? अगर आधार कार्ड है तो अंगूठा लगाकर लॉगिन कर सकते हैं। या फिर किसी रिश्तेदार का बिल जमा करना है तो बिना लॉगिन भी हो जाएगा।',
    en: 'Great! Tell me — is this your own bill? If you have Aadhaar, you can login with thumbprint. Or if you\'re paying someone else\'s bill, you can do it without login too.',
};

// ── ALL KEYWORD SETS ────────────────────────────────

export const CITIZEN_KEYWORDS = [
    'apna', 'mera', 'aadhaar', 'aadhar', 'angootha', 'finger', 'thumb',
    'my own', 'meri', 'khud', 'haan ji', 'login', 'citizen', 'panjikaran',
    'register', 'अपना', 'मेरा', 'आधार', 'अंगूठा', 'खुद', 'हाँ जी',
    'पंजीकरण', 'लॉगिन', 'own', 'apne', 'apni', 'mujhe', 'mera hai',
];

export const GUEST_KEYWORDS = [
    'rishtedar', 'kisi aur', 'kisi ka', 'dusre', 'nahi', 'no', 'nah',
    'guest', 'bina login', 'bina', 'someone', 'else', 'other', 'quick',
    'jaldi', 'seedha', 'direct', 'quick pay', 'without', 'baghair',
    'रिश्तेदार', 'किसी और', 'किसी का', 'दूसरे', 'नहीं', 'बिना',
    'दूसरों', 'पड़ोसी', 'neighbour', 'padosi',
];

export const BILL_KEYWORDS = {
    electricity: [
        'bijli', 'electricity', 'electric', 'light', 'lite', 'bijlee',
        'बिजली', 'लाइट', 'बिजली का बिल', 'vij', 'PSEB', 'pseb',
        'powercom', 'meter', 'unit', 'kwh', 'current',
    ],
    water: [
        'paani', 'water', 'jal', 'pani', 'पानी', 'जल', 'पानी का बिल',
        'PHED', 'phed', 'neer', 'supply', 'tap', 'nal', 'नल',
    ],
    gas: [
        'gas', 'lpg', 'cylinder', 'rasoi', 'गैस', 'रसोई', 'सिलेंडर',
        'GPL', 'gpl', 'hp gas', 'indane', 'bharat gas', 'cooking',
    ],
};

export const COMPLAINT_KEYWORDS = [
    'complaint', 'shikayat', 'problem', 'samasya', 'issue', 'report',
    'शिकायत', 'समस्या', 'dikkat', 'taklif', 'kharab', 'tut', 'broken',
    'repair', 'fix', 'help', 'दिक्कत', 'तकलीफ', 'खराब', 'टूटा',
];

export const COMPLAINT_CATEGORY_KEYWORDS = {
    broken_streetlight: ['streetlight', 'light', 'dark', 'lamp', 'pole', 'roshni', 'andhera', 'रोशनी', 'अंधेरा', 'बत्ती'],
    water_supply: ['water', 'supply', 'pipe', 'leak', 'tap', 'pani', 'paani', 'jal', 'nal', 'पानी', 'नल', 'टपक'],
    garbage_collection: ['garbage', 'waste', 'trash', 'dump', 'kachra', 'safai', 'clean', 'गंदगी', 'कचरा', 'सफाई'],
    voltage_fluctuation: ['voltage', 'fluctuation', 'power', 'current', 'bijli', 'volt', 'बिजली', 'करंट', 'वोल्टेज'],
    road_damage: ['road', 'pothole', 'damage', 'crack', 'broken', 'sadak', 'gaddha', 'सड़क', 'गड्ढा', 'टूटी'],
};

export const BACK_KEYWORDS = ['back', 'peeche', 'wapas', 'vapas', 'पीछे', 'वापस', 'return', 'laut'];
export const HOME_KEYWORDS = ['home', 'ghar', 'shuru', 'होम', 'घर', 'start', 'menu', 'services'];
export const STOP_KEYWORDS = ['stop', 'band', 'ruko', 'chup', 'bye', 'बंद', 'रुको', 'touch mode', 'hatao', 'close'];

// ── Payment method keywords ────────────────────────
export const PAYMENT_KEYWORDS = {
    upi: ['upi', 'gpay', 'google pay', 'phonepe', 'paytm', 'bhim', 'यूपीआई'],
    card: ['card', 'debit', 'credit', 'atm', 'कार्ड', 'डेबिट'],
    cash: ['cash', 'naqad', 'paisa', 'note', 'कैश', 'नकद', 'पैसे'],
};

// ── Yes/No keywords ────────────────────────────────
export const YES_KEYWORDS = ['haan', 'ha', 'yes', 'ji', 'theek', 'thik', 'sahi', 'bilkul', 'ok', 'okay', 'chalega', 'हाँ', 'जी', 'ठीक', 'सही', 'चलेगा'];
export const NO_KEYWORDS = ['nahi', 'nah', 'no', 'mat', 'cancel', 'band', 'naa', 'not', 'नहीं', 'मत', 'ना'];

// ── CITIZEN-REQUIRED features (need Aadhaar login) ─
// These are services that ONLY work after citizen login
export const CITIZEN_REQUIRED_KEYWORDS = [
    'naam badal', 'naam badlo', 'name change', 'naam transfer', 'नाम बदल', 'नाम ट्रांसफर',
    'new connection', 'naya connection', 'नया कनेक्शन',
    'gas pipeline', 'pipeline', 'gas line', 'पाइपलाइन', 'गैस लाइन',
    'certificate', 'pramanpatra', 'प्रमाणपत्र', 'सर्टिफिकेट',
    'transfer', 'ownership', 'malik', 'मालिक',
    'meter change', 'meter badal', 'मीटर बदल',
    'subsidy', 'subsidi', 'सब्सिडी',
    'dashboard', 'history', 'record', 'itihas', 'इतिहास', 'रिकॉर्ड',
];

// ── RE-PROMPT: When user doesn't respond ───────────
export const RE_PROMPT_GREETINGS = [
    {
        hi: 'कोई बात नहीं, दोबारा बताइए — आपका अपना बिल है और आधार कार्ड है? या किसी और का बिल भरना है?',
        en: 'No worries, let me ask again — is this your own bill with Aadhaar? Or paying for someone else?',
    },
    {
        hi: 'अगर आपके पास आधार कार्ड है तो "अपना" बोलें। अगर किसी रिश्तेदार का बिल भरना है तो "रिश्तेदार का" बोलें। या सीधे बोलें "बिजली बिल" जो भरना हो।',
        en: 'If you have Aadhaar, say "my own". If paying for a relative, say "someone else". Or directly say which bill — "electricity bill".',
    },
    {
        hi: 'मैं सुन रहा हूँ! बस बोलिए — "अपना बिल है" या "किसी और का बिल भरना है"। आप सीधे "बिजली", "पानी", या "गैस" भी बोल सकते हैं।',
        en: 'I\'m listening! Just say "my own bill" or "someone else\'s". You can also say "electricity", "water", or "gas" directly.',
    },
];

// ── RESPONSE TEMPLATES ──────────────────────────────

export const RESPONSES = {
    citizen_chosen: {
        hi: 'बहुत अच्छा! चलिए पंजीकरण करते हैं। आपके सामने तीन तरीके हैं — अंगूठा लगाइए, आँख स्कैन कराइए, या OTP से लॉगिन करें। सबसे आसान अंगूठा है — बस लगाइए और हो जाएगा।',
        en: 'Great! Let\'s register. Three options — thumbprint, iris scan, or OTP login. Thumbprint is easiest — just place your finger.',
    },
    guest_chosen: {
        hi: 'ठीक है, बिना लॉगिन के भी सारे काम हो जाएँगे! बताइए कौन सा बिल भरना है — बिजली का, पानी का, या गैस का? अगर कोई शिकायत दर्ज करनी है तो वो भी हो जाएगी। Property Tax भी भर सकते हैं।',
        en: 'No problem! You can do everything without login. Which bill — electricity, water, or gas? You can also file a complaint or pay property tax.',
    },
    stopping: {
        hi: 'ठीक है, बंद कर रहा हूँ। फिर से बात करनी हो तो माइक बटन दबाएं। धन्यवाद!',
        en: 'Okay, stopping. Press the mic button to talk again. Thank you!',
    },
    not_understood: {
        hi: 'माफ कीजिए, मैं समझ नहीं पाया। आप बोल सकते हैं — "बिजली का बिल", "पानी का बिल", "गैस का बिल", "शिकायत", या "वापस"।',
        en: 'Sorry, I didn\'t understand. You can say — "electricity bill", "water bill", "gas bill", "complaint", or "go back".',
    },

    // ── Citizen-required feature redirect ──────────
    citizen_required_redirect: {
        hi: 'अच्छा, इसके लिए आपको आधार कार्ड से लॉगिन करना होगा। अगर आपके पास आधार कार्ड है तो अंगूठा लगाकर या OTP से लॉगिन कर सकते हैं। मैं आपको लॉगिन पेज पर ले जा रहा हूँ।',
        en: 'For this, you\'ll need to login with your Aadhaar card. You can use thumbprint or OTP. I\'m taking you to the login page.',
    },
    citizen_required_naam: {
        hi: 'अच्छा, नाम बदलवाना है! इसके लिए आधार कार्ड से लॉगिन ज़रूरी है। अगर आपके नाम से करवाना है तो fingerprint से भी हो जाएगा। चलिए, मैं आपको लॉगिन पेज पर ले जाता हूँ।',
        en: 'You want a name change! For this, Aadhaar login is required. If it\'s in your name, fingerprint will work too. Let me take you to the login page.',
    },
    citizen_required_pipeline: {
        hi: 'अच्छा, गैस पाइपलाइन जुड़वानी है! इसके लिए आधार कार्ड से लॉगिन करना होगा — अपने नाम से कराना है तो अंगूठा लगा दीजिए, बहुत आसान है। मैं आपको लॉगिन पेज पर ले जा रहा हूँ।',
        en: 'You want a gas pipeline connection! Aadhaar login is needed for this. Thumbprint is the easiest way. Let me take you to login.',
    },
    citizen_required_connection: {
        hi: 'अच्छा, नया कनेक्शन लगवाना है! इसके लिए आधार कार्ड से लॉगिन ज़रूरी है। अंगूठा लगाइए या OTP डालिए — 2-3 सेकंड में हो जाएगा। चलिए।',
        en: 'New connection! Aadhaar login is required. Thumbprint or OTP — just 2-3 seconds. Let\'s go.',
    },

    // ── Page-specific guidance ──────────────────────

    page_guidance: {
        '/': {
            hi: 'होम पेज खुल गया। यहाँ चार सेवाएं हैं — बिजली बिल, पानी बिल, गैस बिल, और Property Tax। बोलें कौन सा बिल भरना है, या शिकायत दर्ज करनी है।',
            en: 'Home page is open. Four services — electricity, water, gas, and property tax. Tell me which bill or say "complaint".',
        },
        '/bill/electricity': {
            hi: 'बिजली बिल का पेज खुल गया। अब consumer number डालें — नीचे नंबर पैड है। Consumer number आपके पुराने बिजली बिल पर ऊपर बाईं तरफ लिखा होता है, जैसे PSEB-123456। QR कोड भी स्कैन कर सकते हैं — नीचे QR बटन है।',
            en: 'Electricity bill page is open. Enter your consumer number using the keypad below. It\'s on your previous bill, like PSEB-123456. You can also scan QR.',
        },
        '/bill/water': {
            hi: 'पानी बिल का पेज खुल गया। Consumer number डालें — जैसे PHED-789012। यह आपके पिछले बिल पर लिखा होता है। नीचे नंबर पैड से डालें या QR स्कैन करें।',
            en: 'Water bill page is open. Enter your consumer number like PHED-789012. Use the keypad or scan QR.',
        },
        '/bill/gas': {
            hi: 'गैस बिल का पेज खुल गया। LPG ID या consumer number डालें — जैसे GPL-345678। यह आपकी गैस बुक पर या सिलेंडर पर लिखा होता है।',
            en: 'Gas bill page is open. Enter your LPG ID like GPL-345678. It\'s on your gas book or cylinder.',
        },
        '/complaint': {
            hi: 'शिकायत का पेज खुल गया। नीचे छह श्रेणियां हैं — टूटी स्ट्रीटलाइट, पानी सप्लाई, कचरा, बिजली वोल्टेज, सड़क गड्ढा, या अन्य। बोलें क्या समस्या है, मैं खुद श्रेणी चुन लूँगा। फोटो भी लगा सकते हैं।',
            en: 'Complaint page is open. Six categories — broken streetlight, water supply, garbage, voltage, road damage, or other. Tell me your issue and I\'ll pick the category. You can also attach a photo.',
        },
    },

    // ── Bill step guidance (after consumer number) ───

    bill_found: {
        hi: 'बिल मिल गया! स्क्रीन पर बिल की जानकारी दिख रही है — नाम, राशि, और ड्यू डेट। "आगे बढ़ें" बटन दबाएं भुगतान के लिए, या बोलें "भुगतान करो"।',
        en: 'Bill found! The details are shown — name, amount, and due date. Press "Proceed" or say "pay" to make payment.',
    },
    bill_payment_options: {
        hi: 'भुगतान कैसे करना है? तीन तरीके हैं — UPI (GPay, PhonePe), कार्ड (Debit/Credit), या कैश (नोट डालें)। बोलें या बटन दबाएं।',
        en: 'How would you like to pay? Three options — UPI (GPay, PhonePe), Card (Debit/Credit), or Cash. Say the method or tap the button.',
    },
    bill_success: {
        hi: 'भुगतान सफल! 🎉 रसीद तैयार है — "Download Receipt" बटन से PDF डाउनलोड कर सकते हैं, या "Print" से प्रिंट करें। और कोई बिल भरना है?',
        en: 'Payment successful! 🎉 Receipt is ready — download as PDF or print. Want to pay another bill?',
    },

    // ── Complaint step guidance ─────────────────────

    complaint_category: {
        hi: 'श्रेणी चुन लीजिए। छह विकल्प हैं: 1. टूटी स्ट्रीटलाइट 💡, 2. पानी सप्लाई 🚰, 3. कचरा 🗑️, 4. बिजली वोल्टेज ⚡, 5. सड़क गड्ढा 🛣️, 6. अन्य 📋। बोलें या बटन दबाएं।',
        en: 'Choose a category: 1. Broken Streetlight, 2. Water Supply, 3. Garbage, 4. Voltage, 5. Road Damage, 6. Other.',
    },
    complaint_details: {
        hi: 'अब समस्या का विवरण लिखें या बोलें। फोटो भी लगा सकते हैं — "📸 फोटो" बटन है। लोकेशन अपने आप पकड़ लेगा। सब हो जाए तो "शिकायत दर्ज करें" बोलें या बटन दबाएं।',
        en: 'Describe the issue — type or speak. Add a photo if you want. Location is auto-detected. Then say "submit" or press the button.',
    },
    complaint_done: {
        hi: 'शिकायत दर्ज हो गई! 🎉 टिकट नंबर स्क्रीन पर है — इसे लिख लीजिए। PDF भी डाउनलोड कर सकते हैं। 48 घंटे में कार्रवाई होगी।',
        en: 'Complaint filed! 🎉 Your ticket number is on screen — note it down. You can also download the PDF. Action within 48 hours.',
    },

    // ── Auth guidance ───────────────────────────────

    auth_thumb: {
        hi: 'अंगूठा लगाइए — बायोमेट्रिक स्कैनर पर उंगली रखें। 2-3 सेकंड लगेंगे।',
        en: 'Place your thumb on the biometric scanner. It\'ll take 2-3 seconds.',
    },
    auth_iris: {
        hi: 'आँख स्कैन — कैमरे की तरफ देखें, आँख खुली रखें। 2-3 सेकंड में हो जाएगा।',
        en: 'Look at the camera with your eye open. It\'ll take 2-3 seconds.',
    },
    auth_otp: {
        hi: 'OTP वाला तरीका — अपना आधार से जुड़ा मोबाइल नंबर डालें, OTP आएगा। फिर OTP डालें और लॉगिन हो जाएगा।',
        en: 'OTP method — enter your Aadhaar-linked mobile number. You\'ll receive an OTP. Enter it to login.',
    },

    // ── Dashboard guidance ──────────────────────────

    citizen_dashboard: {
        hi: 'आपका डैशबोर्ड खुल गया है, नमस्ते! यहाँ तीन सेक्शन हैं — आपके बिल (जो बकाया हैं), आपकी शिकायतें (पुरानी + नई), और अतिरिक्त सेवाएं जैसे नया कनेक्शन, नाम बदलाव, प्रमाणपत्र। बोलें क्या करना है?',
        en: 'Your dashboard is open! Three sections — your pending bills, your complaints (old + new), and extra services like new connection, name change, certificates. What would you like to do?',
    },
};

// ── COMPREHENSIVE Q&A ───────────────────────────────
// Covers every possible question a user might ask

export const COMMON_QA = [
    // ── Consumer Number ──
    {
        keywords: ['consumer number', 'consumer', 'number kahan', 'kaha se', 'kaise milega', 'id kahan', 'कंज्यूमर', 'नंबर कहाँ', 'कहाँ से', 'आईडी', 'id number'],
        answer: {
            hi: 'Consumer number आपके पुराने बिल पर ऊपर बाईं तरफ लिखा होता है। बिजली बिल पर PSEB- से शुरू होता है, पानी पर PHED-, गैस पर GPL-। अगर बिल नहीं है तो QR स्कैन बटन दबाएं या नजदीकी ऑफिस से पूछें। डेमो के लिए PSEB-123456 डालें।',
            en: 'Consumer number is on top-left of your previous bill. Electricity starts with PSEB-, water with PHED-, gas with GPL-. If no bill, use QR scan or ask at the office. For demo, try PSEB-123456.',
        },
    },
    // ── QR scan ──
    {
        keywords: ['qr', 'scan', 'qr code', 'barcode', 'स्कैन', 'क्यू आर'],
        answer: {
            hi: 'QR स्कैन करने के लिए नीचे "📷 QR Scan" बटन दबाएं। बिल पर जो QR कोड है उसे कैमरे के सामने रखें, consumer number अपने आप भर जाएगा।',
            en: 'Press the "📷 QR Scan" button below. Hold your bill\'s QR code in front of the camera — the consumer number will auto-fill.',
        },
    },
    // ── Bill amount ──
    {
        keywords: ['kitna paisa', 'kitna', 'amount', 'bill kitna', 'कितना', 'कितने पैसे', 'rashi', 'राशि', 'total', 'due'],
        answer: {
            hi: 'बिल की राशि जानने के लिए पहले consumer number डालें और "Fetch Bill" दबाएं। फिर बिल की पूरी जानकारी दिखेगी — राशि, यूनिट्स, ड्यू डेट, पिछला भुगतान सब।',
            en: 'Enter your consumer number first and press "Fetch Bill". Then you\'ll see the full details — amount, units, due date, last payment.',
        },
    },
    // ── Payment methods ──
    {
        keywords: ['upi', 'card', 'cash', 'payment', 'bhugtan', 'kaise pay', 'pay kaise', 'भुगतान', 'कैसे', 'gpay', 'phonepe', 'paytm'],
        answer: {
            hi: 'तीन तरीके हैं — 1. UPI: GPay, PhonePe, Paytm से। 2. Card: Debit या Credit कार्ड से। 3. Cash: मशीन में नोट डालें। सब में 2-3 सेकंड लगते हैं।',
            en: 'Three payment methods — 1. UPI (GPay, PhonePe, Paytm), 2. Card (Debit/Credit), 3. Cash (insert notes). All take 2-3 seconds.',
        },
    },
    // ── Receipt / PDF ──
    {
        keywords: ['receipt', 'raseed', 'download', 'print', 'pdf', 'रसीद', 'प्रिंट', 'डाउनलोड'],
        answer: {
            hi: 'भुगतान सफल होने के बाद "Download Receipt" बटन दिखेगा — दबाएं तो PDF डाउनलोड हो जाएगी। प्रिंट भी कर सकते हैं। रसीद में Transaction ID, राशि, तारीख सब लिखा होता है।',
            en: 'After payment, press "Download Receipt" for a PDF. You can also print it. The receipt has Transaction ID, amount, and date.',
        },
    },
    // ── Due date ──
    {
        keywords: ['due date', 'last date', 'kab tak', 'deadline', 'akhri', 'अंतिम', 'आखिरी', 'ड्यू', 'तारीख'],
        answer: {
            hi: 'ड्यू डेट आपके बिल पर लिखी होती है। Consumer number डालने पर ड्यू डेट भी दिखेगी। आम तौर पर बिल आने के 15-30 दिन बाद होती है। देर से भरने पर जुर्माना लग सकता है।',
            en: 'Due date is shown after entering consumer number. Usually 15-30 days after bill generation. Late payment may have penalties.',
        },
    },
    // ── Units / consumption ──
    {
        keywords: ['unit', 'units', 'consumption', 'kitna use', 'meter', 'reading', 'यूनिट', 'मीटर', 'रीडिंग', 'खपत'],
        answer: {
            hi: 'यूनिट्स यानी आपने कितनी बिजली/पानी/गैस इस्तेमाल की। मीटर रीडिंग से पता चलता है। बिजली kWh में, पानी KL में, गैस सिलेंडर में नापी जाती है। बिल में सब दिखेगा।',
            en: 'Units show your consumption. Electricity in kWh, water in KL, gas in cylinders. All shown on the bill details.',
        },
    },
    // ── Help / what can I do ──
    {
        keywords: ['help', 'madad', 'sahayata', 'kya kar', 'kya kya', 'feature', 'service', 'sewa', 'मदद', 'सहायता', 'क्या कर', 'सेवा'],
        answer: {
            hi: 'यहाँ आप ये सब कर सकते हैं: 1. बिजली बिल भरें ⚡ 2. पानी बिल भरें 💧 3. गैस बिल भरें 🔥 4. Property Tax भरें 🏠 5. शिकायत दर्ज करें 📝 6. रसीद डाउनलोड करें 7. QR से बिल स्कैन करें। बोलें कौन सा काम करना है!',
            en: 'You can: 1. Pay electricity bill ⚡ 2. Pay water bill 💧  3. Pay gas bill 🔥 4. Pay property tax 🏠 5. File complaint 📝 6. Download receipts 7. Scan QR bills.',
        },
    },
    // ── Complaint filing ──
    {
        keywords: ['shikayat kaise', 'complaint kaise', 'शिकायत कैसे', 'file complaint', 'report kaise'],
        answer: {
            hi: 'शिकायत दर्ज करने के लिए: 1. बोलें "शिकायत" या बटन दबाएं 2. श्रेणी चुनें (बत्ती, पानी, कचरा, सड़क) 3. समस्या लिखें या बोलें 4. फोटो लगा सकते हैं 5. "दर्ज करें" दबाएं। टिकट नंबर मिलेगा 48 घंटे में कार्रवाई।',
            en: 'To file a complaint: 1. Say "complaint" 2. Choose category 3. Describe the issue 4. Add photo (optional) 5. Submit. You\'ll get a ticket number, action within 48 hours.',
        },
    },
    // ── Complaint categories ──
    {
        keywords: ['category', 'shreni', 'श्रेणी', 'kaun kaun', 'type', 'prakar', 'प्रकार', 'categories'],
        answer: {
            hi: 'शिकायत की छह श्रेणियां: 1. टूटी स्ट्रीटलाइट 💡 — बत्ती नहीं जल रही 2. पानी सप्लाई 🚰 — पानी नहीं आ रहा, पाइप लीक 3. कचरा 🗑️ — कचरा नहीं उठा 4. बिजली वोल्टेज ⚡ — करंट कम-ज्यादा 5. सड़क गड्ढा 🛣️ — सड़क टूटी 6. अन्य 📋',
            en: 'Six complaint categories: 1. Broken Streetlight 💡 2. Water Supply 🚰 3. Garbage 🗑️ 4. Voltage ⚡ 5. Road Damage 🛣️ 6. Other 📋',
        },
    },
    // ── Complaint status ──
    {
        keywords: ['complaint status', 'ticket', 'shikayat status', 'kya hua', 'kab hoga', 'progress', 'स्टेटस', 'टिकट'],
        answer: {
            hi: 'शिकायत का स्टेटस देखने के लिए Citizen Login करें — डैशबोर्ड में "My Complaints" सेक्शन में सब दिखेगा। हरा = हल हो गई, पीला = प्रगति में। अभी डेमो में दो शिकायतें हैं।',
            en: 'Login as Citizen to check complaint status in "My Complaints". Green = resolved, yellow = in progress.',
        },
    },
    // ── Photo for complaint ──
    {
        keywords: ['photo', 'camera', 'tasvir', 'image', 'picture', 'फोटो', 'कैमरा', 'तस्वीर'],
        answer: {
            hi: 'शिकायत में फोटो लगाने के लिए "📸 Photo" बटन दबाएं। कैमरा खुलेगा या गैलरी से चुनें। फोटो लगाने से शिकायत जल्दी हल होती है।',
            en: 'Press "📸 Photo" button to attach a photo. Use camera or gallery. Adding a photo helps resolve complaints faster.',
        },
    },
    // ── Location ──
    {
        keywords: ['location', 'jagah', 'kahan', 'address', 'pata', 'जगह', 'कहाँ', 'पता', 'स्थान'],
        answer: {
            hi: 'शिकायत में Location अपने आप पकड़ लेता है GPS से। अगर GPS नहीं है तो Ludhiana डिफ़ॉल्ट सेट होता है। बिल में पता भी दिखता है।',
            en: 'Location is auto-detected via GPS for complaints. Bill address is shown after entering consumer number.',
        },
    },
    // ── Login methods ──
    {
        keywords: ['login', 'sign in', 'कैसे लॉगिन', 'login kaise', 'kaise login'],
        answer: {
            hi: 'लॉगिन के तीन तरीके: 1. अंगूठा 👆 — बायोमेट्रिक स्कैनर पर लगाएं (सबसे आसान) 2. आँख 👁️ — कैमरे में देखें 3. OTP 📱 — मोबाइल पर कोड आएगा, डालें। आधार कार्ड ज़रूरी है।',
            en: 'Three login methods: 1. Thumb 👆 2. Iris 👁️ 3. OTP 📱. Aadhaar card is required for all methods.',
        },
    },
    // ── e-Pramaan / Aadhaar ──
    {
        keywords: ['aadhaar', 'aadhar', 'e-pramaan', 'epramaan', 'identity', 'pehchan', 'आधार', 'ई-प्रमाण', 'पहचान'],
        answer: {
            hi: 'SUVIDHA Setu e-Pramaan यानी डिजिटल पहचान से काम करता है। आधार कार्ड से लॉगिन होता है — अंगूठा, आँख, या OTP से। एक बार लॉगिन के बाद सारे बिल और शिकायतें एक जगह दिखेंगी।',
            en: 'SUVIDHA Setu uses e-Pramaan digital identity. Login via Aadhaar — thumb, iris, or OTP. Once logged in, all your bills and complaints are in one place.',
        },
    },
    // ── Offline / internet ──
    {
        keywords: ['offline', 'internet', 'network', 'no signal', 'बिना नेट', 'ऑफलाइन'],
        answer: {
            hi: 'हाँ, ऑफलाइन भी काम कर सकते हैं! बिल भुगतान और शिकायत सेव हो जाएगी, इंटरनेट आने पर सिंक हो जाएगी। ऊपर "Offline" बैज दिखेगा।',
            en: 'Yes, it works offline too! Bills and complaints are saved locally and sync when internet returns. You\'ll see an "Offline" badge.',
        },
    },
    // ── Property tax ──
    {
        keywords: ['property', 'tax', 'property tax', 'ghar ka tax', 'house tax', 'प्रॉपर्टी', 'टैक्स', 'घर का'],
        answer: {
            hi: 'Property Tax भी भर सकते हैं — होम पेज पर 🏠 बटन दबाएं या बोलें "Property Tax"। Demo में इलेक्ट्रिसिटी बिल पेज से भरा जा सकता है।',
            en: 'You can pay Property Tax too — press the 🏠 button on home page or say "Property Tax".',
        },
    },
    // ── This kiosk / system ──
    {
        keywords: ['suvidha', 'setu', 'kiosk', 'system', 'app', 'yeh kya', 'क्या है', 'सुविधा', 'सेतु', 'किओस्क'],
        answer: {
            hi: 'SUVIDHA Setu एक Smart Civic Kiosk है — C-DAC द्वारा बनाया गया। इससे बिजली, पानी, गैस बिल भर सकते हैं, शिकायत दर्ज कर सकते हैं, और सरकारी सेवाएं ले सकते हैं। आवाज़ और टच दोनों से काम करता है।',
            en: 'SUVIDHA Setu is a Smart Civic Kiosk by C-DAC. Pay utility bills, file complaints, and access government services. Works with voice and touch.',
        },
    },
    // ── Demo data ──
    {
        keywords: ['demo', 'test', 'try', 'example', 'sample', 'डेमो', 'टेस्ट'],
        answer: {
            hi: 'Demo के लिए ये consumer numbers डालें: बिजली → PSEB-123456 (₹450), पानी → PHED-789012 (₹280), गैस → GPL-345678 (₹620)। कोई भी number डालें तो random बिल बनेगा।',
            en: 'For demo, use: Electricity → PSEB-123456 (₹450), Water → PHED-789012 (₹280), Gas → GPL-345678 (₹620). Any number generates a random bill.',
        },
    },
    // ── Language ──
    {
        keywords: ['bhasha', 'language', 'hindi', 'english', 'punjabi', 'change language', 'भाषा', 'बदलो'],
        answer: {
            hi: 'भाषा शुरू में चुनी गई थी। अभी हिंदी में बात कर रहे हैं। भाषा बदलने के लिए "वापस" बोलें और शुरू से आएं। या आप किसी भी भाषा में बोलें, मैं समझने की कोशिश करूँगा।',
            en: 'Language was selected at the start. You\'re currently using the voice in your chosen language. Say "go back" to change, or speak in any language.',
        },
    },
    // ── What is voice mode ──
    {
        keywords: ['voice mode', 'awaz', 'आवाज़', 'बोल', 'mic', 'माइक'],
        answer: {
            hi: 'वॉइस मोड चालू है — आप बोलकर सब काम कर सकते हैं। "बिजली बिल" बोलें, "शिकायत" बोलें, "वापस" बोलें। मैं हमेशा सुन रहा हूँ। बंद करना हो तो "बंद करो" बोलें।',
            en: 'Voice mode is ON — do everything by speaking. Say "electricity bill", "complaint", "go back". I\'m always listening. Say "stop" to turn off.',
        },
    },
    // ── Admin ──
    {
        keywords: ['admin', 'dashboard', 'manage', 'एडमिन', 'प्रशासक'],
        answer: {
            hi: 'Admin Dashboard अधिकारियों के लिए है — सभी लेनदेन, शिकायतें, और किओस्क की स्थिति दिखती है। सामान्य उपयोगकर्ता इसका इस्तेमाल नहीं करते।',
            en: 'Admin Dashboard is for officials — shows all transactions, complaints, and kiosk status. Regular users don\'t need this.',
        },
    },
    // ── Security / safety ──
    {
        keywords: ['safe', 'secure', 'suraksha', 'data', 'privacy', 'सुरक्षा', 'डेटा', 'प्राइवेसी'],
        answer: {
            hi: 'आपकी जानकारी सुरक्षित है। आधार वेरिफिकेशन e-Pramaan से होता है। बिल भुगतान का रिकॉर्ड ऑफलाइन भी सेव रहता है। किसी और को आपकी जानकारी नहीं दिखती।',
            en: 'Your information is secure. Aadhaar verification uses e-Pramaan. Payment records are saved even offline. Your data stays private.',
        },
    },
    // ── Numpad ──
    {
        keywords: ['numpad', 'number pad', 'keyboard', 'type', 'kaise likhe', 'number daale', 'नंबर कैसे', 'कैसे डालें'],
        answer: {
            hi: 'Consumer number डालने के लिए नीचे नंबर पैड है — 0-9 के बटन हैं। ⌫ से एक अक्षर मिटता है, C से सब मिट जाता है। Letter डालने के लिए ऊपर text field में सीधे टाइप करें।',
            en: 'Use the number pad below — buttons 0-9 to enter digits. ⌫ deletes one character, C clears all. Type letters directly in the text field above.',
        },
    },
    // ── New connection ──
    {
        keywords: ['new connection', 'naya', 'apply', 'naya connection', 'नया कनेक्शन', 'अप्लाई'],
        answer: {
            hi: 'नया कनेक्शन लगाने के लिए Citizen Login करें। डैशबोर्ड में "🆕 Apply New Connection" का विकल्प है। वहाँ से आवेदन कर सकते हैं।',
            en: 'For a new connection, login as Citizen. You\'ll find "🆕 Apply New Connection" on your dashboard.',
        },
    },
    // ── Name change ──
    {
        keywords: ['name change', 'naam badlo', 'naam', 'transfer', 'नाम बदलो', 'नाम'],
        answer: {
            hi: 'नाम बदलवाने के लिए Citizen Login करें। डैशबोर्ड में "✏️ Name Change" विकल्प है।',
            en: 'For name change, login as Citizen. You\'ll find "✏️ Name Change" on your dashboard.',
        },
    },
    // ── Certificate ──
    {
        keywords: ['certificate', 'pramanpatra', 'print certificate', 'प्रमाणपत्र', 'सर्टिफिकेट'],
        answer: {
            hi: 'प्रमाणपत्र प्रिंट करने के लिए Citizen Login करें। डैशबोर्ड में "📜 Print Certificate" विकल्प है।',
            en: 'To print certificates, login as Citizen. You\'ll find "📜 Print Certificate" on your dashboard.',
        },
    },
    // ── Existing bill details ──
    {
        keywords: ['electricity bill details', 'water bill details', 'gas bill details', 'bijli bill', 'pani bill', 'gas bill details'],
        answer: {
            hi: 'डेमो बिल: बिजली: PSEB-123456, राजेश कुमार, ₹450, 85 kWh, ड्यू 28 Feb। पानी: PHED-789012, परमजीत सिंह, ₹280, 12 KL, ड्यू 5 Mar। गैस: GPL-345678, सुनीता देवी, ₹620, 3 सिलेंडर, ड्यू 10 Mar।',
            en: 'Demo bills: Electricity: PSEB-123456, Rajesh Kumar, ₹450, 85 kWh. Water: PHED-789012, Paramjit Singh, ₹280. Gas: GPL-345678, Sunita Devi, ₹620.',
        },
    },
    // ── Payment confirmation ──
    {
        keywords: ['payment ho gaya', 'paid', 'successful', 'ho gaya', 'भुगतान हो गया', 'paid kya'],
        answer: {
            hi: 'भुगतान सफल होने पर हरे रंग की स्क्रीन दिखती है "Payment Successful" लिखा होता है। Transaction ID मिलता है। रसीद डाउनलोड कर लीजिए।',
            en: 'After successful payment, you\'ll see a green "Payment Successful" screen with a Transaction ID. Download the receipt.',
        },
    },
];

// ── HELPER FUNCTIONS ────────────────────────────────

export function matchesKeywords(text, keywords) {
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
}

export function detectBillType(text) {
    const lower = text.toLowerCase();
    for (const [type, words] of Object.entries(BILL_KEYWORDS)) {
        if (words.some(w => lower.includes(w))) return type;
    }
    return null;
}

export function detectComplaintCategory(text) {
    const lower = text.toLowerCase();
    for (const [cat, words] of Object.entries(COMPLAINT_CATEGORY_KEYWORDS)) {
        if (words.some(w => lower.includes(w))) return cat;
    }
    return null;
}

export function detectPaymentMethod(text) {
    const lower = text.toLowerCase();
    for (const [method, words] of Object.entries(PAYMENT_KEYWORDS)) {
        if (words.some(w => lower.includes(w))) return method;
    }
    return null;
}

export function findCommonAnswer(text, lang) {
    const lower = text.toLowerCase();
    for (const qa of COMMON_QA) {
        if (qa.keywords.some(k => lower.includes(k))) {
            return qa.answer[lang] || qa.answer.en;
        }
    }
    return null;
}

export function getPageGuidance(route, lang) {
    const g = RESPONSES.page_guidance[route];
    return g ? (g[lang] || g.en) : null;
}

export function getResponse(key, lang) {
    const r = RESPONSES[key];
    return r ? (r[lang] || r.en) : null;
}

export function getInitialGreeting(lang) {
    return INITIAL_GREETINGS[lang] || INITIAL_GREETINGS.en;
}
