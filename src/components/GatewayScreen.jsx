/**
 * ═══════════════════════════════════════════════════════════
 * GatewayScreen v7 — Simplified Path Selection
 *
 * Language is already selected in IdleScreen.
 * This screen only shows: Guest (Quick Pay) vs Citizen Login.
 * Clean, fast, focused.
 * ═══════════════════════════════════════════════════════════
 */

import { memo } from 'react';
import { useVoice } from './VoiceContext';
import { getLang } from '../utils/regionalLanguages';

const LABELS = {
    en: { title: 'How would you like to proceed?', guestTitle: 'Quick Pay (Guest)', guestDesc: 'Pay bills without login', guestNote: 'No login required', citizenTitle: 'Citizen Login', citizenDesc: 'Login with e-Pramaan / Aadhaar', citizenNote: 'Full dashboard access' },
    hi: { title: 'आगे कैसे बढ़ना चाहेंगे?', guestTitle: 'Quick Pay (गेस्ट)', guestDesc: 'बिना लॉगिन के बिल भुगतान', guestNote: 'लॉगिन ज़रूरी नहीं', citizenTitle: 'नागरिक लॉगिन', citizenDesc: 'ई-प्रमाण / आधार से लॉगिन', citizenNote: 'पूरा डैशबोर्ड' },
    pa: { title: 'ਅੱਗੇ ਕਿਵੇਂ ਵਧਣਾ ਚਾਹੋਗੇ?', guestTitle: 'Quick Pay (ਗੈਸਟ)', guestDesc: 'ਬਿਨਾਂ ਲੌਗਇਨ ਬਿੱਲ ਭੁਗਤਾਨ', guestNote: 'ਲੌਗਇਨ ਲੋੜੀਂਦਾ ਨਹੀਂ', citizenTitle: 'ਨਾਗਰਿਕ ਲੌਗਇਨ', citizenDesc: 'ਆਧਾਰ ਨਾਲ ਲੌਗਇਨ', citizenNote: 'ਪੂਰਾ ਡੈਸ਼ਬੋਰਡ' },
};

const getLabels = (lang) => LABELS[lang] || LABELS.en;

export default memo(function GatewayScreen({ lang, setLang, onSelectPath }) {
    const { voiceMode, isActive, blindMode, setBlindMode } = useVoice();
    const l = getLabels(lang);

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto fast-fade-in"
            style={{ background: 'linear-gradient(160deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)' }}>

            {/* Blind Mode Toggle — top-right corner */}
            <button
                onClick={() => setBlindMode(!blindMode)}
                aria-label={blindMode ? 'Disable accessibility mode' : 'Enable accessibility mode'}
                className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all duration-300 active:scale-95"
                style={{
                    background: blindMode
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.2))'
                        : 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(79,70,229,0.1))',
                    borderColor: blindMode ? 'rgba(16,185,129,0.6)' : 'rgba(99,102,241,0.3)',
                    boxShadow: blindMode ? '0 0 20px rgba(16,185,129,0.3)' : '0 0 10px rgba(99,102,241,0.15)',
                }}
            >
                <span style={{ fontSize: '1.6rem' }}>♿</span>
                <span className="text-sm font-bold" style={{ color: blindMode ? '#34D399' : '#A5B4FC' }}>
                    {blindMode
                        ? (lang === 'hi' ? 'चालू' : 'ON')
                        : (lang === 'hi' ? 'दृष्टिबाधित' : 'Blind')}
                </span>
            </button>

            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6 max-w-lg mx-auto">

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                            <span className="text-white text-lg font-black">S</span>
                        </div>
                        <h1 className="text-2xl font-black text-white">SUVIDHA Setu</h1>
                    </div>
                    <div className="flex h-1 rounded-full overflow-hidden max-w-xs mx-auto mb-4">
                        <div className="flex-1" style={{ background: '#FF9933' }} />
                        <div className="flex-1" style={{ background: '#FFFFFF' }} />
                        <div className="flex-1" style={{ background: '#138808' }} />
                    </div>

                    {/* Language badge */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium">
                            🌐 {getLang(lang).native}
                        </span>
                        {voiceMode && isActive && (
                            <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-sm font-medium">
                                🎙️ Voice ON
                            </span>
                        )}
                    </div>

                    <h2 className="text-2xl font-black text-white mb-1">{l.title}</h2>
                    {voiceMode && (
                        <p className="text-white/40 text-sm">
                            {lang === 'hi' ? 'बोलें — "गेस्ट" या "लॉगिन"' : 'Say — "guest" or "login"'}
                        </p>
                    )}
                </div>

                {/* Two cards */}
                <div className="w-full grid grid-cols-1 gap-4 mb-6">
                    <button onClick={() => onSelectPath('guest')}
                        className="relative overflow-hidden rounded-2xl p-6 cursor-pointer border-2 border-blue-500/30 text-left group hover:border-blue-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all"
                        style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.08))' }}>
                        <span className="text-4xl mb-2 block">⚡</span>
                        <h3 className="text-xl font-bold text-blue-400 mb-1">{l.guestTitle}</h3>
                        <p className="text-white/40 text-sm">{l.guestDesc}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span className="text-blue-400/60 text-xs">{l.guestNote}</span>
                        </div>
                    </button>

                    <button onClick={() => onSelectPath('citizen')}
                        className="relative overflow-hidden rounded-2xl p-6 cursor-pointer border-2 border-green-500/30 text-left group hover:border-green-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all"
                        style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.15), rgba(16,185,129,0.08))' }}>
                        <span className="text-4xl mb-2 block">🏛️</span>
                        <h3 className="text-xl font-bold text-green-400 mb-1">{l.citizenTitle}</h3>
                        <p className="text-white/40 text-sm">{l.citizenDesc}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            <span className="text-green-400/60 text-xs">{l.citizenNote}</span>
                        </div>
                    </button>
                </div>

                {/* Footer */}
                <div className="text-center">
                    <div className="flex h-1 rounded-full overflow-hidden max-w-xs mx-auto mb-3">
                        <div className="flex-1" style={{ background: '#FF9933' }} />
                        <div className="flex-1" style={{ background: '#FFFFFF' }} />
                        <div className="flex-1" style={{ background: '#138808' }} />
                    </div>
                    <p className="text-white/15 text-xs">C-DAC SUVIDHA 2026</p>
                </div>
            </div>
        </div>
    );
});
