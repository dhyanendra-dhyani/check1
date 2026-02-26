/**
 * ═══════════════════════════════════════════════════════════
 * CitizenDashboard - Authenticated Dashboard v3.0 (Zero Framer-Motion)
 * Pure CSS animations for tabs and lists.
 * ═══════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../utils/i18n';
import { speak } from '../utils/voiceCommands';
import VoiceButton from './VoiceButton';
import { processVoiceCommand } from '../utils/voiceCommands';

const myBills = [
    { service: 'Electricity', icon: '⚡', id: 'PSEB-123456', amount: 1200, due: '2026-02-28', status: 'due', route: '/bill/electricity' },
    { service: 'Water', icon: '💧', id: 'PHED-789012', amount: 280, due: '2026-03-05', status: 'paid', route: '/bill/water' },
    { service: 'Gas', icon: '🔥', id: 'GPL-345678', amount: 620, due: '2026-03-10', status: 'due', route: '/bill/gas' },
];

const myComplaints = [
    { ticketId: 'COMP-2026-00909', category: 'Broken Streetlight', status: 'resolved', date: '2026-01-28' },
    { ticketId: 'COMP-2026-00915', category: 'Water Supply', status: 'in-progress', date: '2026-02-10' },
];

const availableServices = [
    { label: 'Apply New Connection', icon: '🆕', route: '/bill/electricity' },
    { label: 'Name Change', icon: '✏️', route: '/complaint' },
    { label: 'Print Certificate', icon: '📜', route: '/complaint' },
    { label: 'Report Issue', icon: '📝', route: '/complaint' },
    { label: 'Property Tax', icon: '🏠', route: '/bill/electricity' },
    { label: 'View History', icon: '📊', route: '/admin' },
];

const statusColors = {
    'due': { bg: 'rgba(239,68,68,0.15)', text: '#F87171', label: 'Due' },
    'paid': { bg: 'rgba(16,185,129,0.15)', text: '#34D399', label: 'Paid' },
    'resolved': { bg: 'rgba(16,185,129,0.15)', text: '#34D399', label: 'Resolved' },
    'in-progress': { bg: 'rgba(245,158,11,0.15)', text: '#FBBF24', label: 'In Progress' },
};

export default function CitizenDashboard({ lang, citizen, onLogout, isOnline }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('bills');

    const handleVoice = (transcript) => {
        const result = processVoiceCommand(transcript);
        if (result.type === 'navigate') navigate(result.value);
    };

    const initials = citizen?.name?.split(' ').map(w => w[0]).join('') || 'VK';

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-6 fast-fade-in">
            {/* ── Welcome Header ──────────────────────── */}
            <div className="glass-card rounded-2xl p-6 mb-6 flex flex-wrap items-center justify-between gap-4 fast-slide-left">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full gradient-citizen flex items-center justify-center text-white text-2xl font-black shadow-lg">
                        {initials}
                    </div>
                    <div>
                        <p className="text-white/50 text-sm">
                            {lang === 'hi' ? 'स्वागत है,' : lang === 'pa' ? 'ਜੀ ਆਇਆਂ ਨੂੰ,' : 'Welcome,'}
                        </p>
                        <h2 className="text-2xl font-bold text-white">{citizen?.name || 'Vivek Kumar'}</h2>
                        <p className="text-white/30 text-xs font-mono">{citizen?.aadhaar || 'XXXX-XXXX-4829'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <VoiceButton lang={lang} size={50} showLabel={false} onResult={handleVoice} onError={() => { }} />
                    <button
                        onClick={onLogout}
                        className="px-4 py-2.5 bg-red-500/15 text-red-400 rounded-xl font-bold hover:bg-red-500/25 transition cursor-pointer border border-red-500/20 text-sm"
                    >
                        {t(lang, 'logout')}
                    </button>
                </div>
            </div>

            {/* ── Tab Navigation ──────────────────────── */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                {[
                    { key: 'bills', icon: '💰', label: lang === 'hi' ? 'मेरे बिल' : 'My Bills' },
                    { key: 'complaints', icon: '📋', label: lang === 'hi' ? 'मेरी शिकायतें' : 'My Complaints' },
                    { key: 'services', icon: '🏛️', label: lang === 'hi' ? 'सेवाएँ' : 'Services' },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm cursor-pointer border transition-all whitespace-nowrap ${activeTab === tab.key
                            ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                            : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/8 hover:text-white/70'
                            }`}
                    >
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Content Area ────────────────────────── */}
            <div className="min-h-[300px]">
                {/* Bills */}
                {activeTab === 'bills' && (
                    <div className="space-y-3 fast-fade-in">
                        {myBills.map((bill, i) => {
                            const sc = statusColors[bill.status];
                            return (
                                <button
                                    key={bill.id}
                                    onClick={() => navigate(bill.route)}
                                    className="w-full glass-card rounded-2xl p-5 flex items-center justify-between gap-4 cursor-pointer border border-transparent hover:border-indigo-500/20 text-left hover:scale-[1.01] transition-transform fast-scale-in"
                                    style={{ animationDelay: `${i * 0.05}s` }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl">
                                            {bill.icon}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{bill.service}</p>
                                            <p className="text-white/30 text-xs font-mono">{bill.id}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <div>
                                            <p className="text-white font-black text-xl">₹{bill.amount.toLocaleString()}</p>
                                            <p className="text-white/30 text-xs">Due: {bill.due}</p>
                                        </div>
                                        <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: sc.bg, color: sc.text }}>
                                            {sc.label}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Complaints */}
                {activeTab === 'complaints' && (
                    <div className="space-y-3 fast-fade-in">
                        {myComplaints.map((comp, i) => {
                            const sc = statusColors[comp.status];
                            return (
                                <div key={comp.ticketId} className="glass-card rounded-2xl p-5 flex items-center justify-between fast-scale-in" style={{ animationDelay: `${i * 0.05}s` }}>
                                    <div>
                                        <p className="text-white font-bold">{comp.category}</p>
                                        <p className="text-white/30 text-xs font-mono">{comp.ticketId} · {comp.date}</p>
                                    </div>
                                    <span className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: sc.bg, color: sc.text }}>
                                        {sc.label}
                                    </span>
                                </div>
                            );
                        })}
                        <button
                            onClick={() => navigate('/complaint')}
                            className="w-full py-5 rounded-2xl border-2 border-dashed border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 font-semibold cursor-pointer bg-transparent text-sm hover:scale-[1.01] transition-transform"
                        >
                            + {lang === 'hi' ? 'नई शिकायत दर्ज करें' : 'File New Complaint'}
                        </button>
                    </div>
                )}

                {/* Services */}
                {activeTab === 'services' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 fast-fade-in">
                        {availableServices.map((svc, i) => (
                            <button
                                key={svc.label}
                                onClick={() => navigate(svc.route)}
                                className="glass-card rounded-2xl p-5 flex flex-col items-center gap-3 cursor-pointer border border-transparent hover:border-indigo-500/20 hover:scale-[1.02] transition-transform fast-scale-in"
                                style={{ animationDelay: `${i * 0.05}s` }}
                            >
                                <span className="text-3xl">{svc.icon}</span>
                                <span className="text-white/80 font-semibold text-sm text-center">{svc.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
