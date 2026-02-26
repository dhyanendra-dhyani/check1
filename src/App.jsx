/**
 * ═══════════════════════════════════════════════════════════
 * SUVIDHA Setu — Main App v4.0 (Voice-First)
 *
 * The website IS the assistant. VoiceAgent wraps everything
 * as a context provider. Screens activate voice via useVoice().
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { t } from './utils/i18n';

/* ── Lazy-loaded screens ──────────────────────── */
const IdleScreen = lazy(() => import('./components/IdleScreen'));
const GatewayScreen = lazy(() => import('./components/GatewayScreen'));
const AuthScreen = lazy(() => import('./components/AuthScreen'));
const CitizenDashboard = lazy(() => import('./components/CitizenDashboard'));
const HomeScreen = lazy(() => import('./components/HomeScreen'));
const BillPayment = lazy(() => import('./components/BillPayment'));
const ComplaintForm = lazy(() => import('./components/ComplaintForm'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const OfflineIndicator = lazy(() => import('./components/OfflineIndicator'));
const VoiceAgent = lazy(() => import('./components/VoiceAgent'));

function Loader() {
  return (
    <div className="fixed inset-0 bg-[#0F172A] flex items-center justify-center z-50">
      <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppContent() {
  const [screen, setScreen] = useState('idle');
  const [lang, setLang] = useState('en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [citizen, setCitizen] = useState(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [devLogs, setDevLogs] = useState([]);
  const [showSOS, setShowSOS] = useState(false);
  const idleTimerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const addLog = useCallback((msg) => {
    setDevLogs((p) => [{ time: new Date().toLocaleTimeString(), message: msg }, ...p.slice(0, 19)]);
  }, []);

  /* Idle timeout */
  const resetIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (screen !== 'idle' && location.pathname !== '/admin') {
        setScreen('idle'); setCitizen(null); navigate('/'); addLog('Idle reset');
      }
    }, 120000);
  }, [screen, location.pathname, navigate, addLog]);

  useEffect(() => {
    const h = () => resetIdle();
    ['touchstart', 'click', 'keydown'].forEach(e => window.addEventListener(e, h, { passive: true }));
    resetIdle();
    return () => {
      ['touchstart', 'click', 'keydown'].forEach(e => window.removeEventListener(e, h));
      clearTimeout(idleTimerRef.current);
    };
  }, [resetIdle]);

  useEffect(() => {
    const h = (e) => { if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); setShowDevPanel(p => !p); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const handlePath = useCallback((path) => {
    if (path === 'guest') { setScreen('guest'); navigate('/'); addLog('Guest'); }
    else { setScreen('citizen-auth'); addLog('Citizen login'); }
  }, [navigate, addLog]);

  const handleAuth = useCallback((data) => {
    setCitizen(data); setScreen('citizen-dashboard'); navigate('/'); addLog(`Auth: ${data.name}`);
  }, [navigate, addLog]);

  const goHome = useCallback(() => {
    if (screen === 'citizen-dashboard' || screen === 'guest') navigate('/');
    else { setScreen('idle'); setCitizen(null); navigate('/'); }
  }, [screen, navigate]);

  const showPersistent = screen === 'guest' || screen === 'citizen-dashboard';

  return (
    <Suspense fallback={<Loader />}>
      <VoiceAgent
        lang={lang}
        setLang={setLang}
        screen={screen}
        setScreen={setScreen}
        voiceMode={voiceMode}
        navigate={navigate}
        setCitizen={setCitizen}
        addLog={addLog}
      >
        <div className="min-h-screen flex flex-col" style={{ background: '#0F172A' }}>

          {/* ── Prototype Marquee Ticker ────────────── */}
          {screen !== 'idle' && (
            <div className="proto-ticker">
              <div className="proto-ticker-inner">
                <span>🔧 PROTOTYPE DEMONSTRATION — This is a UI prototype. All data is simulated. Enter any number as Consumer ID.&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;</span>
                <span>🔧 PROTOTYPE DEMONSTRATION — This is a UI prototype. All data is simulated. Enter any number as Consumer ID.&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;</span>
              </div>
            </div>
          )}

          <Suspense fallback={<Loader />}>
            {screen === 'idle' && (
              <IdleScreen onStart={(isVoice) => { setVoiceMode(!!isVoice); setScreen('gateway'); addLog(isVoice ? 'Voice mode' : 'Touch mode'); }} />
            )}
            {screen === 'gateway' && (
              <GatewayScreen lang={lang} setLang={setLang} onSelectPath={handlePath} />
            )}
            {screen === 'citizen-auth' && (
              <AuthScreen lang={lang} onAuthenticated={handleAuth} onBack={() => setScreen('gateway')} />
            )}

            {showPersistent && (
              <>
                <header className="header-bar no-print sticky top-0 z-40" style={{ top: screen !== 'idle' ? '24px' : 0 }}>
                  <div className="flex h-1">
                    <div className="flex-1" style={{ background: '#FF9933' }} />
                    <div className="flex-1" style={{ background: '#FFFFFF' }} />
                    <div className="flex-1" style={{ background: '#138808' }} />
                  </div>
                  <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
                    <button onClick={goHome} className="flex items-center gap-3 cursor-pointer bg-transparent border-0 p-0">
                      <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center">
                        <span className="text-white text-base font-black">S</span>
                      </div>
                      <div className="hidden md:block">
                        <h1 className="text-base font-black text-white leading-tight">{t(lang, 'appName')}</h1>
                        <p className="text-xs text-white/40">{t(lang, 'tagline')}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${screen === 'citizen-dashboard'
                        ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                        : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                        }`}>
                        {screen === 'citizen-dashboard' ? '🏛️ Citizen' : '⚡ Guest'}
                      </span>
                      <select value={lang} onChange={e => setLang(e.target.value)}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm cursor-pointer focus:outline-none">
                        <option value="en" className="bg-gray-900">EN</option>
                        <option value="hi" className="bg-gray-900">हिं</option>
                        <option value="pa" className="bg-gray-900">ਪੰ</option>
                      </select>
                      <Suspense fallback={null}>
                        <OfflineIndicator lang={lang} onOnline={() => setIsOnline(true)} onOffline={() => setIsOnline(false)} />
                      </Suspense>
                    </div>
                  </div>
                </header>

                <main className="flex-1">
                  <Routes location={location}>
                    <Route path="/" element={
                      screen === 'citizen-dashboard'
                        ? <CitizenDashboard lang={lang} citizen={citizen} onLogout={() => { setCitizen(null); setScreen('gateway'); }} isOnline={isOnline} />
                        : <HomeScreen lang={lang} setLang={setLang} onBack={() => setScreen('gateway')} />
                    } />
                    <Route path="/bill/:serviceType" element={<BillPayment lang={lang} isOnline={isOnline} />} />
                    <Route path="/complaint" element={<ComplaintForm lang={lang} isOnline={isOnline} />} />
                    <Route path="/admin" element={<AdminDashboard lang={lang} />} />
                  </Routes>
                </main>

                <footer className="border-t border-white/5 py-2 text-center no-print">
                  <p className="text-white/20 text-xs">C-DAC SUVIDHA 2026 • {t(lang, 'poweredBy')} • v4.0</p>
                </footer>
              </>
            )}
          </Suspense>

          {/* ── Persistent: Home, SOS ─────────────── */}
          {showPersistent && (
            <>
              {location.pathname !== '/' && (
                <button onClick={goHome}
                  className="fixed z-50 w-10 h-10 rounded-full bg-slate-800 border border-white/15 flex items-center justify-center text-base cursor-pointer"
                  style={{ top: '68px', left: '12px' }}>🏠</button>
              )}
              <button onClick={() => setShowSOS(true)}
                className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer border-2 border-red-500/50"
                style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>
                <span className="text-white font-black text-xs">SOS</span>
              </button>
            </>
          )}

          {/* SOS Modal */}
          {showSOS && (
            <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-6 fast-fade-in" onClick={() => setShowSOS(false)}>
              <div onClick={e => e.stopPropagation()} className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center fast-scale-in">
                <span className="text-4xl block mb-3">🆘</span>
                <h3 className="text-xl font-bold text-white mb-2">Need Help?</h3>
                <p className="text-white/50 text-sm mb-4">{isOnline ? 'Video call or help video' : 'Offline — watch help video'}</p>
                <div className="space-y-2">
                  {isOnline && <button className="w-full py-2.5 rounded-xl gradient-primary text-white font-bold cursor-pointer border-0">📹 Video Call</button>}
                  <button className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white cursor-pointer">📺 Help Video</button>
                  <button onClick={() => setShowSOS(false)} className="w-full py-2 text-white/40 text-sm cursor-pointer bg-transparent border-0">Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Dev Panel */}
          {showDevPanel && (
            <div className="fixed top-0 right-0 bottom-0 w-72 bg-gray-950 text-gray-100 shadow-2xl z-[70] overflow-y-auto border-l border-white/5 fast-slide-left" style={{ fontSize: '0.75rem' }}>
              <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-white">🛠️ Dev</h3>
                <button onClick={() => setShowDevPanel(false)} className="text-white/40 hover:text-white cursor-pointer bg-transparent border-0">✕</button>
              </div>
              <div className="p-2 border-b border-white/5 space-y-1">
                <button onClick={() => { setScreen('idle'); navigate('/'); }} className="w-full py-1 px-2 bg-yellow-900/50 text-yellow-100 rounded cursor-pointer text-xs border-0">♻️ Reset</button>
                <button onClick={() => { setScreen('gateway'); navigate('/'); }} className="w-full py-1 px-2 bg-indigo-900/50 text-indigo-100 rounded cursor-pointer text-xs border-0">🚪 Gateway</button>
              </div>
              <div className="p-2 font-mono text-xs">
                <p>Screen: <span className="text-indigo-400">{screen}</span> | Lang: <span className="text-green-400">{lang}</span></p>
                <p>Online: <span className={isOnline ? 'text-green-400' : 'text-red-400'}>{String(isOnline)}</span></p>
              </div>
              <div className="p-2 max-h-40 overflow-y-auto">
                {devLogs.map((l, i) => (
                  <div key={i} className="font-mono py-0.5 text-white/30">{l.time} {l.message}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </VoiceAgent>
    </Suspense>
  );
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>;
}
