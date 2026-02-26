/**
 * ═══════════════════════════════════════════════════════════
 * GatewayScreen — Language + Path Selection (Performance v2.1)
 *
 * ★ Location: detects region → shows prompt if denied/failed
 * ★ Lightweight: CSS transitions, no heavy motion wrappers
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
    ALL_LANGUAGES,
    detectRegion,
    searchLanguages,
    detectSpokenLanguage,
    getLang,
} from '../utils/regionalLanguages';
import { useVoice } from './VoiceContext';

/** Individual language button (memoized to avoid re-renders) */
const LangButton = memo(function LangButton({ lang, isSelected, onSelect }) {
    return (
        <button
            onClick={() => onSelect(lang.code)}
            className={`p-3 rounded-xl cursor-pointer border transition-all text-center ${isSelected
                ? 'bg-indigo-500/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                : 'bg-white/4 border-white/8 hover:bg-white/8 hover:border-white/15'
                }`}
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

export default function GatewayScreen({ lang, setLang, onSelectPath }) {
    const [detectedState, setDetectedState] = useState(null);
    const [locationReason, setLocationReason] = useState(null); // success|denied|unavailable|timeout|fallback
    const [regionLangs, setRegionLangs] = useState([]);
    const [showAll, setShowAll] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDetecting, setIsDetecting] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const [voiceHint, setVoiceHint] = useState('');
    const [selectedLang, setSelectedLang] = useState(lang);
    const recognitionRef = useRef(null);
    const langDetectorRef = useRef(null);
    const { isActive: voiceActive, activate: activateVoice, deactivate: deactivateVoice, status: voiceStatus } = useVoice();

    /** Detect region on mount */
    const doDetect = useCallback(() => {
        setIsDetecting(true);
        setLocationReason(null);
        detectRegion().then(({ state, languages, reason }) => {
            setDetectedState(state);
            setRegionLangs(languages);
            setLocationReason(reason);
            setIsDetecting(false);
        });
    }, []);

    useEffect(() => {
        doDetect();
        langDetectorRef.current = detectSpokenLanguage();
    }, [doDetect]);

    /** Select a language */
    const handleSelectLang = useCallback((code) => {
        setSelectedLang(code);
        setLang(code);
        // Light greeting — no heavy speech synthesis blocking
        try {
            const greetings = {
                en: 'Language set to English.',
                hi: 'भाषा हिन्दी में बदल दी गई।',
                pa: 'ਭਾਸ਼ਾ ਪੰਜਾਬੀ ਵਿੱਚ ਬਦਲ ਦਿੱਤੀ ਗਈ।',
                bn: 'ভাষা বাংলায় পরিবর্তন করা হয়েছে।',
                ta: 'மொழி தமிழாக மாற்றப்பட்டது.',
                te: 'భాష తెలుగులోకి మార్చబడింది.',
                kn: 'ಭಾಷೆ ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ.',
                mr: 'भाषा मराठी मध्ये बदलली.',
            };
            const u = new SpeechSynthesisUtterance(greetings[code] || greetings.en);
            u.lang = getLang(code).speechCode;
            u.rate = 1;
            speechSynthesis.speak(u);
        } catch { }
    }, [setLang]);

    /** Voice auto-detect */
    const startVoiceDetect = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { setVoiceHint('Speech not supported'); return; }
        if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { } }

        setIsListening(true);
        setVoiceHint('Speak naturally in your language...');

        const r = new SR();
        r.lang = 'hi-IN';
        r.continuous = false;
        r.interimResults = false;

        r.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            setVoiceHint(`"${transcript}"`);
            const detected = langDetectorRef.current?.guessFromTranscript(transcript);
            if (detected) {
                handleSelectLang(detected);
                setVoiceHint(`Detected: ${getLang(detected).name} (${getLang(detected).native})`);
            } else {
                setVoiceHint(`Heard: "${transcript}" — try more words`);
            }
            setIsListening(false);
        };
        r.onerror = () => { setIsListening(false); setVoiceHint('Try again.'); };
        r.onend = () => setIsListening(false);
        r.start();
        recognitionRef.current = r;
    }, [handleSelectLang]);

    useEffect(() => {
        return () => { try { recognitionRef.current?.stop(); } catch { } };
    }, []);

    const searchResults = searchQuery.trim() ? searchLanguages(searchQuery) : null;
    const displayLangs = searchResults || (showAll ? ALL_LANGUAGES : regionLangs);

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto fast-fade-in"
            style={{ background: 'linear-gradient(160deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)' }}
        >
            <div className="min-h-screen flex flex-col items-center justify-start px-4 py-6 max-w-2xl mx-auto">

                {/* Header */}
                <div className="text-center mb-5 w-full">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                            <span className="text-white text-lg font-black">S</span>
                        </div>
                        <h1 className="text-2xl font-black text-white">SUVIDHA Setu</h1>
                        <span className="proto-badge">Prototype</span>
                    </div>
                    <div className="flex h-1 rounded-full overflow-hidden max-w-xs mx-auto mb-4">
                        <div className="flex-1" style={{ background: '#FF9933' }} />
                        <div className="flex-1" style={{ background: '#FFFFFF' }} />
                        <div className="flex-1" style={{ background: '#138808' }} />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-1">Choose Your Language</h2>
                    <p className="text-white/40 font-medium text-sm">अपनी भाषा चुनें • ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ</p>
                </div>

                {/* ── Location Status ────────────────────── */}
                <div className="w-full mb-3">
                    {isDetecting ? (
                        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse" />
                            <span className="text-white/50 text-sm">Detecting your region...</span>
                        </div>
                    ) : locationReason === 'success' ? (
                        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-green-500/10 border border-green-500/20">
                            <span className="text-green-400 text-sm">📍 Region: <strong>{detectedState}</strong> — showing regional languages</span>
                        </div>
                    ) : locationReason === 'denied' ? (
                        <div className="flex items-center justify-between gap-2 py-2 px-4 rounded-xl bg-red-500/10 border border-red-500/20">
                            <div className="flex items-center gap-2">
                                <span className="text-red-400 text-sm">🚫</span>
                                <span className="text-red-400 text-sm font-semibold">Location access denied</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={doDetect}
                                    className="px-3 py-1 text-xs font-bold text-white bg-white/10 rounded-lg cursor-pointer border border-white/15 hover:bg-white/20"
                                >
                                    🔄 Retry
                                </button>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-3 py-1 text-xs font-bold text-white bg-indigo-500/30 rounded-lg cursor-pointer border border-indigo-500/30 hover:bg-indigo-500/50"
                                >
                                    ↻ Refresh Page
                                </button>
                            </div>
                        </div>
                    ) : locationReason === 'timeout' ? (
                        <div className="flex items-center justify-between gap-2 py-2 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <span className="text-amber-400 text-sm font-semibold">⏱️ Location timed out</span>
                            <button
                                onClick={doDetect}
                                className="px-3 py-1 text-xs font-bold text-white bg-amber-500/20 rounded-lg cursor-pointer border border-amber-500/30 hover:bg-amber-500/40"
                            >
                                🔄 Retry
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-2 py-2 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <span className="text-amber-400 text-sm font-semibold">📍 Location not available — showing common languages</span>
                            <button
                                onClick={doDetect}
                                className="px-3 py-1 text-xs font-bold text-white bg-amber-500/20 rounded-lg cursor-pointer border border-amber-500/30 hover:bg-amber-500/40"
                            >
                                🔄 Retry
                            </button>
                        </div>
                    )}
                    {locationReason === 'denied' && (
                        <p className="text-white/25 text-xs mt-2 text-center">
                            💡 To enable: click the 🔒 icon in your browser's address bar → allow Location → then click Refresh
                        </p>
                    )}
                </div>

                <div className="w-full mb-3">
                    <button
                        onClick={() => { voiceActive ? deactivateVoice() : activateVoice(); }}
                        className={`w-full py-3 rounded-xl border flex items-center justify-center gap-3 cursor-pointer transition-colors ${voiceActive
                            ? 'bg-red-500/15 border-red-500/30 text-red-400'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        {voiceActive ? (
                            <div className="flex items-center gap-1 h-5">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.08}s`, background: '#EF4444', width: '3px' }} />
                                ))}
                            </div>
                        ) : (
                            <span className="text-xl">🎙️</span>
                        )}
                        <div className="text-left">
                            <p className="font-bold text-sm">{voiceActive ? (lang === 'hi' ? 'एजेंट सक्रिय — बोलिए' : 'Agent Active — Speak') : 'Just Speak / बोलिए'}</p>
                            <p className="text-xs opacity-60">{voiceActive ? (lang === 'hi' ? 'बंद करने के लिए दबाएं' : 'Tap to stop') : (lang === 'hi' ? 'आवाज़ से पूरा काम करें' : 'Complete everything by voice')}</p>
                        </div>
                    </button>
                    {voiceHint && (
                        <p className="text-center text-sm mt-1 font-medium" style={{ color: voiceHint.startsWith('Detected') ? '#34D399' : 'rgba(255,255,255,0.4)' }}>
                            {voiceHint}
                        </p>
                    )}
                </div>

                {/* ── Search ─────────────────────────────── */}
                <div className="w-full mb-2">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-indigo-500 transition-colors">
                        <span className="text-white/30">🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search language... (Tamil, বাংলা, ગુજરાતી)"
                            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="text-white/30 hover:text-white cursor-pointer bg-transparent border-0">✕</button>
                        )}
                    </div>
                </div>

                {/* ── Toggle ─────────────────────────────── */}
                {!searchResults && (
                    <div className="w-full flex items-center justify-between mb-2">
                        <p className="text-white/30 text-xs font-semibold uppercase tracking-wider">
                            {showAll ? `All (${ALL_LANGUAGES.length})` : `Regional${detectedState ? ` — ${detectedState}` : ''}`}
                        </p>
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className="text-indigo-400 text-xs font-bold cursor-pointer bg-transparent border-0 hover:text-indigo-300"
                        >
                            {showAll ? '← Regional' : `All ${ALL_LANGUAGES.length} →`}
                        </button>
                    </div>
                )}

                {/* ── Language Grid ──────────────────────── */}
                <div className={`w-full grid gap-2 mb-5 ${displayLangs.length > 6 ? 'grid-cols-3 md:grid-cols-4' : 'grid-cols-3'}`}>
                    {displayLangs.map((l) => (
                        <LangButton key={l.code} lang={l} isSelected={selectedLang === l.code} onSelect={handleSelectLang} />
                    ))}
                </div>

                {displayLangs.length === 0 && (
                    <div className="text-center py-6">
                        <p className="text-white/30">No languages found for "{searchQuery}"</p>
                        <button onClick={() => setSearchQuery('')} className="text-indigo-400 text-sm mt-2 cursor-pointer bg-transparent border-0">Clear</button>
                    </div>
                )}

                {/* ── Path Selector ──────────────────────── */}
                <div className="w-full flex items-center gap-4 my-2 mb-4">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-white/20 text-sm font-bold">SELECT YOUR PATH</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={() => onSelectPath('guest')}
                        className="relative overflow-hidden rounded-2xl p-5 cursor-pointer border-2 border-blue-500/30 text-left group hover:border-blue-500/50 transition-colors"
                        style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.08))' }}
                    >
                        <span className="text-4xl mb-2 block">⚡</span>
                        <h3 className="text-xl font-bold text-blue-400 mb-1">Quick Pay (Guest)</h3>
                        <p className="text-white/40 text-sm">{selectedLang === 'hi' ? 'बिना लॉगिन के बिल भुगतान' : 'Pay bills without login'}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span className="text-blue-400/60 text-xs">No login required</span>
                        </div>
                    </button>

                    <button
                        onClick={() => onSelectPath('citizen')}
                        className="relative overflow-hidden rounded-2xl p-5 cursor-pointer border-2 border-green-500/30 text-left group hover:border-green-500/50 transition-colors"
                        style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.15), rgba(16,185,129,0.08))' }}
                    >
                        <span className="text-4xl mb-2 block">🏛️</span>
                        <h3 className="text-xl font-bold text-green-400 mb-1">Citizen Login</h3>
                        <p className="text-white/40 text-sm">{selectedLang === 'hi' ? 'अपने खाते में लॉगिन करें' : 'Login with e-Pramaan / Aadhaar'}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            <span className="text-green-400/60 text-xs">Full dashboard access</span>
                        </div>
                    </button>
                </div>

                <div className="text-center pb-4">
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
