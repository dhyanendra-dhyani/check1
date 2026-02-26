/**
 * ═══════════════════════════════════════════════════════════
 * BillPayment — Multi-step bill payment v3.0 (zero framer-motion)
 *
 * ★ PROTOTYPE MODE:
 *   - Accepts ANY consumer number
 *   - Name masked for privacy
 *   - Global marquee ticker handles prototype notice
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { t } from '../utils/i18n';
import { lookupBill, generateTxnId } from '../utils/mockData';
import { saveOfflineTransaction } from '../utils/offlineSync';
import { generatePaymentReceipt, downloadReceipt } from '../utils/pdfGenerator';
import { speak, extractConsumerId } from '../utils/voiceCommands';
import VoiceButton from './VoiceButton';

const SERVICE_META = {
    electricity: { icon: '⚡', label: 'Electricity Bill', color: '#FBBF24' },
    water: { icon: '💧', label: 'Water Bill', color: '#3B82F6' },
    gas: { icon: '🔥', label: 'Gas Bill', color: '#F97316' },
};

function maskName(name) {
    if (!name) return '***';
    return name.split(' ').map(w => w.length <= 1 ? w : w[0] + '*'.repeat(w.length - 1)).join(' ');
}

function getOrGenerateBill(consumerId, serviceType) {
    const real = lookupBill(consumerId);
    if (real) return { ...real, name: maskName(real.fullName || real.name) };

    const fakeNames = ['Vivek Kumar', 'Anjali Sharma', 'Ramesh Patel', 'Priya Singh', 'Sunil Verma'];
    const fakeName = fakeNames[Math.floor(Math.random() * fakeNames.length)];
    const amount = Math.floor(Math.random() * 2000) + 200;
    const units = Math.floor(Math.random() * 200) + 10;
    const unitLabels = { electricity: 'kWh', water: 'KL', gas: 'Cylinders' };

    return {
        id: consumerId, service: serviceType, name: maskName(fakeName), fullName: fakeName, amount, units,
        unitLabel: unitLabels[serviceType] || 'Units', dueDate: '2026-03-15', lastPaymentDate: '2026-01-20',
        meterNo: `MTR-${Math.floor(Math.random() * 9000000) + 1000000}`,
    };
}

export default function BillPayment({ lang, isOnline }) {
    const { serviceType } = useParams();
    const navigate = useNavigate();
    const meta = SERVICE_META[serviceType] || SERVICE_META.electricity;

    const [step, setStep] = useState('input');
    const [consumerId, setConsumerId] = useState('');
    const [bill, setBill] = useState(null);
    const [payMethod, setPayMethod] = useState(null);
    const [txnId, setTxnId] = useState('');
    const [cashCount, setCashCount] = useState(0);

    const fetchBill = useCallback(() => {
        if (consumerId.trim().length < 1) return;
        const found = getOrGenerateBill(consumerId.trim(), serviceType);
        setBill(found);
        setStep('bill');
        speak(`Bill found. Amount due: ${found.amount} rupees.`, lang);
    }, [consumerId, serviceType, lang]);

    const handleNumpad = (key) => {
        if (key === '⌫') setConsumerId(p => p.slice(0, -1));
        else if (key === 'C') setConsumerId('');
        else setConsumerId(p => p + key);
    };

    const handleVoiceId = useCallback((transcript) => {
        const id = extractConsumerId(transcript);
        if (id) { setConsumerId(id); speak(`Consumer ID: ${id}`, lang); }
        else { const c = transcript.replace(/\s+/g, '-').toUpperCase(); setConsumerId(c); speak(`ID: ${c}`, lang); }
    }, [lang]);

    const simulateQR = () => {
        const ids = { electricity: 'PSEB-123456', water: 'PHED-789012', gas: 'GPL-345678' };
        const id = ids[serviceType] || 'PSEB-123456';
        setConsumerId(id);
        speak(`QR: ${id}`, lang);
    };

    const processPayment = async (method) => {
        setPayMethod(method);
        if (method === 'cash') setCashCount(0);
        const id = generateTxnId();
        setTxnId(id);
        setTimeout(async () => {
            setStep('success');
            speak(`Payment successful! Transaction: ${id}`, lang);
            await saveOfflineTransaction({
                txnId: id, consumerId, amount: bill.amount, service: serviceType, method, timestamp: new Date().toISOString(), synced: isOnline,
            });
        }, method === 'cash' ? 3000 : 2000);
    };

    useEffect(() => {
        if (payMethod === 'cash' && step === 'pay') {
            const t = setInterval(() => setCashCount(c => { if (c >= 3) { clearInterval(t); return c; } return c + 1; }), 900);
            return () => clearInterval(t);
        }
    }, [payMethod, step]);

    const handleDownload = () => {
        const doc = generatePaymentReceipt({
            txnId, consumerId, amount: bill.amount, name: bill.name, service: serviceType, method: payMethod, date: new Date().toLocaleString('en-IN'),
        }, !isOnline);
        downloadReceipt(doc, `receipt-${txnId}.pdf`);
    };

    const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

    return (
        <div className="min-h-[calc(100vh-160px)] flex flex-col items-center px-4 py-6 fast-fade-in">
            <div className="w-full max-w-xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => step === 'input' ? navigate(-1) : setStep('input')}
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white cursor-pointer text-lg">←</button>
                    <div className="flex items-center gap-3 flex-1">
                        <span className="text-3xl">{meta.icon}</span>
                        <div>
                            <h2 className="text-xl font-bold text-white">{meta.label}</h2>
                            <p className="text-white/40 text-sm">
                                {step === 'input' ? 'Enter Consumer ID' : step === 'bill' ? 'Confirm details' : step === 'pay' ? 'Complete payment' : 'Done!'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Steps */}
                <div className="flex items-center gap-2 mb-6">
                    {['input', 'bill', 'pay', 'success'].map((s, i) => (
                        <div key={s} className="flex-1 flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${s === step ? 'gradient-primary text-white' :
                                    ['input', 'bill', 'pay', 'success'].indexOf(step) > i ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/30'
                                }`}>{['input', 'bill', 'pay', 'success'].indexOf(step) > i ? '✓' : i + 1}</div>
                            {i < 3 && <div className={`flex-1 h-px ${['input', 'bill', 'pay', 'success'].indexOf(step) > i ? 'bg-green-500/30' : 'bg-white/10'}`} />}
                        </div>
                    ))}
                </div>

                {/* ── STEP 1: INPUT ───────────────── */}
                {step === 'input' && (
                    <div className="space-y-4 fast-fade-in">
                        <div className="glass-card rounded-2xl p-5">
                            <label className="text-white/50 text-sm font-semibold block mb-2">Consumer Number</label>
                            <input readOnly value={consumerId} placeholder="Enter any number..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-xl font-mono p-3 focus:border-indigo-500 outline-none" />
                            <p className="text-white/20 text-xs mt-2">✨ Prototype: any number accepted</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={simulateQR} className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-semibold hover:bg-white/10 cursor-pointer">📷 Scan QR</button>
                            <div className="flex-1 flex justify-center">
                                <VoiceButton lang={lang} size={48} showLabel={false} onResult={handleVoiceId} onError={() => { }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                            {numpadKeys.map(key => (
                                <button key={key} onClick={() => handleNumpad(key)} className="numpad-key">{key}</button>
                            ))}
                        </div>
                        <button onClick={fetchBill} disabled={consumerId.length < 1}
                            className="w-full py-3 rounded-xl gradient-primary text-white font-bold text-lg cursor-pointer disabled:opacity-30 border-0">
                            {t(lang, 'fetchBill')}
                        </button>
                    </div>
                )}

                {/* ── STEP 2: BILL DETAILS ───────── */}
                {step === 'bill' && bill && (
                    <div className="space-y-4 fast-fade-in">
                        <div className="glass-card rounded-2xl p-5">
                            <div className="flex justify-between mb-3 pb-3 border-b border-white/5">
                                <span className="text-white/40 text-sm">Bill ID</span>
                                <span className="text-white font-mono font-bold">{consumerId}</span>
                            </div>
                            <div className="flex justify-between mb-3">
                                <span className="text-white/40 text-sm">Name</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-semibold">{bill.name}</span>
                                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-xs font-bold">🔒</span>
                                </div>
                            </div>
                            <div className="flex justify-between mb-3">
                                <span className="text-white/40 text-sm">Meter</span>
                                <span className="text-white/70 font-mono text-sm">{bill.meterNo}</span>
                            </div>
                            <div className="flex justify-between mb-3">
                                <span className="text-white/40 text-sm">Usage</span>
                                <span className="text-white/70">{bill.units} {bill.unitLabel}</span>
                            </div>
                            <div className="flex justify-between mb-3">
                                <span className="text-white/40 text-sm">Due</span>
                                <span className="text-white">{bill.dueDate}</span>
                            </div>
                            <div className="border-t border-white/10 pt-3 flex justify-between">
                                <span className="text-white font-bold">Amount</span>
                                <span className="text-2xl font-black" style={{ color: meta.color }}>₹{bill.amount.toLocaleString()}</span>
                            </div>
                        </div>
                        <button onClick={() => setStep('pay')}
                            className="w-full py-3 rounded-xl gradient-success text-white font-bold text-lg cursor-pointer border-0">
                            ✓ Pay ₹{bill.amount.toLocaleString()}
                        </button>
                    </div>
                )}

                {/* ── STEP 3: PAY ────────────────── */}
                {step === 'pay' && (
                    <div className="space-y-4 fast-fade-in">
                        {!payMethod && (
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { m: 'upi', icon: '📱', label: 'UPI/QR', c: 'blue' },
                                    { m: 'cash', icon: '💵', label: 'Cash', c: 'green' },
                                    { m: 'card', icon: '💳', label: 'Card', c: 'purple' },
                                ].map(({ m, icon, label, c }) => (
                                    <button key={m} onClick={() => processPayment(m)}
                                        className={`glass-card rounded-2xl p-4 cursor-pointer border border-transparent hover:border-${c}-500/30 flex flex-col items-center gap-2`}>
                                        <span className="text-3xl">{icon}</span>
                                        <span className="text-white font-bold text-sm">{label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {payMethod === 'upi' && (
                            <div className="flex flex-col items-center gap-4 glass-card rounded-2xl p-5 fast-fade-in">
                                <p className="text-white/60 text-sm">Scan with any UPI app</p>
                                <div className="bg-white p-4 rounded-xl">
                                    <QRCodeSVG value={`upi://pay?pa=suvidha@sbi&am=${bill?.amount}&tn=BillPay-${consumerId}`} size={180} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                    <p className="text-white/60 text-sm">Waiting for payment...</p>
                                </div>
                            </div>
                        )}
                        {payMethod === 'cash' && (
                            <div className="flex flex-col items-center gap-4 fast-fade-in">
                                <div className="w-48 h-48 glass-card rounded-2xl flex flex-col items-center justify-center overflow-hidden relative">
                                    <p className="text-green-400 text-sm font-bold">₹{bill?.amount?.toLocaleString()}</p>
                                    {[...Array(cashCount)].map((_, i) => (
                                        <span key={i} className="text-4xl fast-fade-in" style={{ position: 'absolute', top: `${30 + i * 40}px` }}>💵</span>
                                    ))}
                                    <p className="text-white/20 text-xs mt-auto mb-2">↓ Insert notes</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                    <p className="text-white/60 text-sm">Accepting cash...</p>
                                </div>
                            </div>
                        )}
                        {payMethod === 'card' && (
                            <div className="flex flex-col items-center gap-4 fast-fade-in">
                                <div className="w-48 h-32 glass-card rounded-2xl flex items-center justify-center text-6xl">💳</div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                    <p className="text-white/60 text-sm">Tap, insert, or swipe...</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 4: SUCCESS ────────────── */}
                {step === 'success' && (
                    <div className="flex flex-col items-center gap-5 py-4 fast-scale-in">
                        <div className="w-24 h-24 rounded-full gradient-success flex items-center justify-center">
                            <span className="text-white text-4xl">✓</span>
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-black text-green-400 mb-1">Payment Successful!</h3>
                            <p className="text-white/50 font-mono text-sm">TXN: {txnId}</p>
                        </div>
                        <div className="glass-card rounded-2xl p-4 w-full max-w-sm text-sm space-y-1.5">
                            <div className="flex justify-between"><span className="text-white/40">ID</span><span className="text-white font-mono">{consumerId}</span></div>
                            <div className="flex justify-between"><span className="text-white/40">Name</span><span className="text-white">{bill?.name}</span></div>
                            <div className="flex justify-between"><span className="text-white/40">Amount</span><span className="text-green-400 font-bold">₹{bill?.amount?.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-white/40">Method</span><span className="text-white capitalize">{payMethod}</span></div>
                        </div>
                        {!isOnline && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-center">
                                <p className="text-amber-400 text-sm font-semibold">📡 Saved offline — syncs later</p>
                            </div>
                        )}
                        <div className="flex gap-3 w-full max-w-sm">
                            <button onClick={handleDownload} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold cursor-pointer">📥 Receipt</button>
                            <button onClick={() => navigate('/')} className="flex-1 py-3 rounded-xl gradient-primary text-white font-semibold cursor-pointer border-0">🏠 Home</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
