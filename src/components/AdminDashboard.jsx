/**
 * ═══════════════════════════════════════════════════════════
 * AdminDashboard — Zero Framer-Motion
 * Uses Recharts for visualization and CSS for list animations.
 * ═══════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { t } from '../utils/i18n';
import { adminMockData } from '../utils/mockData';

const ADMIN_CREDS = { username: 'admin', password: 'password123' };

export default function AdminDashboard({ lang }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = () => {
        if (username === ADMIN_CREDS.username && password === ADMIN_CREDS.password) {
            setIsLoggedIn(true);
            setError('');
        } else {
            setError('Invalid credentials');
        }
    };

    /** Login Screen */
    if (!isLoggedIn) {
        return (
            <div className="min-h-[calc(100vh-160px)] flex items-center justify-center px-4 fast-fade-in">
                <div className="glass-card rounded-3xl p-8 w-full max-w-md">
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <span className="text-3xl">📊</span>
                        </div>
                        <h2 className="text-2xl font-black text-white">{t(lang, 'adminLogin')}</h2>
                    </div>

                    <div className="space-y-4">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t(lang, 'username')}
                            className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:border-indigo-500 outline-none"
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t(lang, 'password')}
                            className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:border-indigo-500 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        <button
                            onClick={handleLogin}
                            className="w-full py-4 rounded-xl gradient-primary text-white font-bold text-lg cursor-pointer border-0 hover:scale-[1.02] transition-transform"
                        >
                            {t(lang, 'login')}
                        </button>
                    </div>

                    {/* Proto credentials */}
                    <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                        <p className="text-amber-400 text-xs font-bold">
                            🔧 PROTOTYPE — Username: <span className="font-mono">admin</span> · Password: <span className="font-mono">password123</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    /** Dashboard */
    const stats = [
        { label: t(lang, 'totalTransactions'), value: adminMockData.totalTransactions, icon: '💳', color: '#3B82F6' },
        { label: t(lang, 'activeKiosks'), value: adminMockData.activeKiosks, icon: '📟', color: '#10B981' },
        { label: t(lang, 'pendingComplaints'), value: adminMockData.pendingComplaints, icon: '📋', color: '#F59E0B' },
        { label: t(lang, 'revenueCollected'), value: adminMockData.revenueCollected, icon: '💰', color: '#8B5CF6' },
    ];

    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6 fast-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-white">📊 {t(lang, 'dashboard')}</h2>
                <button
                    onClick={() => setIsLoggedIn(false)}
                    className="px-4 py-2 bg-red-500/15 text-red-400 rounded-xl font-bold text-sm cursor-pointer border border-red-500/20 hover:bg-red-500/25"
                >
                    {t(lang, 'logout')}
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map((s, i) => (
                    <div
                        key={s.label}
                        className="glass-card rounded-2xl p-5 fast-scale-in"
                        style={{ animationDelay: `${i * 0.1}s` }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: `${s.color}20` }}>
                                {s.icon}
                            </div>
                        </div>
                        <p className="text-2xl font-black text-white">{s.value}</p>
                        <p className="text-white/40 text-sm font-medium mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div className="glass-card rounded-2xl p-5 fast-fade-in" style={{ animationDelay: '0.2s' }}>
                    <h3 className="text-white font-bold mb-4">{lang === 'hi' ? 'प्रति घंटा लेनदेन' : 'Hourly Transactions'}</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={adminMockData.hourlyData}>
                            <XAxis dataKey="hour" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ background: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#F3F4F6' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <Bar dataKey="transactions" fill="#6366F1" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Pie Chart */}
                <div className="glass-card rounded-2xl p-5 fast-fade-in" style={{ animationDelay: '0.3s' }}>
                    <h3 className="text-white font-bold mb-4">{lang === 'hi' ? 'सेवा वितरण' : 'Service Breakdown'}</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={adminMockData.serviceBreakdown}
                                cx="50%" cy="50%"
                                innerRadius={55} outerRadius={90}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                            >
                                {adminMockData.serviceBreakdown.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ background: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#F3F4F6' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Heatmap */}
            <div className="glass-card rounded-2xl p-5 fast-fade-in" style={{ animationDelay: '0.4s' }}>
                <h3 className="text-white font-bold mb-4">🗺️ {t(lang, 'complaintHeatmap')}</h3>
                <div className="relative bg-white/3 rounded-2xl p-4" style={{ minHeight: '300px' }}>
                    <svg viewBox="0 0 500 450" className="w-full h-auto opacity-20">
                        <path
                            d="M250 50 L280 80 L310 70 L340 90 L360 130 L350 160 L370 190
                 L380 220 L360 260 L340 280 L350 310 L330 340 L300 360
                 L280 380 L260 400 L240 380 L220 370 L200 380 L180 350
                 L160 320 L170 290 L160 260 L180 240 L170 210 L180 180
                 L200 160 L190 130 L210 100 L230 80 Z"
                            fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" strokeWidth="1"
                        />
                    </svg>
                    {adminMockData.heatmapPoints.map((point) => (
                        <div
                            key={point.name}
                            className="absolute group cursor-pointer"
                            style={{
                                left: `${(point.x / 500) * 100}%`,
                                top: `${(point.y / 450) * 100}%`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            <div
                                className="rounded-full animate-pulse"
                                style={{
                                    width: `${Math.max(12, point.count * 1.5)}px`,
                                    height: `${Math.max(12, point.count * 1.5)}px`,
                                    background: `radial-gradient(circle, rgba(239,68,68,0.8), rgba(239,68,68,0.2))`,
                                    boxShadow: `0 0 ${point.count}px rgba(239,68,68,0.4)`,
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Activity Log */}
            <div className="glass-card rounded-2xl p-5 fast-fade-in" style={{ animationDelay: '0.5s' }}>
                <h3 className="text-white font-bold mb-4">📋 {t(lang, 'activityLog')}</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-white/30 text-left border-b border-white/5">
                                <th className="pb-3 font-semibold">{t(lang, 'time')}</th>
                                <th className="pb-3 font-semibold">{t(lang, 'kioskId')}</th>
                                <th className="pb-3 font-semibold">{t(lang, 'action')}</th>
                                <th className="pb-3 font-semibold text-right">{t(lang, 'amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {adminMockData.activityLog.map((log, i) => (
                                <tr key={i} className="border-b border-white/3 hover:bg-white/3 transition">
                                    <td className="py-3 text-white/50 font-mono text-xs">{log.time}</td>
                                    <td className="py-3 text-white/70 font-semibold">{log.kioskId}</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${log.type === 'payment' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                                            }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="py-3 text-white text-right font-mono font-bold">{log.amount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
