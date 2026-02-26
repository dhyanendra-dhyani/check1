/**
 * ═══════════════════════════════════════════════════════════
 * HomeScreen v5 — Single Voice Source
 *
 * NO VoiceButton, NO voiceCommands. Just the useVoice()
 * context. Clicking mic activates the global voice agent.
 * ═══════════════════════════════════════════════════════════
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVoice } from './VoiceContext';
import { t } from '../utils/i18n';

const SERVICES = [
    { key: 'electricity', icon: '⚡', label: 'electricityBill', route: '/bill/electricity', gradient: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))', border: 'rgba(251,191,36,0.3)', accentColor: '#FBBF24' },
    { key: 'water', icon: '💧', label: 'waterBill', route: '/bill/water', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))', border: 'rgba(59,130,246,0.3)', accentColor: '#3B82F6' },
    { key: 'gas', icon: '🔥', label: 'gasBill', route: '/bill/gas', gradient: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))', border: 'rgba(249,115,22,0.3)', accentColor: '#F97316' },
    { key: 'property', icon: '🏠', label: 'propertyTax', route: '/bill/electricity', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))', border: 'rgba(139,92,246,0.3)', accentColor: '#8B5CF6' },
];

export default function HomeScreen({ lang, setLang, onBack }) {
    const navigate = useNavigate();
    const { isActive, activate, deactivate, status } = useVoice();

    const handleMicClick = useCallback(() => {
        if (isActive) deactivate();
        else activate();
    }, [isActive, activate, deactivate]);

    const extraLabels = { propertyTax: 'Property Tax' };
    const getLabel = (key, labelKey) => extraLabels[key] || t(lang, labelKey);

    return (
        <div className="min-h-[calc(100vh-160px)] flex flex-col items-center justify-center px-4 py-8 gap-8 fast-fade-in">
            {/* Header */}
            <div className="w-full max-w-3xl flex items-center gap-4 mb-2">
                {onBack && (
                    <button onClick={onBack} className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white cursor-pointer text-lg hover:scale-105 transition-transform" aria-label="Back">←</button>
                )}
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white">
                        {lang === 'hi' ? 'सेवा चुनें' : lang === 'pa' ? 'ਸੇਵਾ ਚੁਣੋ' : 'Select a Service'}
                    </h1>
                    <p className="text-white/40 text-sm">
                        {lang === 'hi' ? 'नीचे टैप करें या माइक दबाएं' : 'Tap below or press the mic'}
                    </p>
                </div>
            </div>

            {/* Mic — THE ONLY voice input for this screen */}
            <button
                onClick={handleMicClick}
                className={`rounded-full flex items-center justify-center cursor-pointer border-2 transition-all hover:scale-105 active:scale-95 ${isActive ? 'mic-pulse' : ''}`}
                style={{
                    width: '100px', height: '100px',
                    background: isActive
                        ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                        : 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(99,102,241,0.1))',
                    borderColor: isActive ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.35)',
                }}
                aria-label={isActive ? 'Stop voice agent' : 'Start voice agent'}
            >
                {isActive ? (
                    <div className="flex items-center gap-1 h-1/2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.1}s`, background: 'white', width: '4px' }} />
                        ))}
                    </div>
                ) : (
                    <svg width={35} height={35} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                )}
            </button>
            <p className="text-white/40 text-sm font-medium text-center -mt-4">
                {isActive
                    ? (lang === 'hi' ? 'बोलिए — मैं सुन रहा हूँ' : 'Speak — I\'m listening')
                    : (lang === 'hi' ? 'माइक दबाएं, बात करें' : 'Press mic, start talking')}
            </p>

            {/* Service grid */}
            <div className="grid grid-cols-2 gap-4 md:gap-5 w-full max-w-xl">
                {SERVICES.map((svc, i) => (
                    <button key={svc.key} onClick={() => navigate(svc.route)}
                        className="group rounded-2xl p-6 cursor-pointer border-2 flex flex-col items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] fast-scale-in"
                        style={{ background: svc.gradient, borderColor: 'transparent', minHeight: '180px', animationDelay: `${i * 0.1}s` }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = svc.border}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    >
                        <span className="text-5xl mb-1 group-hover:scale-110 transition-transform">{svc.icon}</span>
                        <span className="text-white font-bold text-center leading-tight" style={{ fontSize: '1.1rem' }}>{getLabel(svc.key, svc.label)}</span>
                        <div className="w-8 h-1 rounded-full mt-1" style={{ background: svc.accentColor }} />
                    </button>
                ))}
            </div>

            <p className="text-white/20 text-sm text-center mt-2">
                💡 {lang === 'hi' ? 'बोलें "बिजली का बिल" और मैं ले जाऊँगा' : 'Say "electricity bill" and I\'ll take you there'}
            </p>
        </div>
    );
}
