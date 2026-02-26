/**
 * ═══════════════════════════════════════════════════════════
 * IdleScreen - The "Attraction" Loop v3.0 (Zero Framer-Motion)
 * Uses CSS transitions for carousel and interactions.
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef } from 'react';

/** Government ad slides with public video URLs */
const GOV_ADS = [
    {
        title: 'Jal Jeevan Mission 💧',
        subtitle: 'Har Ghar Nal Se Jal — Clean water for every household',
        source: 'Government of India — Ministry of Jal Shakti',
        gradient: 'linear-gradient(160deg, #064E3B, #065F46, #0D9488)',
        video: 'https://cdn.pixabay.com/video/2020/05/25/39831-423375657_large.mp4',
    },
    {
        title: 'Digital India 🇮🇳',
        subtitle: 'Connecting 1.4 billion citizens to government services',
        source: 'Government of India — Ministry of Electronics & IT',
        gradient: 'linear-gradient(160deg, #1E3A5F, #1E40AF, #6366F1)',
        video: 'https://cdn.pixabay.com/video/2021/04/04/69623-534500128_large.mp4',
    },
    {
        title: 'Swachh Bharat Abhiyan 🌿',
        subtitle: 'Clean India, Green India — A movement by every citizen',
        source: 'Government of India — Ministry of Housing & Urban Affairs',
        gradient: 'linear-gradient(160deg, #14532D, #15803D, #22C55E)',
        video: 'https://cdn.pixabay.com/video/2019/11/08/28697-372261598_large.mp4',
    },
    {
        title: 'Ayushman Bharat Yojana 🏥',
        subtitle: 'Free healthcare for 50 crore citizens — PM-JAY',
        source: 'Government of India — National Health Authority',
        gradient: 'linear-gradient(160deg, #4C1D95, #6D28D9, #8B5CF6)',
        video: null,
    },
    {
        title: 'PM-KISAN Samman Nidhi 🌾',
        subtitle: '₹6,000/year direct income support for farmers',
        source: 'Government of India — Ministry of Agriculture',
        gradient: 'linear-gradient(160deg, #78350F, #92400E, #D97706)',
        video: null,
    },
];

export default function IdleScreen({ onStart }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isWaking, setIsWaking] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const recognitionRef = useRef(null);
    const videoRef = useRef(null);

    /** Auto-rotate slides */
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % GOV_ADS.length);
            setVideoLoaded(false);
        }, 7000);
        return () => clearInterval(timer);
    }, []);

    /** Wake-word listener */
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const startListening = () => {
            try {
                const recognition = new SpeechRecognition();
                recognition.lang = 'hi-IN';
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript.toLowerCase();
                    if (['hello', 'namaste', 'start', 'shuru', 'hi', 'help', 'namaskar'].some(w => transcript.includes(w))) {
                        setIsWaking(true);
                        setTimeout(() => onStart?.(), 600);
                    }
                };
                recognition.onend = () => setTimeout(startListening, 1500);
                recognition.onerror = () => setTimeout(startListening, 3000);
                recognition.start();
                recognitionRef.current = recognition;
            } catch (e) { /* touch still works */ }
        };
        startListening();
        return () => { try { recognitionRef.current?.stop(); } catch { } };
    }, [onStart]);

    const ad = GOV_ADS[currentSlide];

    return (
        <div
            className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-opacity duration-500 ${isWaking ? 'opacity-0' : 'opacity-100'}`}
            style={{ background: ad.gradient, transition: 'background 1.5s ease', pointerEvents: isWaking ? 'none' : 'auto' }}
            onClick={() => { setIsWaking(true); setTimeout(() => onStart?.(), 300); }}
            role="button"
            aria-label="Touch to start"
        >
            {/* ── Background Video ─────────────────────── */}
            {ad.video && (
                <video
                    ref={videoRef}
                    key={ad.video}
                    src={ad.video}
                    autoPlay
                    muted
                    loop
                    playsInline
                    onLoadedData={() => setVideoLoaded(true)}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
                    style={{ opacity: videoLoaded ? 0.3 : 0 }}
                />
            )}

            {/* Gradient overlay on top of video */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: `${ad.gradient}, linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)`, opacity: 0.85 }}
            />

            {/* Decorative circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ background: 'white' }} />
                <div className="absolute -bottom-48 -left-24 w-[500px] h-[500px] rounded-full opacity-5" style={{ background: 'white' }} />
            </div>

            {/* ── Top Bar ──────────────────────────────── */}
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

            {/* ── Government Ad Label ──────────────────── */}
            <div className="absolute top-20 left-0 right-0 z-10 flex justify-center">
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5">
                    <span className="text-xs">🇮🇳</span>
                    <p className="text-white/60 text-xs font-semibold">{ad.source}</p>
                    <span className="text-white/30 text-xs">• Gov. Advertisement</span>
                </div>
            </div>

            {/* ── Center Content ───────────────────────── */}
            <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-2xl">
                {/* Ad content */}
                <div
                    key={currentSlide}
                    className="mb-12 fast-fade-in"
                >
                    <h2 className="text-5xl md:text-6xl font-black text-white mb-4 leading-tight drop-shadow-lg">
                        {ad.title}
                    </h2>
                    <p className="text-xl text-white/70 font-medium drop-shadow">
                        {ad.subtitle}
                    </p>
                </div>

                {/* Touch to start */}
                <div className="idle-pulse rounded-full" style={{ transform: 'scale(1)', transition: 'transform 0.2s' }}>
                    <button
                        className="w-44 h-44 rounded-full bg-white/15 border-2 border-white/30 flex flex-col items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                        style={{ backdropFilter: 'blur(0px)' }} /* Explicitly disabled blur */
                    >
                        <span className="text-5xl mb-2">👆</span>
                        <p className="text-white font-bold text-sm leading-tight">Touch to Start</p>
                        <p className="text-white/60 font-medium text-xs">शुरू करें</p>
                    </button>
                </div>

                {/* Voice hint */}
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
            </div>

            {/* ── Bottom ───────────────────────────────── */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                {/* Slide dots */}
                <div className="flex justify-center gap-2 mb-4">
                    {GOV_ADS.map((_, i) => (
                        <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); setVideoLoaded(false); }}
                            className="h-1.5 rounded-full transition-all duration-500 cursor-pointer border-0 p-0 hover:opacity-100"
                            style={{
                                width: i === currentSlide ? '32px' : '8px',
                                background: i === currentSlide ? 'white' : 'rgba(255,255,255,0.3)',
                            }}
                            aria-label={`Slide ${i + 1}`}
                        />
                    ))}
                </div>

                {/* Indian flag bar */}
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
