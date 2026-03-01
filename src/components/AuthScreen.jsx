/**
 * ═══════════════════════════════════════════════════════════
 * AuthScreen - e-Pramaan Auth v3.0 (Zero Framer-Motion)
 * CSS animations for biometric scanning and transitions.
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { t } from '../utils/i18n';
import { useVoice } from './VoiceContext';

const MOCK_CITIZEN = {
    aadhaar: 'XXXX-XXXX-4829',
    name: 'Vivek Kumar',
    phone: '+91 98XXX XX890',
    otp: '482916',
    photo: null,
    address: 'H.No 234, Sector 5, Ludhiana, Punjab',
};

// Digit names for blind mode speaking
const DIGIT_NAMES_HI = {
    '0': 'zero', '1': 'ek', '2': 'do', '3': 'teen', '4': 'char',
    '5': 'paanch', '6': 'chhah', '7': 'saat', '8': 'aath', '9': 'nau',
};

function speakDigit(digit, lang) {
    const name = lang === 'en' ? digit : (DIGIT_NAMES_HI[digit] || digit);
    const u = new SpeechSynthesisUtterance(name);
    u.lang = lang === 'en' ? 'en-IN' : 'hi-IN';
    u.rate = 1.3;
    u.volume = 1;
    // Tell VoiceAgent to pause recognition during digit TTS
    window.dispatchEvent(new CustomEvent('va-digit-start'));
    u.onend = () => window.dispatchEvent(new CustomEvent('va-digit-end'));
    u.onerror = () => window.dispatchEvent(new CustomEvent('va-digit-end'));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
}

export default function AuthScreen({ lang, onAuthenticated, onBack }) {
    const { blindMode } = useVoice();
    const [authMode, setAuthMode] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [otpInput, setOtpInput] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [error, setError] = useState('');
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        if (!isScanning) return;
        const interval = setInterval(() => {
            setScanProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsScanning(false);
                    setAuthenticated(true);
                    setTimeout(() => onAuthenticated(MOCK_CITIZEN), 1200);
                    return 100;
                }
                return prev + 3;
            });
        }, 60);
        return () => clearInterval(interval);
    }, [isScanning, lang, onAuthenticated]);

    const startScan = (mode) => {
        setAuthMode(mode);
        setIsScanning(true);
        setScanProgress(0);
        setError('');
    };

    const sendOtp = () => {
        setAuthMode('otp');
        setOtpSent(true);
        setError('');
    };

    const verifyOtp = () => {
        if (otpInput === MOCK_CITIZEN.otp) {
            setAuthenticated(true);
            setTimeout(() => onAuthenticated(MOCK_CITIZEN), 1000);
        } else {
            setError(lang === 'hi' ? 'गलत OTP — नीचे सही OTP देखें' : 'Wrong OTP — see correct OTP below');
        }
    };

    return (
        <div className="min-h-[calc(100vh-160px)] flex flex-col items-center justify-center px-6 py-10 fast-slide-left">
            <div className="w-full max-w-lg">
                {/* Back button */}
                <button
                    onClick={onBack}
                    className="mb-6 flex items-center gap-2 text-white/60 hover:text-white text-sm font-semibold cursor-pointer bg-transparent border-0 hover:scale-[1.05] transition-transform"
                >
                    ← {t(lang, 'back')}
                </button>

                {/* Title */}
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black text-white mb-2">
                        🔐 {lang === 'hi' ? 'ई-प्रमाण सत्यापन' : lang === 'pa' ? 'ਈ-ਪ੍ਰਮਾਣ ਪ੍ਰਮਾਣਿਕਤਾ' : 'e-Pramaan Authentication'}
                    </h2>
                    <p className="text-white/50 text-sm">
                        {lang === 'hi' ? 'अपनी पहचान सत्यापित करें' : 'Verify your identity to access all services'}
                    </p>
                </div>

                {/* ── Mode Selection ────────────────────── */}
                {!authMode && !authenticated && (
                    <div className="space-y-4 fast-fade-in">
                        <button
                            onClick={() => startScan('thumb')}
                            className="w-full glass-card rounded-2xl p-6 flex items-center gap-5 cursor-pointer border-2 border-transparent hover:border-indigo-500/30 hover:scale-[1.02] transition-transform text-left"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center text-3xl">👆</div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{lang === 'hi' ? 'अंगूठा स्कैन' : 'Thumbprint Scan'}</h3>
                                <p className="text-white/40 text-sm">{lang === 'hi' ? 'स्कैनर पर अंगूठा रखें' : 'Place thumb on biometric scanner'}</p>
                            </div>
                        </button>

                        <button
                            onClick={() => startScan('face')}
                            className="w-full glass-card rounded-2xl p-6 flex items-center gap-5 cursor-pointer border-2 border-transparent hover:border-indigo-500/30 hover:scale-[1.02] transition-transform text-left"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-green-600/20 flex items-center justify-center text-3xl">📸</div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{lang === 'hi' ? 'चेहरा पहचान' : 'Face Recognition'}</h3>
                                <p className="text-white/40 text-sm">{lang === 'hi' ? 'कैमरे की ओर देखें' : 'Look at the camera'}</p>
                            </div>
                        </button>

                        <button
                            onClick={sendOtp}
                            className="w-full glass-card rounded-2xl p-6 flex items-center gap-5 cursor-pointer border-2 border-transparent hover:border-amber-500/30 hover:scale-[1.02] transition-transform text-left"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-amber-600/20 flex items-center justify-center text-3xl">📱</div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{lang === 'hi' ? 'OTP से लॉगिन' : 'Use OTP'}</h3>
                                <p className="text-white/40 text-sm">{lang === 'hi' ? 'फ़ोन पर OTP प्राप्त करें' : 'Receive OTP on registered mobile'}</p>
                            </div>
                        </button>

                        {/* Proto info */}
                        <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <p className="text-amber-400 text-xs font-bold mb-2">🔧 PROTOTYPE — Demo Credentials:</p>
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                <span className="text-white/40">Aadhaar:</span> <span className="text-amber-300">{MOCK_CITIZEN.aadhaar}</span>
                                <span className="text-white/40">Name:</span>    <span className="text-amber-300">{MOCK_CITIZEN.name}</span>
                                <span className="text-white/40">Phone:</span>   <span className="text-amber-300">{MOCK_CITIZEN.phone}</span>
                                <span className="text-white/40">OTP Code:</span><span className="text-amber-300 text-base font-black">{MOCK_CITIZEN.otp}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Biometric Scanning ────────────────── */}
                {(authMode === 'thumb' || authMode === 'face') && isScanning && (
                    <div className="flex flex-col items-center gap-6 fast-fade-in">
                        <div className="relative w-48 h-48">
                            <div className="absolute inset-0 rounded-full bg-indigo-600/10 border-2 border-indigo-500/30 flex items-center justify-center">
                                <span className="text-7xl">{authMode === 'thumb' ? '👆' : '📸'}</span>
                            </div>
                            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                                <circle
                                    cx="50" cy="50" r="46"
                                    fill="none" stroke="#6366F1" strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={`${scanProgress * 2.89} 289`}
                                    className="transition-all duration-100"
                                />
                            </svg>
                        </div>
                        <p className="text-white text-lg font-semibold">
                            {authMode === 'thumb'
                                ? (lang === 'hi' ? 'अंगूठा स्कैन हो रहा है...' : 'Scanning thumbprint...')
                                : (lang === 'hi' ? 'चेहरा स्कैन हो रहा है...' : 'Scanning face...')}
                        </p>
                        <p className="text-indigo-400 font-mono text-2xl font-bold">{scanProgress}%</p>
                    </div>
                )}

                {/* ── OTP Input ─────────────────────────── */}
                {authMode === 'otp' && otpSent && !authenticated && (
                    <div className="flex flex-col items-center gap-5 fast-fade-in">
                        <div className="glass-card rounded-2xl p-6 w-full max-w-sm text-center">
                            <p className="text-white/60 text-sm mb-1">{lang === 'hi' ? 'OTP भेजा गया' : 'OTP sent to'}</p>
                            <p className="text-white font-bold mb-4">{MOCK_CITIZEN.phone}</p>

                            <input
                                type="text"
                                maxLength={6}
                                value={otpInput}
                                onChange={(e) => {
                                    const newVal = e.target.value.replace(/\D/g, '');
                                    // Speak the last digit typed in blind mode
                                    if (blindMode && newVal.length > otpInput.length) {
                                        const lastDigit = newVal[newVal.length - 1];
                                        speakDigit(lastDigit, lang);
                                    }
                                    setOtpInput(newVal);
                                }}
                                placeholder="● ● ● ● ● ●"
                                className="w-full p-4 rounded-xl bg-white/5 border-2 border-white/10 text-center text-3xl font-mono text-white tracking-[0.5em] focus:border-indigo-500 focus:outline-none"
                                aria-label="Enter OTP"
                                autoFocus
                            />


                            {error && <p className="text-red-400 text-sm mt-3 font-semibold">{error}</p>}

                            <button
                                onClick={verifyOtp}
                                disabled={otpInput.length < 6}
                                className="w-full mt-4 py-4 rounded-xl gradient-primary text-white font-bold text-lg cursor-pointer disabled:opacity-40 border-0"
                            >
                                {lang === 'hi' ? 'सत्यापित करें' : 'Verify OTP'}
                            </button>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                            <p className="text-amber-400 text-xs font-bold">🔧 PROTOTYPE — Use OTP: <span className="text-lg font-black">{MOCK_CITIZEN.otp}</span></p>
                        </div>

                        <button
                            onClick={() => { setAuthMode(null); setOtpSent(false); setOtpInput(''); setError(''); }}
                            className="text-white/40 hover:text-white text-sm cursor-pointer bg-transparent border-0"
                        >
                            ← {lang === 'hi' ? 'वापस जाएँ' : 'Back to options'}
                        </button>
                    </div>
                )}

                {/* ── Authenticated ─────────────────────── */}
                {authenticated && (
                    <div className="flex flex-col items-center gap-4 fast-scale-in">
                        <div className="w-24 h-24 rounded-full gradient-success flex items-center justify-center shadow-2xl">
                            <span className="text-white text-5xl">✓</span>
                        </div>
                        <h3 className="text-2xl font-bold text-green-400">
                            {lang === 'hi' ? 'सत्यापन सफल!' : 'Verified!'}
                        </h3>
                        <p className="text-white/50">{lang === 'hi' ? 'डैशबोर्ड पर ले जा रहे हैं...' : 'Redirecting to your dashboard...'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
