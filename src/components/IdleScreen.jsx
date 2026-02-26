/**
 * ═══════════════════════════════════════════════════════════
 * IdleScreen v7 — Voice/Touch Choice
 *
 * On load: plays "Swagat hai! Bolne mein comfortable hain ya
 * touch se kaam karenge?" via TTS + shows two buttons.
 *
 * Voice choice: user says "bolne" → voiceMode = true
 * Touch choice: user taps → voiceMode = false
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const GOV_ADS = [
    { title: 'Jal Jeevan Mission 💧', subtitle: 'Har Ghar Nal Se Jal — Clean water for every household', source: 'Ministry of Jal Shakti', gradient: 'linear-gradient(160deg, #064E3B, #065F46, #0D9488)', video: 'https://cdn.pixabay.com/video/2020/05/25/39831-423375657_large.mp4' },
    { title: 'Digital India 🇮🇳', subtitle: 'Connecting 1.4 billion citizens to government services', source: 'Ministry of Electronics & IT', gradient: 'linear-gradient(160deg, #1E3A5F, #1E40AF, #6366F1)', video: 'https://cdn.pixabay.com/video/2021/04/04/69623-534500128_large.mp4' },
    { title: 'Swachh Bharat 🌿', subtitle: 'Clean India, Green India — A movement by every citizen', source: 'Ministry of Housing & Urban Affairs', gradient: 'linear-gradient(160deg, #14532D, #15803D, #22C55E)', video: 'https://cdn.pixabay.com/video/2019/11/08/28697-372261598_large.mp4' },
    { title: 'Ayushman Bharat 🏥', subtitle: 'Free healthcare for 50 crore citizens', source: 'National Health Authority', gradient: 'linear-gradient(160deg, #4C1D95, #6D28D9, #8B5CF6)', video: null },
];

export default function IdleScreen({ onStart }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [choosing, setChoosing] = useState(false);
    const [isWaking, setIsWaking] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const recognitionRef = useRef(null);
    const hasGreetedRef = useRef(false);

    // Auto-rotate slides
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((p) => (p + 1) % GOV_ADS.length);
            setVideoLoaded(false);
        }, 7000);
        return () => clearInterval(timer);
    }, []);

    // Greet on first tap
    const handleScreenTap = useCallback(() => {
        if (isWaking) return;
        if (!choosing) {
            setChoosing(true);
            greetAndListen();
        }
    }, [choosing, isWaking]);

    const greetAndListen = useCallback(() => {
        if (hasGreetedRef.current) return;
        hasGreetedRef.current = true;

        // Play greeting TTS
        const greeting = 'स्वागत है! आप बोलकर काम करना चाहेंगे, या टच से?';
        try {
            window.speechSynthesis?.cancel();
            const u = new SpeechSynthesisUtterance(greeting);
            u.lang = 'hi-IN';
            u.rate = 1;
            const voices = window.speechSynthesis?.getVoices() || [];
            const hindi = voices.find(v => v.lang === 'hi-IN');
            if (hindi) u.voice = hindi;
            window.speechSynthesis.speak(u);
        } catch { }

        // Start listening for "bolne" or similar
        startChoiceListening();
    }, []);

    const startChoiceListening = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        try { recognitionRef.current?.abort(); } catch { }

        const r = new SR();
        r.lang = 'hi-IN';
        r.continuous = false;
        r.interimResults = false;

        r.onresult = (e) => {
            const text = e.results[0][0].transcript.toLowerCase();
            const voiceWords = ['bolne', 'bolna', 'bolo', 'voice', 'bol', 'बोलने', 'बोलना',
                'haan', 'yes', 'ha', 'हाँ', 'आवाज', 'awaz', 'speak', 'sun'];
            if (voiceWords.some(w => text.includes(w))) {
                chooseVoice();
            } else {
                // Restart listening — maybe they said something else
                startChoiceListening();
            }
        };

        r.onend = () => {
            // If still choosing, keep listening
            if (!isWaking) setTimeout(() => startChoiceListening(), 500);
        };
        r.onerror = () => {
            if (!isWaking) setTimeout(() => startChoiceListening(), 1500);
        };

        recognitionRef.current = r;
        try { r.start(); } catch { }
    }, [isWaking]);

    const chooseVoice = useCallback(() => {
        setIsWaking(true);
        window.speechSynthesis?.cancel();
        try { recognitionRef.current?.abort(); } catch { }

        // Quick confirmation
        try {
            const u = new SpeechSynthesisUtterance('बहुत अच्छा! चलिए शुरू करते हैं।');
            u.lang = 'hi-IN';
            u.rate = 1.1;
            window.speechSynthesis.speak(u);
        } catch { }

        setTimeout(() => onStart?.(true), 800); // true = voiceMode
    }, [onStart]);

    const chooseTouch = useCallback(() => {
        setIsWaking(true);
        window.speechSynthesis?.cancel();
        try { recognitionRef.current?.abort(); } catch { }
        setTimeout(() => onStart?.(false), 300); // false = touchMode
    }, [onStart]);

    // Cleanup
    useEffect(() => {
        return () => {
            try { recognitionRef.current?.abort(); } catch { }
            window.speechSynthesis?.cancel();
        };
    }, []);

    const ad = GOV_ADS[currentSlide];

    return (
        <div
            className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${isWaking ? 'opacity-0' : 'opacity-100'}`}
            style={{ background: ad.gradient, transition: 'background 1.5s ease', pointerEvents: isWaking ? 'none' : 'auto' }}
            onClick={handleScreenTap}
            role="button"
            aria-label="Touch to start"
        >
            {/* Background Video */}
            {ad.video && (
                <video key={ad.video} src={ad.video} autoPlay muted loop playsInline
                    onLoadedData={() => setVideoLoaded(true)}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
                    style={{ opacity: videoLoaded ? 0.3 : 0 }} />
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 pointer-events-none"
                style={{ background: `${ad.gradient}, linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)`, opacity: 0.85 }} />

            {/* Decorative circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ background: 'white' }} />
                <div className="absolute -bottom-48 -left-24 w-[500px] h-[500px] rounded-full opacity-5" style={{ background: 'white' }} />
            </div>

            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-white text-xl font-black">S</span>
                    </div>
                    <div>
                        <p className="text-white/90 font-bold text-lg leading-tight">SUVIDHA Setu</p>
                        <p className="text-white/50 text-xs font-medium">Smart Civic Kiosk</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="proto-badge">🔧 Prototype</span>
                    <div className="text-white/60 text-sm font-mono">
                        {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            {/* Government Ad Label */}
            <div className="absolute top-20 left-0 right-0 z-10 flex justify-center">
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5">
                    <span className="text-xs">🇮🇳</span>
                    <p className="text-white/60 text-xs font-semibold">{ad.source}</p>
                    <span className="text-white/30 text-xs">• Gov. Advertisement</span>
                </div>
            </div>

            {/* Center Content */}
            <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-2xl">
                {/* Ad content */}
                {!choosing && (
                    <div key={currentSlide} className="mb-12 fast-fade-in">
                        <h2 className="text-5xl md:text-6xl font-black text-white mb-4 leading-tight drop-shadow-lg">{ad.title}</h2>
                        <p className="text-xl text-white/70 font-medium drop-shadow">{ad.subtitle}</p>
                    </div>
                )}

                {/* ── CHOICE MODE ──────────────────────── */}
                {choosing ? (
                    <div className="fast-fade-in flex flex-col items-center gap-6" onClick={(e) => e.stopPropagation()}>
                        {/* Greeting text */}
                        <div className="mb-2">
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
                                स्वागत है! 🙏
                            </h2>
                            <p className="text-lg text-white/70 font-medium">
                                आप कैसे काम करना चाहेंगे?
                            </p>
                        </div>

                        {/* Two big choice buttons */}
                        <div className="flex gap-5">
                            {/* Voice choice */}
                            <button
                                onClick={chooseVoice}
                                className="w-44 h-44 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-indigo-500/40 hover:border-indigo-400 hover:scale-105 active:scale-95 transition-all"
                                style={{ background: 'linear-gradient(160deg, rgba(99,102,241,0.25), rgba(99,102,241,0.1))' }}
                            >
                                <span className="text-5xl">🎙️</span>
                                <div>
                                    <p className="text-white font-bold text-lg">बोलकर</p>
                                    <p className="text-white/50 text-xs">Voice</p>
                                </div>
                                <div className="flex items-center gap-0.5 h-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="voice-bar-sm" style={{ animationDelay: `${i * 0.12}s`, background: 'rgba(165,180,252,0.7)' }} />
                                    ))}
                                </div>
                            </button>

                            {/* Touch choice */}
                            <button
                                onClick={chooseTouch}
                                className="w-44 h-44 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-emerald-500/40 hover:border-emerald-400 hover:scale-105 active:scale-95 transition-all"
                                style={{ background: 'linear-gradient(160deg, rgba(16,185,129,0.25), rgba(16,185,129,0.1))' }}
                            >
                                <span className="text-5xl">👆</span>
                                <div>
                                    <p className="text-white font-bold text-lg">छूकर</p>
                                    <p className="text-white/50 text-xs">Touch</p>
                                </div>
                            </button>
                        </div>

                        <p className="text-white/40 text-sm mt-2">
                            बोलें <span className="text-white font-bold">"बोलकर"</span> या नीचे टच करें
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Touch to start (before choosing) */}
                        <div className="idle-pulse rounded-full">
                            <button className="w-44 h-44 rounded-full bg-white/15 border-2 border-white/30 flex flex-col items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform cursor-pointer">
                                <span className="text-5xl mb-2">👆</span>
                                <p className="text-white font-bold text-sm leading-tight">Touch to Start</p>
                                <p className="text-white/60 font-medium text-xs">शुरू करें</p>
                            </button>
                        </div>

                        <div className="mt-8 flex items-center gap-3 bg-white/10 rounded-full px-5 py-2.5">
                            <div className="flex items-center gap-0.5 h-5">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="voice-bar-sm" style={{ animationDelay: `${i * 0.12}s`, background: 'rgba(255,255,255,0.5)' }} />
                                ))}
                            </div>
                            <p className="text-white/70 text-sm font-medium">
                                Or say <span className="text-white font-bold">"Hello"</span> / <span className="text-white font-bold">"Namaste"</span>
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                <div className="flex justify-center gap-2 mb-4">
                    {GOV_ADS.map((_, i) => (
                        <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); setVideoLoaded(false); }}
                            className="h-1.5 rounded-full transition-all duration-500 cursor-pointer border-0 p-0"
                            style={{ width: i === currentSlide ? '32px' : '8px', background: i === currentSlide ? 'white' : 'rgba(255,255,255,0.3)' }}
                            aria-label={`Slide ${i + 1}`} />
                    ))}
                </div>
                <div className="flex h-1 rounded-full overflow-hidden max-w-xl mx-auto">
                    <div className="flex-1" style={{ background: '#FF9933' }} />
                    <div className="flex-1" style={{ background: '#FFFFFF' }} />
                    <div className="flex-1" style={{ background: '#138808' }} />
                </div>
                <p className="text-center text-white/30 text-xs mt-3 font-medium">
                    C-DAC SUVIDHA 2026 — Empowering Citizens Through Technology
                </p>
            </div>
        </div>
    );
}
