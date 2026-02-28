/**
 * ═══════════════════════════════════════════════════════════
 * NewConnectionForm — Apply for New Utility Connection
 *
 * 4-step realistic flow:
 * 1. Select connection type + DigiLocker fetch animation
 * 2. Form with pre-filled data + user edits
 * 3. Document verification checklist
 * 4. Confirmation with application number & timeline
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const CONNECTION_TYPES = [
    { key: 'electricity', icon: '⚡', label: 'Electricity', labelHi: 'बिजली', color: '#FBBF24', provider: 'PSEB (Punjab State Electricity Board)', timeline: '7-10 working days' },
    { key: 'water', icon: '💧', label: 'Water Supply', labelHi: 'पानी सप्लाई', color: '#38BDF8', provider: 'PHED (Public Health Engineering Dept)', timeline: '10-15 working days' },
    { key: 'gas', icon: '🔥', label: 'Gas Pipeline', labelHi: 'गैस पाइपलाइन', color: '#FB923C', provider: 'GPL (Gas Pipeline Ltd)', timeline: '15-20 working days' },
    { key: 'sewerage', icon: '🚰', label: 'Sewerage', labelHi: 'सीवरेज', color: '#A78BFA', provider: 'Municipal Corporation', timeline: '10-14 working days' },
];

// Mock DigiLocker data (pre-filled from Aadhaar)
const DIGILOCKER_DATA = {
    fullName: 'Vivek Kumar',
    fatherName: 'Rajendra Kumar',
    dob: '1990-05-15',
    gender: 'Male',
    aadhaarNo: 'XXXX-XXXX-4829',
    mobile: '98765-43210',
    email: 'vivek.kumar@email.com',
    address: 'Block-C, Sector 42, Ludhiana, Punjab - 141001',
    panNo: 'ABCPK1234F',
    rationCard: 'PB-LD-2026-00456',
};

const REQUIRED_DOCS = [
    { key: 'aadhaar', label: 'Aadhaar Card', labelHi: 'आधार कार्ड', icon: '🪪', status: 'verified', source: 'DigiLocker' },
    { key: 'address', label: 'Address Proof', labelHi: 'एड्रेस प्रूफ', icon: '🏠', status: 'verified', source: 'DigiLocker' },
    { key: 'photo', label: 'Passport Photo', labelHi: 'पासपोर्ट फोटो', icon: '📸', status: 'pending', source: 'Upload Required' },
    { key: 'ownership', label: 'Property Ownership / NOC', labelHi: 'मालिकाना हक / NOC', icon: '📄', status: 'pending', source: 'Upload Required' },
    { key: 'form', label: 'Signed Application Form', labelHi: 'हस्ताक्षरित आवेदन फॉर्म', icon: '✍️', status: 'auto', source: 'Auto-generated' },
];

export default function NewConnectionForm({ lang }) {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1=type, 2=digilocker+form, 3=docs, 4=done
    const [connType, setConnType] = useState(null);
    const [fetching, setFetching] = useState(false);
    const [fetchProgress, setFetchProgress] = useState(0);
    const [formData, setFormData] = useState({ ...DIGILOCKER_DATA, propertyType: 'residential', loadCategory: 'domestic', remarks: '' });
    const [uploadedDocs, setUploadedDocs] = useState({ photo: false, ownership: false });
    const [appNumber, setAppNumber] = useState('');

    // DigiLocker fetch simulation
    const startDigiLockerFetch = useCallback((type) => {
        setConnType(type);
        setFetching(true);
        setFetchProgress(0);
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 18 + 5;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => {
                    setFetching(false);
                    setStep(2);
                }, 600);
            }
            setFetchProgress(Math.min(progress, 100));
        }, 300);
    }, []);

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmitForm = () => {
        setStep(3);
    };

    const handleDocUpload = (docKey) => {
        setUploadedDocs(prev => ({ ...prev, [docKey]: true }));
    };

    const handleFinalSubmit = () => {
        const num = `CONN-${connType.key.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        setAppNumber(num);
        setStep(4);
    };

    const allDocsReady = uploadedDocs.photo && uploadedDocs.ownership;

    const selectedType = connType ? CONNECTION_TYPES.find(c => c.key === connType.key) : null;

    return (
        <div className="w-full max-w-2xl mx-auto px-4 py-6 fast-fade-in">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-6">
                {[1, 2, 3, 4].map(s => (
                    <div key={s} className="flex-1 h-1.5 rounded-full transition-all duration-500"
                        style={{ background: step >= s ? 'linear-gradient(90deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.08)' }} />
                ))}
            </div>

            {/* ═══ STEP 1: Select Connection Type ═══ */}
            {step === 1 && !fetching && (
                <div className="fast-fade-in">
                    <h2 className="text-2xl font-black text-white mb-1">
                        {lang === 'hi' ? '🆕 नया कनेक्शन आवेदन' : '🆕 New Connection Application'}
                    </h2>
                    <p className="text-white/40 text-sm mb-6">
                        {lang === 'hi' ? 'कनेक्शन का प्रकार चुनें' : 'Select the type of connection you need'}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        {CONNECTION_TYPES.map(type => (
                            <button key={type.key} onClick={() => startDigiLockerFetch(type)}
                                className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer border-2 border-transparent hover:border-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-center"
                            >
                                <span className="text-4xl">{type.icon}</span>
                                <span className="text-white font-bold">{lang === 'hi' ? type.labelHi : type.label}</span>
                                <span className="text-white/30 text-xs">{type.timeline}</span>
                            </button>
                        ))}
                    </div>

                    <button onClick={() => navigate('/')} className="mt-6 w-full py-3 rounded-xl bg-white/5 text-white/50 font-semibold cursor-pointer border border-white/10 hover:bg-white/10 transition text-sm">
                        ← {lang === 'hi' ? 'वापस' : 'Back'}
                    </button>
                </div>
            )}

            {/* ═══ DigiLocker Fetch Animation ═══ */}
            {fetching && (
                <div className="fast-fade-in flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))', border: '2px solid rgba(99,102,241,0.3)' }}>
                        <span className="text-4xl animate-pulse">🔗</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                        {lang === 'hi' ? 'DigiLocker से डेटा ला रहे हैं...' : 'Fetching data from DigiLocker...'}
                    </h3>
                    <p className="text-white/40 text-sm mb-6 text-center max-w-xs">
                        {lang === 'hi' ? 'आधार, एड्रेस प्रूफ, और पहचान दस्तावेज सत्यापित हो रहे हैं' : 'Verifying Aadhaar, address proof, and identity documents'}
                    </p>

                    {/* Progress bar */}
                    <div className="w-64 h-2 rounded-full bg-white/10 overflow-hidden mb-3">
                        <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${fetchProgress}%`, background: 'linear-gradient(90deg, #6366F1, #8B5CF6)' }} />
                    </div>
                    <p className="text-indigo-400 text-sm font-mono">{Math.round(fetchProgress)}%</p>

                    {/* Fetch items animation */}
                    <div className="mt-6 space-y-2 w-64">
                        {[
                            { label: lang === 'hi' ? '✅ आधार सत्यापित' : '✅ Aadhaar Verified', delay: 0 },
                            { label: lang === 'hi' ? '✅ एड्रेस प्रूफ मिला' : '✅ Address Proof Found', delay: 1.2 },
                            { label: lang === 'hi' ? '✅ PAN कार्ड सत्यापित' : '✅ PAN Card Verified', delay: 2.4 },
                            { label: lang === 'hi' ? '⏳ राशन कार्ड ला रहे हैं...' : '⏳ Fetching Ration Card...', delay: 3.5 },
                        ].map((item, i) => (
                            <div key={i} className="text-sm font-medium fast-fade-in"
                                style={{ color: fetchProgress > (i + 1) * 22 ? '#34D399' : 'rgba(255,255,255,0.3)', animationDelay: `${item.delay}s` }}>
                                {fetchProgress > (i + 1) * 22 ? item.label : '⬜ ' + item.label.slice(2)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ STEP 2: Pre-filled Form ═══ */}
            {step === 2 && (
                <div className="fast-fade-in">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-3xl">{selectedType?.icon}</span>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {lang === 'hi' ? `नया ${selectedType?.labelHi} कनेक्शन` : `New ${selectedType?.label} Connection`}
                            </h2>
                            <p className="text-white/40 text-xs">{selectedType?.provider}</p>
                        </div>
                    </div>

                    {/* DigiLocker success badge */}
                    <div className="rounded-xl p-3 mb-5 flex items-center gap-3"
                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <span className="text-xl">🔗</span>
                        <div>
                            <p className="text-green-400 font-bold text-sm">
                                {lang === 'hi' ? 'DigiLocker से डेटा सफलतापूर्वक आया!' : 'Data fetched from DigiLocker!'}
                            </p>
                            <p className="text-green-400/50 text-xs">
                                {lang === 'hi' ? 'नीचे जानकारी जांचें और ज़रूरत हो तो बदलें' : 'Review info below and edit if needed'}
                            </p>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        {[
                            { key: 'fullName', label: lang === 'hi' ? 'पूरा नाम' : 'Full Name', icon: '👤', locked: true },
                            { key: 'fatherName', label: lang === 'hi' ? 'पिता का नाम' : "Father's Name", icon: '👨', locked: true },
                            { key: 'aadhaarNo', label: lang === 'hi' ? 'आधार नंबर' : 'Aadhaar No.', icon: '🪪', locked: true },
                            { key: 'mobile', label: lang === 'hi' ? 'मोबाइल नंबर' : 'Mobile Number', icon: '📱', locked: false },
                            { key: 'email', label: 'Email', icon: '📧', locked: false },
                            { key: 'address', label: lang === 'hi' ? 'पता' : 'Address', icon: '🏠', locked: false },
                        ].map(field => (
                            <div key={field.key} className="glass-card rounded-xl p-4">
                                <label className="flex items-center gap-2 text-white/50 text-xs mb-1.5 font-medium">
                                    <span>{field.icon}</span> {field.label}
                                    {field.locked && <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399' }}>DigiLocker ✓</span>}
                                </label>
                                <input
                                    type="text"
                                    value={formData[field.key]}
                                    onChange={e => handleFormChange(field.key, e.target.value)}
                                    readOnly={field.locked}
                                    className="w-full bg-transparent text-white font-semibold text-sm outline-none border-0 p-0"
                                    style={{ opacity: field.locked ? 0.6 : 1 }}
                                />
                            </div>
                        ))}

                        {/* Property Type & Load Category */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="glass-card rounded-xl p-4">
                                <label className="text-white/50 text-xs mb-2 block font-medium">
                                    🏗️ {lang === 'hi' ? 'संपत्ति प्रकार' : 'Property Type'}
                                </label>
                                <select value={formData.propertyType} onChange={e => handleFormChange('propertyType', e.target.value)}
                                    className="w-full bg-transparent text-white font-semibold text-sm outline-none border-0 cursor-pointer">
                                    <option value="residential" className="bg-gray-900">{lang === 'hi' ? 'आवासीय' : 'Residential'}</option>
                                    <option value="commercial" className="bg-gray-900">{lang === 'hi' ? 'व्यावसायिक' : 'Commercial'}</option>
                                    <option value="industrial" className="bg-gray-900">{lang === 'hi' ? 'औद्योगिक' : 'Industrial'}</option>
                                    <option value="agricultural" className="bg-gray-900">{lang === 'hi' ? 'कृषि' : 'Agricultural'}</option>
                                </select>
                            </div>
                            <div className="glass-card rounded-xl p-4">
                                <label className="text-white/50 text-xs mb-2 block font-medium">
                                    ⚡ {lang === 'hi' ? 'लोड श्रेणी' : 'Load Category'}
                                </label>
                                <select value={formData.loadCategory} onChange={e => handleFormChange('loadCategory', e.target.value)}
                                    className="w-full bg-transparent text-white font-semibold text-sm outline-none border-0 cursor-pointer">
                                    <option value="domestic" className="bg-gray-900">{lang === 'hi' ? 'घरेलू (1-5 kW)' : 'Domestic (1-5 kW)'}</option>
                                    <option value="small" className="bg-gray-900">{lang === 'hi' ? 'छोटा (5-20 kW)' : 'Small (5-20 kW)'}</option>
                                    <option value="medium" className="bg-gray-900">{lang === 'hi' ? 'मध्यम (20-100 kW)' : 'Medium (20-100 kW)'}</option>
                                    <option value="large" className="bg-gray-900">{lang === 'hi' ? 'बड़ा (100+ kW)' : 'Large (100+ kW)'}</option>
                                </select>
                            </div>
                        </div>

                        {/* Remarks */}
                        <div className="glass-card rounded-xl p-4">
                            <label className="text-white/50 text-xs mb-1.5 block font-medium">
                                📝 {lang === 'hi' ? 'अतिरिक्त टिप्पणी (वैकल्पिक)' : 'Additional Remarks (optional)'}
                            </label>
                            <textarea
                                value={formData.remarks}
                                onChange={e => handleFormChange('remarks', e.target.value)}
                                placeholder={lang === 'hi' ? 'कोई विशेष अनुरोध...' : 'Any special request...'}
                                rows={2}
                                className="w-full bg-transparent text-white text-sm outline-none border-0 p-0 resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button onClick={() => { setStep(1); setConnType(null); }}
                            className="flex-1 py-3.5 rounded-xl bg-white/5 text-white/50 font-bold cursor-pointer border border-white/10 hover:bg-white/10 transition text-sm">
                            ← {lang === 'hi' ? 'वापस' : 'Back'}
                        </button>
                        <button onClick={handleSubmitForm}
                            className="flex-[2] py-3.5 rounded-xl font-bold cursor-pointer border-0 text-white text-sm transition hover:scale-[1.01] active:scale-[0.99]"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                            {lang === 'hi' ? 'आगे बढ़ें — दस्तावेज जांचें →' : 'Next — Verify Documents →'}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ STEP 3: Document Verification ═══ */}
            {step === 3 && (
                <div className="fast-fade-in">
                    <h2 className="text-xl font-bold text-white mb-1">
                        📋 {lang === 'hi' ? 'दस्तावेज सत्यापन' : 'Document Verification'}
                    </h2>
                    <p className="text-white/40 text-sm mb-6">
                        {lang === 'hi' ? 'नीचे दस्तावेजों की स्थिति देखें और ज़रूरी दस्तावेज अपलोड करें' : 'Review document status and upload required documents'}
                    </p>

                    <div className="space-y-3">
                        {REQUIRED_DOCS.map((doc, i) => {
                            const isUploaded = uploadedDocs[doc.key];
                            const isVerified = doc.status === 'verified';
                            const isAuto = doc.status === 'auto';
                            const done = isVerified || isUploaded || isAuto;

                            return (
                                <div key={doc.key} className="glass-card rounded-xl p-4 flex items-center justify-between fast-scale-in"
                                    style={{ animationDelay: `${i * 0.08}s` }}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{doc.icon}</span>
                                        <div>
                                            <p className="text-white font-semibold text-sm">{lang === 'hi' ? doc.labelHi : doc.label}</p>
                                            <p className="text-xs" style={{ color: done ? '#34D399' : '#FBBF24' }}>
                                                {done
                                                    ? (isAuto ? (lang === 'hi' ? '📄 स्वतः-जनित' : '📄 Auto-generated') : `✅ ${doc.source}`)
                                                    : `⏳ ${doc.source}`}
                                            </p>
                                        </div>
                                    </div>

                                    {doc.status === 'pending' && !isUploaded && (
                                        <button onClick={() => handleDocUpload(doc.key)}
                                            className="px-4 py-2 rounded-lg font-bold text-xs cursor-pointer border-0 text-white transition hover:scale-105 active:scale-95"
                                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                                            📤 {lang === 'hi' ? 'अपलोड' : 'Upload'}
                                        </button>
                                    )}
                                    {(isVerified || isUploaded || isAuto) && (
                                        <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                                            style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399' }}>
                                            ✓ {lang === 'hi' ? 'पूर्ण' : 'Done'}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Fee summary */}
                    <div className="glass-card rounded-xl p-5 mt-5">
                        <h3 className="text-white font-bold text-sm mb-3">
                            💰 {lang === 'hi' ? 'शुल्क सारांश' : 'Fee Summary'}
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-white/50">{lang === 'hi' ? 'आवेदन शुल्क' : 'Application Fee'}</span><span className="text-white font-bold">₹200</span></div>
                            <div className="flex justify-between"><span className="text-white/50">{lang === 'hi' ? 'सुरक्षा जमा' : 'Security Deposit'}</span><span className="text-white font-bold">₹1,500</span></div>
                            <div className="flex justify-between"><span className="text-white/50">{lang === 'hi' ? 'कनेक्शन चार्ज' : 'Connection Charge'}</span><span className="text-white font-bold">₹500</span></div>
                            <div className="border-t border-white/10 pt-2 flex justify-between">
                                <span className="text-white font-bold">{lang === 'hi' ? 'कुल' : 'Total'}</span>
                                <span className="text-indigo-400 font-black text-lg">₹2,200</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setStep(2)}
                            className="flex-1 py-3.5 rounded-xl bg-white/5 text-white/50 font-bold cursor-pointer border border-white/10 hover:bg-white/10 transition text-sm">
                            ← {lang === 'hi' ? 'वापस' : 'Back'}
                        </button>
                        <button onClick={handleFinalSubmit} disabled={!allDocsReady}
                            className="flex-[2] py-3.5 rounded-xl font-bold cursor-pointer border-0 text-white text-sm transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: allDocsReady ? 'linear-gradient(135deg, #059669, #10B981)' : 'rgba(255,255,255,0.1)' }}>
                            {allDocsReady
                                ? (lang === 'hi' ? '✅ आवेदन जमा करें' : '✅ Submit Application')
                                : (lang === 'hi' ? '⏳ सभी दस्तावेज अपलोड करें' : '⏳ Upload All Documents')}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ STEP 4: Confirmation ═══ */}
            {step === 4 && (
                <div className="fast-fade-in text-center py-8">
                    {/* Success animation */}
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.15))', border: '3px solid rgba(16,185,129,0.4)' }}>
                        <span className="text-5xl">🎉</span>
                    </div>

                    <h2 className="text-2xl font-black text-green-400 mb-2">
                        {lang === 'hi' ? 'आवेदन सफलतापूर्वक जमा!' : 'Application Submitted!'}
                    </h2>
                    <p className="text-white/50 text-sm mb-6">
                        {lang === 'hi' ? 'आपका नया कनेक्शन आवेदन दर्ज हो गया है' : 'Your new connection application has been registered'}
                    </p>

                    {/* Application Details Card */}
                    <div className="glass-card rounded-2xl p-6 text-left mb-6 max-w-md mx-auto">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-white/50 text-xs">{lang === 'hi' ? 'आवेदन संख्या' : 'Application No.'}</span>
                                <span className="text-indigo-400 font-black font-mono text-sm">{appNumber}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-white/50 text-xs">{lang === 'hi' ? 'कनेक्शन प्रकार' : 'Connection Type'}</span>
                                <span className="text-white font-bold text-sm">{selectedType?.icon} {selectedType?.label}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-white/50 text-xs">{lang === 'hi' ? 'आवेदक' : 'Applicant'}</span>
                                <span className="text-white font-bold text-sm">{formData.fullName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-white/50 text-xs">{lang === 'hi' ? 'प्रदाता' : 'Provider'}</span>
                                <span className="text-white/70 text-xs">{selectedType?.provider}</span>
                            </div>
                            <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                                <span className="text-white/50 text-xs">{lang === 'hi' ? 'भुगतान' : 'Payment'}</span>
                                <span className="text-green-400 font-black">₹2,200 ✓</span>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="glass-card rounded-2xl p-5 text-left mb-6 max-w-md mx-auto">
                        <h3 className="text-white font-bold text-sm mb-4">
                            📅 {lang === 'hi' ? 'अपेक्षित समय-सीमा' : 'Expected Timeline'}
                        </h3>
                        <div className="space-y-3">
                            {[
                                { step: lang === 'hi' ? 'आवेदन प्राप्त' : 'Application Received', time: lang === 'hi' ? 'आज' : 'Today', done: true, icon: '✅' },
                                { step: lang === 'hi' ? 'दस्तावेज सत्यापन' : 'Document Verification', time: lang === 'hi' ? '1-2 दिन' : '1-2 days', done: false, icon: '🔍' },
                                { step: lang === 'hi' ? 'साइट निरीक्षण' : 'Site Inspection', time: lang === 'hi' ? '3-5 दिन' : '3-5 days', done: false, icon: '🏗️' },
                                { step: lang === 'hi' ? 'कनेक्शन स्थापना' : 'Connection Installation', time: selectedType?.timeline || '7-10 days', done: false, icon: '⚡' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                                        style={{ background: item.done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)' }}>
                                        {item.icon}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white text-sm font-medium">{item.step}</p>
                                    </div>
                                    <span className="text-xs font-bold" style={{ color: item.done ? '#34D399' : 'rgba(255,255,255,0.3)' }}>
                                        {item.time}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 max-w-md mx-auto">
                        <button className="flex-1 py-3 rounded-xl font-bold cursor-pointer border-0 text-white text-sm transition hover:scale-[1.01]"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                            onClick={() => { /* mock PDF download */ alert(lang === 'hi' ? '📥 रसीद PDF डाउनलोड हो रही है...' : '📥 Downloading receipt PDF...'); }}>
                            📥 {lang === 'hi' ? 'रसीद डाउनलोड' : 'Download Receipt'}
                        </button>
                        <button onClick={() => navigate('/')}
                            className="flex-1 py-3 rounded-xl font-bold cursor-pointer border border-white/15 text-white/70 text-sm hover:bg-white/5 transition bg-transparent">
                            🏠 {lang === 'hi' ? 'होम' : 'Home'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
