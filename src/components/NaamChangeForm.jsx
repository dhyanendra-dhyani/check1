/**
 * ═══════════════════════════════════════════════════════════
 * NaamChangeForm — Name Change Request v1.0
 * User-friendly form for citizens to request name changes
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../utils/i18n';
import { saveOfflineComplaint } from '../utils/offlineSync';

const REQUEST_CATEGORIES = {
    en: [
        { label: 'Marriage', keywords: ['marriage', 'married', 'shaadi'] },
        { label: 'Divorce', keywords: ['divorce'] },
        { label: 'Correction', keywords: ['correction', 'mistake', 'error', 'galti'] },
        { label: 'Religious', keywords: ['religious', 'conversion'] },
        { label: 'Other', keywords: ['other'] }
    ],
    hi: [
        { label: 'विवाह', keywords: ['विवाह', 'शादी', 'marriage'] },
        { label: 'तलाक', keywords: ['तलाक', 'divorce'] },
        { label: 'सुधार', keywords: ['सुधार', 'गलती', 'correction'] },
        { label: 'धार्मिक', keywords: ['धार्मिक', 'conversion'] },
        { label: 'अन्य', keywords: ['अन्य', 'other'] }
    ]
};

export default function NaamChangeForm({ lang, isOnline }) {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [step, setStep] = useState('reason');  // reason | details | document | done
    const [category, setCategory] = useState(null);
    const [currentName, setCurrentName] = useState('');
    const [newName, setNewName] = useState('');
    const [reason, setReason] = useState('');
    const [document, setDocument] = useState(null);
    const [requestId, setRequestId] = useState('');

    const categories = REQUEST_CATEGORIES[lang] || REQUEST_CATEGORIES.en;

    const generateRequestId = () => `NR${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const handleVoiceNewName = useCallback((transcript) => {
        setNewName(transcript);
    }, []);

    const handleDocumentUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setDocument(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const submitRequest = async () => {
        if (!currentName || !newName || !category) {
            alert(lang === 'hi' ? 'कृपया सभी विवरण भरें' : 'Please fill all details');
            return;
        }

        const id = generateRequestId();
        setRequestId(id);
        setStep('done');

        await saveOfflineComplaint({
            ticketId: id,
            service: 'naam_badalna',
            currentName,
            newName,
            category: category.label,
            reason,
            hasDocument: !!document,
            timestamp: new Date().toISOString(),
            synced: isOnline,
        });
    };

    const handleDownloadReceipt = () => {
        const receiptText = `
NAME CHANGE REQUEST RECEIPT
═══════════════════════════════════
Request ID: ${requestId}
Date: ${new Date().toLocaleString('en-IN')}
Status: Submitted

Current Name: ${currentName}
New Name: ${newName}
Reason: ${category.label}
Description: ${reason}

Next Steps:
1. Your request has been submitted
2. Processing time: 7-15 working days
3. You will receive SMS/Email updates
4. Visit office with supporting documents

Keep this receipt for your records.
═══════════════════════════════════
        `;

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(receiptText));
        element.setAttribute('download', `naam-change-${requestId}.txt`);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="min-h-[calc(100vh-160px)] flex flex-col items-center px-4 py-6 fast-fade-in">
            <div className="w-full max-w-xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => step === 'reason' ? navigate(-1) : setStep('reason')}
                        className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white cursor-pointer text-lg hover:bg-white/10 transition-colors"
                    >
                        ←
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-white">
                            {lang === 'hi' ? '✏️ नाम बदलना' : '✏️ Change Name'}
                        </h3>
                        <p className="text-white/40 text-xs">
                            {lang === 'hi' ? 'Step ' : 'Step '}
                            {step === 'reason' ? '1 of 3' : step === 'details' ? '2 of 3' : step === 'document' ? '3 of 3' : 'Done'}
                        </p>
                    </div>
                </div>

                {/* Step 1: Reason */}
                {step === 'reason' && (
                    <div className="space-y-4 fast-fade-in">
                        <p className="text-white/60 text-sm">
                            {lang === 'hi' ? 'नाम बदलने का कारण बताइए' : 'What is the reason for name change?'}
                        </p>
                        <div className="grid gap-3">
                            {categories.map((cat) => (
                                <button
                                    key={cat.label}
                                    onClick={() => { setCategory(cat); setStep('details'); }}
                                    className={`p-4 rounded-xl text-left cursor-pointer transition-all border ${
                                        category?.label === cat.label
                                            ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                                    }`}
                                >
                                    <p className="font-semibold">{cat.label}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Details */}
                {step === 'details' && (
                    <div className="space-y-4 fast-fade-in">
                        <div>
                            <label className="block text-white/60 text-sm mb-2">
                                {lang === 'hi' ? 'वर्तमान नाम' : 'Current Name'}
                            </label>
                            <input
                                type="text"
                                value={currentName}
                                onChange={(e) => setCurrentName(e.target.value)}
                                placeholder={lang === 'hi' ? 'आपका वर्तमान नाम' : 'Your current name'}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-indigo-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-white/60 text-sm mb-2">
                                {lang === 'hi' ? 'नया नाम' : 'New Name'}
                            </label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={lang === 'hi' ? 'नया नाम बताइए' : 'Your new name'}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-indigo-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-white/60 text-sm mb-2">
                                {lang === 'hi' ? 'विवरण (वैकल्पिक)' : 'Details (Optional)'}
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder={lang === 'hi' ? 'और विवरण दें...' : 'Additional details...'}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-indigo-500/50 resize-none"
                                rows={4}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('reason')}
                                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold cursor-pointer hover:bg-white/10 transition-colors"
                            >
                                {lang === 'hi' ? 'पीछे' : 'Back'}
                            </button>
                            <button
                                onClick={() => setStep('document')}
                                className="flex-1 py-3 rounded-xl gradient-primary text-white font-semibold cursor-pointer"
                            >
                                {lang === 'hi' ? 'अगले' : 'Next'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Document */}
                {step === 'document' && (
                    <div className="space-y-4 fast-fade-in">
                        <p className="text-white/60 text-sm">
                            {lang === 'hi' ? 'विवाह प्रमाणपत्र, तलाक डिक्री, आदि अपलोड करें' : 'Upload supporting documents (Marriage certificate, Divorce decree, etc)'}
                        </p>

                        {!document && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full p-6 rounded-xl border-2 border-dashed border-white/20 text-center text-white/60 hover:text-white hover:border-indigo-500/50 cursor-pointer transition-all"
                            >
                                <span className="text-3xl block mb-2">📄</span>
                                <p className="font-semibold">
                                    {lang === 'hi' ? 'दस्तावेज़ अपलोड करें' : 'Upload Document'}
                                </p>
                                <p className="text-xs mt-1">{lang === 'hi' ? 'या छोड़ दें' : 'or Skip'}</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleDocumentUpload}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                />
                            </button>
                        )}

                        {document && (
                            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between">
                                <span className="text-white/60">📄 {lang === 'hi' ? 'दस्तावेज़ अपलोड किया गया' : 'Document uploaded'}</span>
                                <button
                                    onClick={() => setDocument(null)}
                                    className="text-white/40 hover:text-white cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('details')}
                                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold cursor-pointer hover:bg-white/10 transition-colors"
                            >
                                {lang === 'hi' ? 'पीछे' : 'Back'}
                            </button>
                            <button
                                onClick={submitRequest}
                                className="flex-1 py-3 rounded-xl gradient-primary text-white font-semibold cursor-pointer"
                            >
                                {lang === 'hi' ? 'जमा करें' : 'Submit'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Success */}
                {step === 'done' && (
                    <div className="text-center space-y-4 fast-fade-in">
                        <div className="w-20 h-20 mx-auto bg-indigo-500/20 border-2 border-indigo-500/50 rounded-full flex items-center justify-center">
                            <span className="text-5xl">✅</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white">
                            {lang === 'hi' ? 'अनुरोध जमा हुआ' : 'Request Submitted'}
                        </h2>
                        <p className="text-white/60 text-sm">
                            {lang === 'hi'
                                ? `आपका अनुरोध सफलतापूर्वक जमा हो गया है। आपकी अनुरोध संख्या:`
                                : 'Your name change request has been submitted successfully. Your request ID:'
                            }
                        </p>
                        <p className="text-lg font-mono font-bold text-indigo-400">{requestId}</p>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left text-sm text-white/60">
                            <p className="font-semibold text-white mb-2">
                                {lang === 'hi' ? '📋 अगले चरण:' : '📋 Next Steps:'}
                            </p>
                            <ul className="space-y-2 text-xs">
                                <li>✓ {lang === 'hi' ? 'आपकी अनुरोध जमा हो गई है' : 'Your request has been submitted'}</li>
                                <li>✓ {lang === 'hi' ? 'प्रक्रिया समय: 7-15 कार्य दिन' : 'Processing time: 7-15 working days'}</li>
                                <li>✓ {lang === 'hi' ? 'आपको SMS/ईमेल अपडेट मिलेंगे' : 'You will receive SMS/Email updates'}</li>
                                <li>✓ {lang === 'hi' ? 'कार्यालय में आवश्यक दस्तावेज़ लाएं' : 'Visit office with supporting documents'}</li>
                            </ul>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleDownloadReceipt}
                                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold cursor-pointer hover:bg-white/10 transition-colors"
                            >
                                📥 {lang === 'hi' ? 'रसीद डाउनलोड करें' : 'Download Receipt'}
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="flex-1 py-3 rounded-xl gradient-primary text-white font-semibold cursor-pointer"
                            >
                                {lang === 'hi' ? 'होम' : 'Home'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
