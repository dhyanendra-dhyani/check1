/**
 * ═══════════════════════════════════════════════════════════
 * ComplaintForm — Zero Framer-Motion v3.0
 * Uses CSS animations for step transitions.
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../utils/i18n';
import { complaintCategories, generateComplaintId } from '../utils/mockData';
import { saveOfflineComplaint } from '../utils/offlineSync';
import { generateComplaintReceipt, downloadReceipt } from '../utils/pdfGenerator';
import { speak } from '../utils/voiceCommands';
import VoiceButton from './VoiceButton';

export default function ComplaintForm({ lang, isOnline }) {
    const navigate = useNavigate();
    const photoRef = useRef(null);

    const [step, setStep] = useState('category');  // category | details | done
    const [category, setCategory] = useState(null);
    const [description, setDescription] = useState('');
    const [voiceRecording, setVoiceRecording] = useState(null);
    const [photo, setPhoto] = useState(null);
    const [location, setLocation] = useState(null);
    const [ticketId, setTicketId] = useState('');
    const [isLocating, setIsLocating] = useState(false);

    const detectLocation = useCallback(() => {
        setIsLocating(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLocation({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) });
                    setIsLocating(false);
                    speak('Location detected', lang);
                },
                () => {
                    setLocation({ lat: '30.9010', lng: '75.8573' }); // Ludhiana fallback
                    setIsLocating(false);
                },
                { timeout: 5000 },
            );
        } else {
            setLocation({ lat: '30.9010', lng: '75.8573' });
            setIsLocating(false);
        }
    }, [lang]);

    const handleVoiceDescription = useCallback((transcript) => {
        setDescription((prev) => prev ? `${prev}. ${transcript}` : transcript);
        setVoiceRecording(transcript);
        speak('Description recorded.', lang);

        if (!category) {
            const lower = transcript.toLowerCase();
            const match = complaintCategories.find(c =>
                c.keywords?.some(kw => lower.includes(kw)) || lower.includes(c.label.toLowerCase())
            );
            if (match) {
                setCategory(match);
                speak(`Detected category: ${match.label}`, lang);
            }
        }
    }, [category, lang]);

    const handlePhoto = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setPhoto(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const submitComplaint = async () => {
        const id = generateComplaintId();
        setTicketId(id);
        setStep('done');
        speak(`Complaint registered. Ticket ID: ${id}`, lang);

        await saveOfflineComplaint({
            ticketId: id, category: category?.label, description, hasPhoto: !!photo, location, timestamp: new Date().toISOString(), synced: isOnline,
        });
    };

    const handleDownload = () => {
        const doc = generateComplaintReceipt({
            ticketId, category: category?.label, description, location, date: new Date().toLocaleString('en-IN'),
        }, !isOnline);
        downloadReceipt(doc, `complaint-${ticketId}.pdf`);
    };

    return (
        <div className="min-h-[calc(100vh-160px)] flex flex-col items-center px-4 py-6 fast-fade-in">
            <div className="w-full max-w-xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => step === 'category' ? navigate(-1) : setStep('category')}
                        className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white cursor-pointer text-lg hover:bg-white/10 transition-colors"
                    >
                        ←
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-white">📝 {lang === 'hi' ? 'शिकायत दर्ज करें' : 'File Complaint'}</h2>
                        <p className="text-white/40 text-sm">
                            {step === 'category' ? 'Select a category' : step === 'details' ? 'Describe your issue' : 'Complaint registered'}
                        </p>
                    </div>
                </div>

                {/* ── STEP 1: Category ──────────────────── */}
                {step === 'category' && (
                    <div className="space-y-6 fast-slide-left">
                        {/* Voice auto-detect */}
                        <div className="glass-card rounded-2xl p-5 flex flex-col items-center gap-3">
                            <p className="text-white/50 text-sm font-semibold">
                                {lang === 'hi' ? 'समस्या बताएँ — आवाज़ से श्रेणी चुनें' : 'Describe your issue — auto-detect category'}
                            </p>
                            <VoiceButton lang={lang} size={70} showLabel={true} labelText="Speak your problem" onResult={handleVoiceDescription} onError={() => { }} />
                        </div>

                        {/* Manual category grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {complaintCategories.map((cat, i) => (
                                <button
                                    key={cat.label}
                                    onClick={() => { setCategory(cat); setStep('details'); }}
                                    className={`rounded-2xl p-4 cursor-pointer border transition-all text-left hover:scale-[1.02] active:scale-[0.98] fast-scale-in ${category?.label === cat.label
                                        ? 'bg-indigo-600/20 border-indigo-500/30'
                                        : 'bg-white/5 border-white/5 hover:border-white/15'
                                        }`}
                                    style={{ animationDelay: `${i * 0.05}s` }}
                                >
                                    <span className="text-3xl mb-2 block">{cat.icon}</span>
                                    <span className="text-white font-bold text-sm">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Details ───────────────────── */}
                {step === 'details' && (
                    <div className="space-y-5 fast-slide-left">
                        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
                            <span className="text-3xl">{category?.icon}</span>
                            <div>
                                <p className="text-white font-bold">{category?.label}</p>
                                <button onClick={() => setStep('category')} className="text-indigo-400 text-xs cursor-pointer bg-transparent border-0 hover:underline">Change</button>
                            </div>
                        </div>

                        <div className="glass-card rounded-2xl p-5 space-y-3">
                            <label className="text-white/50 text-sm font-semibold block">
                                {lang === 'hi' ? 'विवरण' : 'Description'}
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the issue..."
                                rows={4}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white resize-none focus:border-indigo-500 outline-none text-sm"
                            />

                            <div className="flex gap-2">
                                <VoiceButton lang={lang} size={44} showLabel={false} onResult={handleVoiceDescription} onError={() => { }} />
                                <button
                                    onClick={() => photoRef.current?.click()}
                                    className="flex-1 py-2.5 px-4 bg-white/5 border border-white/10 rounded-xl text-white/60 text-sm font-semibold cursor-pointer hover:bg-white/10 flex items-center justify-center gap-2"
                                >
                                    📷 {photo ? 'Photo attached ✓' : 'Attach Photo'}
                                </button>
                                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                            </div>

                            {voiceRecording && (
                                <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-3 flex items-center gap-2">
                                    <div className="flex items-center gap-0.5 h-4">
                                        {[...Array(5)].map((_, i) => <div key={i} className="w-0.5 bg-indigo-400 h-full animate-pulse" />)}
                                    </div>
                                    <p className="text-indigo-300 text-xs truncate">"{voiceRecording}"</p>
                                </div>
                            )}

                            {photo && (
                                <div className="relative rounded-xl overflow-hidden border border-white/10">
                                    <img src={photo} alt="Complaint photo" className="w-full h-32 object-cover" />
                                    <button
                                        onClick={() => setPhoto(null)}
                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold cursor-pointer border-0 flex items-center justify-center hover:bg-red-600"
                                    >✕</button>
                                </div>
                            )}
                        </div>

                        <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">📍</span>
                                <div>
                                    <p className="text-white text-sm font-semibold">Location</p>
                                    {location ? (
                                        <p className="text-white/40 text-xs font-mono">{location.lat}, {location.lng}</p>
                                    ) : (
                                        <p className="text-white/30 text-xs">Not detected</p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={detectLocation}
                                disabled={isLocating}
                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm cursor-pointer hover:bg-white/10 disabled:opacity-50"
                            >
                                {isLocating ? 'Detecting...' : location ? '✓ Detected' : 'Detect'}
                            </button>
                        </div>

                        <button
                            onClick={submitComplaint}
                            disabled={!description.trim()}
                            className="w-full py-4 rounded-xl gradient-primary text-white font-bold text-lg cursor-pointer disabled:opacity-30 border-0 hover:scale-[1.01] transition-transform"
                        >
                            {lang === 'hi' ? 'शिकायत दर्ज करें' : 'Submit Complaint'}
                        </button>
                    </div>
                )}

                {/* ── STEP 3: Done ──────────────────────── */}
                {step === 'done' && (
                    <div className="flex flex-col items-center gap-6 py-8 fast-scale-in">
                        <div className="w-28 h-28 rounded-full gradient-primary flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                            <span className="text-white text-5xl">📋</span>
                        </div>

                        <div className="text-center">
                            <h3 className="text-2xl font-black text-indigo-400 mb-2">
                                {isOnline
                                    ? (lang === 'hi' ? 'टिकट जनरेट हुआ!' : 'Ticket Generated!')
                                    : (lang === 'hi' ? 'स्थानीय रूप से सहेजा गया' : 'Saved Locally')}
                            </h3>
                            <p className="text-white font-mono text-lg font-bold">{ticketId}</p>
                        </div>

                        {!isOnline && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3 text-center">
                                <p className="text-amber-400 text-sm font-semibold">
                                    📡 Your complaint is saved. You will receive an SMS once internet returns.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 w-full max-w-sm">
                            <button onClick={handleDownload} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold cursor-pointer hover:bg-white/10">
                                🖨️ Print Slip
                            </button>
                            <button onClick={() => navigate('/')} className="flex-1 py-3 rounded-xl gradient-primary text-white font-semibold cursor-pointer border-0">
                                🏠 Home
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
