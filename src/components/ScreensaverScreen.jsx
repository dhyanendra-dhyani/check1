/**
 * ═══════════════════════════════════════════════════════════
 * ScreensaverScreen v2 — Full-Screen Government Ads Kiosk
 *
 * Matches reference design: full-screen gradient backgrounds,
 * big bold titles, circular Touch to Start, rotating every 3-4s.
 * 5 ads with distinct color palettes.
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const GOV_ADS = [
    {
        title: 'Digital India',
        badge: 'IN',
        ministry: 'Government of India — Ministry of Electronics & IT',
        tagline: 'Gov. Advertisement',
        subtitle: 'Connecting 1.4 billion citizens to government services',
        bg: 'linear-gradient(135deg, #3B4CC0 0%, #5B6FE8 40%, #8B9FF7 100%)',
        accent: '#A5B4FC',
        circle: 'rgba(255,255,255,0.08)',
        circleBorder: 'rgba(255,255,255,0.15)',
    },
    {
        title: 'Jal Jeevan Mission',
        badge: '💧',
        ministry: 'Ministry of Jal Shakti — Har Ghar Jal',
        tagline: 'Clean Water for All',
        subtitle: 'Ensuring clean drinking water to every rural household by 2026',
        bg: 'linear-gradient(135deg, #0C4A6E 0%, #075985 40%, #0284C7 100%)',
        accent: '#7DD3FC',
        circle: 'rgba(255,255,255,0.08)',
        circleBorder: 'rgba(125,211,252,0.25)',
    },
    {
        title: 'PM Ujjwala Yojana',
        badge: '🔥',
        ministry: 'Ministry of Petroleum & Natural Gas',
        tagline: 'Swachh Indhan, Behtar Jeevan',
        subtitle: 'Free LPG connections empowering 10 crore women across India',
        bg: 'linear-gradient(135deg, #9A3412 0%, #C2410C 40%, #EA580C 100%)',
        accent: '#FDBA74',
        circle: 'rgba(255,255,255,0.08)',
        circleBorder: 'rgba(253,186,116,0.25)',
    },
    {
        title: 'Saubhagya Yojana',
        badge: '⚡',
        ministry: 'Ministry of Power — Electricity for All',
        tagline: 'Universal Electrification',
        subtitle: 'Affordable electricity connections reaching the last mile',
        bg: 'linear-gradient(135deg, #713F12 0%, #A16207 40%, #CA8A04 100%)',
        accent: '#FDE68A',
        circle: 'rgba(255,255,255,0.08)',
        circleBorder: 'rgba(253,230,138,0.25)',
    },
    {
        title: 'Swachh Bharat',
        badge: '🌿',
        ministry: 'Ministry of Housing & Urban Affairs',
        tagline: 'Clean India Mission',
        subtitle: 'Building a cleaner, greener India — one step at a time',
        bg: 'linear-gradient(135deg, #14532D 0%, #166534 40%, #15803D 100%)',
        accent: '#86EFAC',
        circle: 'rgba(255,255,255,0.08)',
        circleBorder: 'rgba(134,239,172,0.25)',
    },
];

export default function ScreensaverScreen({ onWake }) {
    const [currentAd, setCurrentAd] = useState(0);
    const [fade, setFade] = useState(true);
    const [time, setTime] = useState('');
    const isWaking = useRef(false);

    // Clock
    useEffect(() => {
        const update = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
        };
        update();
        const t = setInterval(update, 30000);
        return () => clearInterval(t);
    }, []);

    // Rotate ads every 3.5s
    useEffect(() => {
        const interval = setInterval(() => {
            setFade(false);
            setTimeout(() => {
                setCurrentAd(p => (p + 1) % GOV_ADS.length);
                setFade(true);
            }, 500);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    const handleWake = useCallback(() => {
        if (isWaking.current) return;
        isWaking.current = true;
        onWake?.();
    }, [onWake]);

    const ad = GOV_ADS[currentAd];

    return (
        <div
            className="fixed inset-0 z-[100] cursor-pointer select-none"
            style={{
                background: ad.bg,
                transition: 'background 0.8s ease-in-out',
            }}
            onClick={handleWake}
            onTouchStart={handleWake}
        >
            {/* Decorative circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute rounded-full"
                    style={{ width: '600px', height: '600px', top: '-100px', left: '-150px', background: 'rgba(255,255,255,0.04)' }} />
                <div className="absolute rounded-full"
                    style={{ width: '500px', height: '500px', bottom: '-120px', right: '-100px', background: 'rgba(255,255,255,0.03)' }} />
                <div className="absolute rounded-full"
                    style={{ width: '300px', height: '300px', top: '20%', right: '10%', background: 'rgba(255,255,255,0.02)' }} />
            </div>

            <div className="relative z-10 min-h-screen flex flex-col px-6 py-5">

                {/* ═══ HEADER BAR ═══ */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(255,255,255,0.15)' }}>
                            <span className="text-white text-lg font-black">S</span>
                        </div>
                        <div>
                            <h1 className="text-white font-black text-base leading-tight">SUVIDHA Setu</h1>
                            <p className="text-white/50 text-xs font-medium">Smart Civic Kiosk</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-lg text-xs font-bold"
                            style={{ background: 'rgba(255,255,255,0.15)', color: '#FDE68A' }}>
                            🔧 PROTOTYPE
                        </span>
                        <span className="text-white/60 text-sm font-mono">{time}</span>
                    </div>
                </div>

                {/* ═══ MAIN CONTENT ═══ */}
                <div className="flex-1 flex flex-col items-center justify-center -mt-8">

                    {/* Ministry badge */}
                    <div className={`transition-all duration-500 ${fade ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                            <span className="text-white/80 text-xs font-semibold">{ad.badge}</span>
                            <span className="text-white/70 text-xs">{ad.ministry}</span>
                            <span className="text-white/30 text-xs">•</span>
                            <span className="text-white/40 text-xs italic">{ad.tagline}</span>
                        </div>
                    </div>

                    {/* Big Title */}
                    <div className={`text-center mb-4 transition-all duration-500 ${fade ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                        <h2 className="text-white font-black leading-none mb-4"
                            style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', letterSpacing: '-0.02em' }}>
                            {ad.title} <span style={{ color: ad.accent, opacity: 0.8 }}>{ad.badge}</span>
                        </h2>
                        <p className="text-white/60 text-lg md:text-xl font-medium max-w-xl mx-auto">
                            {ad.subtitle}
                        </p>
                    </div>

                    {/* Touch to Start Circle */}
                    <div className="my-10">
                        <div className="relative">
                            {/* Outer pulse ring */}
                            <div className="absolute inset-0 rounded-full"
                                style={{
                                    width: '180px', height: '180px',
                                    border: `2px solid ${ad.circleBorder}`,
                                    animation: 'pulse 2.5s ease-in-out infinite',
                                }} />
                            {/* Main circle */}
                            <div className="w-[180px] h-[180px] rounded-full flex flex-col items-center justify-center"
                                style={{
                                    background: ad.circle,
                                    border: `2px solid ${ad.circleBorder}`,
                                    backdropFilter: 'blur(10px)',
                                }}>
                                <span className="text-4xl mb-2">👆</span>
                                <p className="text-white font-bold text-base">Touch to Start</p>
                                <p className="text-white/50 text-xs">शुरू करें</p>
                            </div>
                        </div>
                    </div>

                    {/* Voice hint */}
                    <div className="flex items-center gap-3 px-5 py-2.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="flex items-center gap-0.5 h-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="voice-bar-sm"
                                    style={{ animationDelay: `${i * 0.12}s`, background: 'rgba(255,255,255,0.5)' }} />
                            ))}
                        </div>
                        <span className="text-white/70 text-sm">
                            Or say <strong className="text-white">"Hello"</strong> / <strong className="text-white">"Namaste"</strong>
                        </span>
                    </div>
                </div>

                {/* ═══ BOTTOM ═══ */}
                <div className="text-center pb-2">
                    {/* Dot indicators */}
                    <div className="flex justify-center gap-2 mb-4">
                        {GOV_ADS.map((_, i) => (
                            <div
                                key={i}
                                className="rounded-full transition-all duration-400"
                                style={{
                                    width: i === currentAd ? '28px' : '8px',
                                    height: '8px',
                                    background: i === currentAd ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
                                }}
                            />
                        ))}
                    </div>

                    {/* Tricolor */}
                    <div className="flex h-1 rounded-full overflow-hidden w-64 mx-auto mb-3">
                        <div className="flex-1" style={{ background: '#FF9933' }} />
                        <div className="flex-1" style={{ background: '#FFFFFF' }} />
                        <div className="flex-1" style={{ background: '#138808' }} />
                    </div>

                    <p className="text-white/25 text-xs">C-DAC SUVIDHA 2026 — Empowering Citizens Through Technology</p>
                </div>
            </div>
        </div>
    );
}
