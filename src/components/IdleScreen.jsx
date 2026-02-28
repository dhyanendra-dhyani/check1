/**
 * ═══════════════════════════════════════════════════════════
 * IdleScreen v9 — Language First, Then Voice/Touch
 *
 * STEP 1: Language Selection
 *   - Auto-detect location → show top 5 regional languages
 *   - All 22+ languages in expandable section
 *   - English + Hindi always on top
 *
 * STEP 2: Voice/Touch Choice (in selected language)
 *   - TTS greeting in chosen language
 *   - Any speech = voice mode
 *   - Touch button = touch mode
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
    ALL_LANGUAGES,
    detectRegion,
    getLang,
} from '../utils/regionalLanguages';

// Two-step flow
const STEP_LANG = 'lang';
const STEP_CHOICE = 'choice';

// Greetings in each language
const GREETINGS = {
    en: { welcome: 'Welcome!', question: 'How would you like to interact?', voiceLabel: 'By Voice', voiceSub: 'Speak', touchLabel: 'By Touch', touchSub: 'Tap', listenHint: 'Say anything = Voice mode ✨', listening: '🎧 Listening... say anything', heard: '✓ Heard!', voiceConfirm: "Great! Let's get started.", ttsGreet: 'Welcome! Would you like to use voice or touch?' },
    hi: { welcome: 'स्वागत है!', question: 'आप कैसे काम करना चाहेंगे?', voiceLabel: 'बोलकर', voiceSub: 'Voice', touchLabel: 'छूकर', touchSub: 'Touch', listenHint: 'कुछ भी बोलें = Voice mode ✨', listening: '🎧 सुन रहा हूँ... कुछ भी बोलें', heard: '✓ सुन लिया!', voiceConfirm: 'बहुत अच्छा! चलिए शुरू करते हैं।', ttsGreet: 'स्वागत है! बोलकर काम करना चाहेंगे, या टच से?' },
    pa: { welcome: 'ਜੀ ਆਇਆਂ ਨੂੰ!', question: 'ਤੁਸੀਂ ਕਿਵੇਂ ਕੰਮ ਕਰਨਾ ਚਾਹੋਗੇ?', voiceLabel: 'ਬੋਲ ਕੇ', voiceSub: 'Voice', touchLabel: 'ਛੂਹ ਕੇ', touchSub: 'Touch', listenHint: 'ਕੁਝ ਵੀ ਬੋਲੋ = Voice mode ✨', listening: '🎧 ਸੁਣ ਰਿਹਾ ਹਾਂ...', heard: '✓ ਸੁਣ ਲਿਆ!', voiceConfirm: 'ਬਹੁਤ ਵਧੀਆ! ਚੱਲੋ ਸ਼ੁਰੂ ਕਰਦੇ ਹਾਂ।', ttsGreet: 'ਜੀ ਆਇਆਂ ਨੂੰ! ਬੋਲ ਕੇ ਕੰਮ ਕਰਨਾ ਚਾਹੋਗੇ, ਜਾਂ ਛੂਹ ਕੇ?' },
    bn: { welcome: 'স্বাগতম!', question: 'আপনি কিভাবে কাজ করতে চান?', voiceLabel: 'বলে', voiceSub: 'Voice', touchLabel: 'ছুয়ে', touchSub: 'Touch', listenHint: 'যেকোনো কিছু বলুন', listening: '🎧 শুনছি...', heard: '✓ শুনেছি!', voiceConfirm: 'দারুণ! চলুন শুরু করি।', ttsGreet: 'স্বাগতম! বলে কাজ করবেন, না ছুয়ে?' },
    ta: { welcome: 'வரவேற்கிறோம்!', question: 'எப்படி வேலை செய்ய விரும்புகிறீர்கள்?', voiceLabel: 'பேசி', voiceSub: 'Voice', touchLabel: 'தொட்டு', touchSub: 'Touch', listenHint: 'ஏதாவது சொல்லுங்கள்', listening: '🎧 கேட்கிறேன்...', heard: '✓ கேட்டேன்!', voiceConfirm: 'நல்லது! ஆரம்பிக்கலாம்.', ttsGreet: 'வரவேற்கிறோம்! பேசி வேலை செய்வீர்களா, தொட்டு?' },
    te: { welcome: 'స్వాగతం!', question: 'మీరు ఎలా పని చేయాలనుకుంటున్నారు?', voiceLabel: 'మాట్లాడి', voiceSub: 'Voice', touchLabel: 'తాకి', touchSub: 'Touch', listenHint: 'ఏదైనా చెప్పండి', listening: '🎧 వింటున్నాను...', heard: '✓ విన్నాను!', voiceConfirm: 'భలే! మొదలు పెడదాం.', ttsGreet: 'స్వాగతం! మాట్లాడి పని చేస్తారా, తాకి?' },
    mr: { welcome: 'स्वागत!', question: 'तुम्हाला कसे काम करायचे आहे?', voiceLabel: 'बोलून', voiceSub: 'Voice', touchLabel: 'स्पर्श करून', touchSub: 'Touch', listenHint: 'काहीही बोला', listening: '🎧 ऐकतोय...', heard: '✓ ऐकले!', voiceConfirm: 'छान! चला सुरू करूया.', ttsGreet: 'स्वागत! बोलून काम करायचे आहे, की स्पर्श करून?' },
};

const getGreeting = (lang) => GREETINGS[lang] || GREETINGS.en;

const LangButton = memo(function LangButton({ lang, isSelected, onSelect }) {
    return (
        <button onClick={() => onSelect(lang.code)}
            className={`p-3 rounded-xl cursor-pointer border transition-all text-center hover:scale-[1.02] active:scale-95 ${isSelected
                ? 'bg-indigo-500/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                : 'bg-white/5 border-white/8 hover:bg-white/10 hover:border-white/20'}`}
        >
            <p className="text-lg font-bold leading-tight" style={{ color: isSelected ? '#A5B4FC' : '#F1F5F9' }}>
                {lang.native}
            </p>
            <p className="text-xs font-medium mt-1" style={{ color: isSelected ? '#818CF8' : 'rgba(255,255,255,0.35)' }}>
                {lang.name}
            </p>
            {isSelected && (
                <div className="w-5 h-5 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center mx-auto mt-1.5">✓</div>
            )}
        </button>
    );
});

export default function IdleScreen({ onStart, lang, setLang, blindMode, setBlindMode }) {
    const [step, setStep] = useState(STEP_LANG);
    const [regionLangs, setRegionLangs] = useState([]);
    const [allLangs, setAllLangs] = useState([]);
    const [showAll, setShowAll] = useState(false);
    const [isDetecting, setIsDetecting] = useState(true);
    const [detectedState, setDetectedState] = useState(null);
    const [selectedLang, setSelectedLang] = useState(lang || 'hi');
    const [listenStatus, setListenStatus] = useState('');

    const isWakingRef = useRef(false);
    const recognitionRef = useRef(null);
    const hasGreetedRef = useRef(false);

    // ── STEP 1: Detect region on mount ──────────────
    useEffect(() => {
        setIsDetecting(true);
        detectRegion().then(({ state, languages, reason }) => {
            setDetectedState(state);
            setRegionLangs(languages);
            setIsDetecting(false);

            // Build "all" list: regional first, then rest
            const regionalCodes = new Set(languages.map(l => l.code));
            const rest = ALL_LANGUAGES.filter(l => !regionalCodes.has(l.code));
            setAllLangs([...languages, ...rest]);

            console.log(`[IdleScreen] Region: ${state} (${reason}), langs: ${languages.map(l => l.code).join(',')}`);
        });
    }, []);

    // Handle language selection
    const handleSelectLang = useCallback((code) => {
        setSelectedLang(code);
        setLang(code);
        console.log(`[IdleScreen] Language selected: ${code}`);
    }, [setLang]);

    // Proceed to voice/touch choice
    const goToChoice = useCallback(() => {
        setStep(STEP_CHOICE);
        hasGreetedRef.current = false;

        // Play greeting in selected language
        const g = getGreeting(selectedLang);
        const speechCode = getLang(selectedLang).speechCode;

        console.log(`[IdleScreen] → Choice step, lang=${selectedLang}`);

        try {
            window.speechSynthesis?.cancel();
            const u = new SpeechSynthesisUtterance(g.ttsGreet);
            u.lang = speechCode;
            u.rate = 1;
            const voices = window.speechSynthesis?.getVoices() || [];
            const match = voices.find(v => v.lang === speechCode);
            if (match) u.voice = match;

            u.onend = () => {
                console.log('[IdleScreen] Greeting done → listening for choice');
                startChoiceListening(speechCode);
            };
            u.onerror = () => startChoiceListening(speechCode);

            window.speechSynthesis.speak(u);
            hasGreetedRef.current = true;
        } catch {
            startChoiceListening(speechCode);
        }
    }, [selectedLang]);

    // ── Choice Listening ────────────────────────────
    const startChoiceListening = useCallback((speechCode) => {
        if (isWakingRef.current) return;

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { console.log('[IdleScreen] ❌ No SpeechRecognition'); return; }

        try { recognitionRef.current?.abort(); } catch { }

        const r = new SR();
        r.lang = speechCode || 'hi-IN';
        r.continuous = false;
        r.interimResults = true;

        r.onstart = () => {
            console.log('[IdleScreen] 🎧 Choice listener STARTED');
            setListenStatus('listening');
        };

        r.onresult = (e) => {
            const text = e.results[0][0].transcript;
            console.log(`[IdleScreen] 💬 Heard: "${text}"`);
            setListenStatus('heard');

            // Any speech = voice! Only explicit touch words reject.
            const touchWords = ['touch', 'छूकर', 'chhukar', 'chukar', 'button', 'screen', 'ਛੂਹ', 'taakin', 'sparshaad'];
            const isTouchChoice = touchWords.some(w => text.toLowerCase().includes(w));

            if (e.results[0].isFinal) {
                if (isTouchChoice) {
                    console.log('[IdleScreen] → Touch mode');
                    chooseTouch();
                } else {
                    console.log('[IdleScreen] → Voice mode (user spoke!)');
                    chooseVoice();
                }
            }
        };

        r.onend = () => {
            if (!isWakingRef.current) {
                setListenStatus('');
                setTimeout(() => startChoiceListening(speechCode), 500);
            }
        };
        r.onerror = (e) => {
            if (!isWakingRef.current && e.error !== 'aborted') {
                setListenStatus('');
                setTimeout(() => startChoiceListening(speechCode), 1500);
            }
        };

        recognitionRef.current = r;
        try { r.start(); } catch (err) {
            console.log(`[IdleScreen] ❌ start() failed: ${err.message}`);
            setTimeout(() => startChoiceListening(speechCode), 1000);
        }
    }, []);

    const chooseVoice = useCallback(() => {
        if (isWakingRef.current) return;
        isWakingRef.current = true;
        window.speechSynthesis?.cancel();
        try { recognitionRef.current?.abort(); } catch { }

        const g = getGreeting(selectedLang);
        try {
            const u = new SpeechSynthesisUtterance(g.voiceConfirm);
            u.lang = getLang(selectedLang).speechCode;
            u.rate = 1.1;
            window.speechSynthesis.speak(u);
        } catch { }

        setTimeout(() => onStart?.(true, false), 800);
    }, [onStart, selectedLang]);

    const chooseBlind = useCallback(() => {
        if (isWakingRef.current) return;
        isWakingRef.current = true;
        window.speechSynthesis?.cancel();
        try { recognitionRef.current?.abort(); } catch { }
        setBlindMode?.(true);

        const blindConfirm = selectedLang === 'hi'
            ? 'एक्सेसिबिलिटी मोड चालू। मैं आपको हर चीज़ बोलकर बताऊँगी।'
            : 'Accessibility mode enabled. I will describe everything to you.';
        try {
            const u = new SpeechSynthesisUtterance(blindConfirm);
            u.lang = getLang(selectedLang).speechCode;
            u.rate = 1;
            window.speechSynthesis.speak(u);
        } catch { }

        setTimeout(() => onStart?.(true, true), 1000);
    }, [onStart, selectedLang, setBlindMode]);

    const chooseTouch = useCallback(() => {
        if (isWakingRef.current) return;
        isWakingRef.current = true;
        window.speechSynthesis?.cancel();
        try { recognitionRef.current?.abort(); } catch { }
        setTimeout(() => onStart?.(false, false), 300);
    }, [onStart]);

    // Cleanup
    useEffect(() => {
        return () => {
            try { recognitionRef.current?.abort(); } catch { }
            window.speechSynthesis?.cancel();
        };
    }, []);

    const g = getGreeting(selectedLang);
    const displayLangs = showAll ? allLangs : regionLangs;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto fast-fade-in"
            style={{ background: 'linear-gradient(160deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)' }}>
            <div className="min-h-screen flex flex-col items-center justify-start px-4 py-6 max-w-2xl mx-auto">

                {/* Header */}
                <div className="text-center mb-5 w-full">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                            <span className="text-white text-lg font-black">S</span>
                        </div>
                        <h1 className="text-2xl font-black text-white">SUVIDHA Setu</h1>
                        <span className="proto-badge">🔧 Prototype</span>
                    </div>
                    <div className="flex h-1 rounded-full overflow-hidden max-w-xs mx-auto mb-4">
                        <div className="flex-1" style={{ background: '#FF9933' }} />
                        <div className="flex-1" style={{ background: '#FFFFFF' }} />
                        <div className="flex-1" style={{ background: '#138808' }} />
                    </div>
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* STEP 1: LANGUAGE SELECTION                 */}
                {/* ═══════════════════════════════════════════ */}
                {step === STEP_LANG && (
                    <div className="w-full fast-fade-in">
                        {/* Step indicator */}
                        <div className="flex items-center justify-center gap-3 mb-5">
                            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white text-sm font-bold flex items-center justify-center">1</div>
                            <div className="w-16 h-0.5 bg-white/10" />
                            <div className="w-8 h-8 rounded-full bg-white/10 text-white/30 text-sm font-bold flex items-center justify-center">2</div>
                        </div>

                        <h2 className="text-2xl font-black text-white mb-1 text-center">Choose Your Language</h2>
                        <p className="text-white/40 font-medium text-sm text-center mb-4">अपनी भाषा चुनें • ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ</p>

                        {/* Region detection */}
                        <div className="w-full mb-3">
                            {isDetecting ? (
                                <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse" />
                                    <span className="text-white/50 text-sm">Detecting your region...</span>
                                </div>
                            ) : detectedState && (
                                <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                    <span className="text-green-400 text-sm">📍 <strong>{detectedState}</strong> — showing regional languages</span>
                                </div>
                            )}
                        </div>

                        {/* Toggle */}
                        <div className="w-full flex items-center justify-between mb-2">
                            <p className="text-white/30 text-xs font-semibold uppercase tracking-wider">
                                {showAll ? `All (${allLangs.length})` : `Top Languages`}
                            </p>
                            <button onClick={() => setShowAll(!showAll)}
                                className="text-indigo-400 text-xs font-bold cursor-pointer bg-transparent border-0 hover:text-indigo-300">
                                {showAll ? '← Top' : `All ${allLangs.length} →`}
                            </button>
                        </div>

                        {/* Language Grid */}
                        <div className={`w-full grid gap-2 mb-5 ${displayLangs.length > 6 ? 'grid-cols-3 md:grid-cols-4' : 'grid-cols-3'}`}>
                            {displayLangs.map((l) => (
                                <LangButton key={l.code} lang={l} isSelected={selectedLang === l.code} onSelect={handleSelectLang} />
                            ))}
                        </div>

                        {/* Continue button */}
                        <button onClick={goToChoice}
                            className="w-full py-4 rounded-2xl text-white font-bold text-lg cursor-pointer border-0 hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-lg shadow-indigo-500/20"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
                            Continue → आगे बढ़ें
                        </button>

                        <p className="text-white/20 text-xs text-center mt-4">
                            Selected: <strong className="text-white/40">{getLang(selectedLang).native} ({getLang(selectedLang).name})</strong>
                        </p>
                    </div>
                )}

                {/* ═══════════════════════════════════════════ */}
                {/* STEP 2: VOICE / TOUCH CHOICE               */}
                {/* ═══════════════════════════════════════════ */}
                {step === STEP_CHOICE && (
                    <div className="w-full fast-fade-in flex flex-col items-center">
                        {/* Step indicator */}
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-full bg-green-500 text-white text-sm font-bold flex items-center justify-center">✓</div>
                            <div className="w-16 h-0.5 bg-indigo-500" />
                            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white text-sm font-bold flex items-center justify-center">2</div>
                        </div>

                        {/* Selected language tag */}
                        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-6">
                            <span className="text-indigo-300 text-sm font-medium">🌐 {getLang(selectedLang).native}</span>
                        </div>

                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight text-center">
                            {g.welcome} 🙏
                        </h2>
                        <p className="text-lg text-white/70 font-medium mb-8 text-center">
                            {g.question}
                        </p>

                        {/* Two big choice buttons */}
                        <div className="flex gap-5 mb-6">
                            <button onClick={chooseVoice}
                                className="w-44 h-44 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-indigo-500/40 hover:border-indigo-400 hover:scale-105 active:scale-95 transition-all"
                                style={{ background: 'linear-gradient(160deg, rgba(99,102,241,0.25), rgba(99,102,241,0.1))' }}>
                                <span className="text-5xl">🎙️</span>
                                <div>
                                    <p className="text-white font-bold text-lg">{g.voiceLabel}</p>
                                    <p className="text-white/50 text-xs">{g.voiceSub}</p>
                                </div>
                                <div className="flex items-center gap-0.5 h-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="voice-bar-sm" style={{ animationDelay: `${i * 0.12}s`, background: 'rgba(165,180,252,0.7)' }} />
                                    ))}
                                </div>
                            </button>

                            <button onClick={chooseTouch}
                                className="w-44 h-44 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-emerald-500/40 hover:border-emerald-400 hover:scale-105 active:scale-95 transition-all"
                                style={{ background: 'linear-gradient(160deg, rgba(16,185,129,0.25), rgba(16,185,129,0.1))' }}>
                                <span className="text-5xl">👆</span>
                                <div>
                                    <p className="text-white font-bold text-lg">{g.touchLabel}</p>
                                    <p className="text-white/50 text-xs">{g.touchSub}</p>
                                </div>
                            </button>
                        </div>

                        {/* Accessibility Mode Button */}
                        <button onClick={chooseBlind}
                            className="w-full max-w-[356px] rounded-2xl p-4 cursor-pointer border-2 border-amber-500/40 hover:border-amber-400 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center gap-4 mb-4"
                            style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))' }}>
                            <span className="text-3xl">♿</span>
                            <div className="text-left">
                                <p className="text-white font-bold text-base">
                                    {selectedLang === 'hi' ? 'दृष्टिबाधित मोड' : selectedLang === 'pa' ? 'ਦ੍ਰਿਸ਼ਟੀਬਾਧਿਤ ਮੋਡ' : 'Accessibility Mode'}
                                </p>
                                <p className="text-white/50 text-xs">
                                    {selectedLang === 'hi' ? 'सब कुछ बोलकर बताया जाएगा' : selectedLang === 'pa' ? 'ਸਭ ਕੁਝ ਬੋਲ ਕੇ ਦੱਸਿਆ ਜਾਵੇਗਾ' : 'Full voice guidance — reads everything on screen'}
                                </p>
                            </div>
                        </button>

                        {/* Listening indicator */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${listenStatus === 'listening' ? 'bg-indigo-500/20 border border-indigo-500/30' : listenStatus === 'heard' ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/10 border border-white/10'}`}>
                            {listenStatus === 'listening' && (
                                <>
                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                                    <span className="text-indigo-300 text-sm font-medium">{g.listening}</span>
                                </>
                            )}
                            {listenStatus === 'heard' && (
                                <>
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                                    <span className="text-green-300 text-sm font-medium">{g.heard}</span>
                                </>
                            )}
                            {!listenStatus && (
                                <span className="text-white/40 text-sm">{g.listenHint}</span>
                            )}
                        </div>

                        {/* Back to language */}
                        <button onClick={() => { setStep(STEP_LANG); try { recognitionRef.current?.abort(); } catch { } window.speechSynthesis?.cancel(); setListenStatus(''); }}
                            className="mt-6 text-white/30 text-sm cursor-pointer bg-transparent border-0 hover:text-white/50">
                            ← Change Language
                        </button>
                    </div>
                )}

                {/* Bottom */}
                <div className="mt-auto pt-6 text-center w-full">
                    <div className="flex h-1 rounded-full overflow-hidden max-w-xs mx-auto mb-3">
                        <div className="flex-1" style={{ background: '#FF9933' }} />
                        <div className="flex-1" style={{ background: '#FFFFFF' }} />
                        <div className="flex-1" style={{ background: '#138808' }} />
                    </div>
                    <p className="text-white/15 text-xs">C-DAC SUVIDHA 2026 — Empowering Citizens Through Technology</p>
                </div>
            </div>
        </div>
    );
}
