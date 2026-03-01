# SUVIDHA Setu - Complete Architecture Guide

## 🎯 SHORT ANSWER

| Responsibility | File |
|---|---|
| **ALL Navigation** | [src/App.jsx](src/App.jsx) |
| **ALL Voice Communications** | [src/components/VoiceAgent.jsx](src/components/VoiceAgent.jsx) |

---

## 📱 ALL PAGES LIST (18 Total)

### **Entry Points**
1. **[src/main.jsx](src/main.jsx)** - React app entry point with DOM root

### **Core Container Component**
2. **[src/App.jsx](src/App.jsx)** ⭐ **NAVIGATION HUB**
   - Manages all routing & screen transitions
   - Handles state: lang, screen, citizen auth, blind mode, voice mode
   - Routes: `/`, `/bill/:serviceType`, `/complaint`, `/name-change`, `/new-connection`, `/admin`
   - Uses React Router for URL-based navigation
   - Passes state to all child components

---

## 🎤 VOICE-ENABLED PAGES

### **Voice Master Component**
3. **[src/components/VoiceAgent.jsx](src/components/VoiceAgent.jsx)** ⭐ **VOICE HUB** (882 lines)
   - **Wraps entire app** as context provider
   - **Web Speech API** integration (RecognitionAPI + SpeechSynthesisAPI)
   - **3-layer pipeline:**
     - Layer 1: QUICK_LOOKUP (instant single/multi-word match)
     - Layer 2: KB (fuzzy search with fuse.js)
     - Layer 3: Gemini API (fallback for unmatched queries)
   - **Features:**
     - Speech deduplication ("gas gas" → "gas")
     - Sentence queue assembly (fragments → complete)
     - Transcript debouncing (300ms window)
     - Filler word removal ("mai bijli bill" → "bijli bill")
     - TTS (Text-To-Speech) playback
     - Blind mode greeter narration
     - 11 regional language support
   - **Call flow:** `recognition → removeFillerWords → processSpeechInput → executeAction`

4. **[src/components/VoiceContext.jsx](src/components/VoiceContext.jsx)**
   - React Context for voice state management
   - Provides: `useVoice()` hook to all screens
   - Exposes: `speakText()`, `toggleVoice()`, `isListening`

5. **[src/components/VoiceButton.jsx](src/components/VoiceButton.jsx)**
   - Floating mic button in top-right corner
   - Toggles voice mode on/off
   - Visual feedback: animated listening bars

---

## 📄 SCREEN/PAGE COMPONENTS (13 Total)

### **Authentication & Gateway**
6. **[src/components/IdleScreen.jsx](src/components/IdleScreen.jsx)**
   - Initial landing page
   - Language selection (EN, Hindi, Punjabi)
   - "Press to start" or speak "hello"

7. **[src/components/GatewayScreen.jsx](src/components/GatewayScreen.jsx)**
   - Citizen vs Guest choice
   - "Are you a citizen with Aadhaar?" branching
   - Routes to AuthScreen (citizen) or HomeScreen (guest)

8. **[src/components/AuthScreen.jsx](src/components/AuthScreen.jsx)**
   - 3 login methods: Thumb (biometric), Iris scan, OTP
   - Mock citizen: Vivek Kumar (Aadhaar XXXX-XXXX-4829)
   - Sets citizen state on success

---

### **Main Service Pages**
9. **[src/components/HomeScreen.jsx](src/components/HomeScreen.jsx)** ✅ Has Voice
   - Main menu for guest users
   - 4 service buttons: Electricity, Water, Gas, Property Tax
   - Complaint filing link
   - Voice commands: "bijli bill", "pani bill", "gas bill", "shikayat"

10. **[src/components/BillPayment.jsx](src/components/BillPayment.jsx)** ✅ Has Voice (322 lines)
    - **Multi-step bill payment flow:**
      - Step 1: Consumer number input (numpad + QR scan)
      - Step 2: Fetch bill details
      - Step 3: Payment method selection (UPI/Card/Cash)
      - Step 4: Success screen + receipt download
    - **Features:**
      - Alphanumeric ID spelling ("365GJ" → "three six five G J")
      - OTP input for verification
      - Mock payment processing
      - PDF receipt generation
    - **Voice commands:** "consumer number", "fetch bill", "pay now", "upi", "cash"
    - **Service types:** `/bill/electricity`, `/bill/water`, `/bill/gas`

11. **[src/components/ComplaintForm.jsx](src/components/ComplaintForm.jsx)** ✅ Has Voice
    - **3-step complaint filing:**
      - Step 1: Category selection (6 types)
      - Step 2: Details + photo upload
      - Step 3: Submission confirmation
    - **Categories:**
      1. Broken streetlight
      2. Water supply
      3. Garbage collection
      4. Voltage fluctuation
      5. Road damage
      6. Other
    - **Voice commands:** "shikayat", complaint category names, "submit"

12. **[src/components/NaamChangeForm.jsx](src/components/NaamChangeForm.jsx)** ✅ Has Voice (260 lines)
    - **Citizen service - requires Aadhaar auth**
    - **3-step form:**
      - Step 1: Reason selection (marriage, correction, court order, etc.)
      - Step 2: Details entry + document selection
      - Step 3: Document upload + receipt download
    - **Voice commands:** "naam badalna", "submit", document type names
    - **Route:** `/name-change`

13. **[src/components/CitizenDashboard.jsx](src/components/CitizenDashboard.jsx)** ✅ Has Voice
    - **Post-login dashboard for authenticated citizens**
    - **3 sections:**
      - My Bills (pending + paid history)
      - My Complaints (with status tracking)
      - Additional Services (name change, new connection, certificate)
    - **Features:**
      - Pending intent banner (highlights requested action)
      - Quick navigation to forms
    - **Voice commands:** Service names, "logout"

---

### **Additional Services**
14. **[src/components/NewConnectionForm.jsx](src/components/NewConnectionForm.jsx)**
    - New Bill Electricity/Water/Gas connection application
    - Multi-step form for new connection requests
    - **Route:** `/new-connection`

15. **[src/components/AdminDashboard.jsx](src/components/AdminDashboard.jsx)**
    - Official analytics & monitoring
    - Transaction history, complaint stats
    - Real-time kiosk status
    - **Route:** `/admin`

---

### **Utility & Helper Components**
16. **[src/components/ScreensaverScreen.jsx](src/components/ScreensaverScreen.jsx)**
    - Animated screensaver when idle > 2 min
    - Shows animated logo + "Touch to start" text
    - Idle timeout resets: 120 seconds

17. **[src/components/OfflineIndicator.jsx](src/components/OfflineIndicator.jsx)**
    - Sticky header badge: "🔴 OFFLINE" or "🟢 ONLINE"
    - Monitors navigator.onLine
    - Shows in header when no internet

---

## 💾 UTILITY/HELPER FILES (Non-JSX)

### **Voice & Speech Processing**
| File | Purpose | Lines | Key Functions |
|---|---|---|---|
| [src/utils/speechProcessor.js](src/utils/speechProcessor.js) | Speech pipeline orchestration | 319 | `cleanSpeechInput()`, `removeFillerWords()`, `processSpeechInput()`, `TranscriptDebouncer`, `SentenceQueue`, `quickLookupSearch()` |
| [src/utils/voiceKnowledgeBase.js](src/utils/voiceKnowledgeBase.js) | Q&A knowledge base | 1,140 | `COMMON_QA`, `EXPANDED_QA`, `MEGA_QA`, `findCommonAnswer()` |
| [src/utils/voiceCommands.js](src/utils/voiceCommands.js) | Command parsing & execution | TBD | `parseVoiceCommand()`, keyword mappings |
| [src/utils/voiceFlowEngine.js](src/utils/voiceFlowEngine.js) | Multi-step conversation flows | TBD | Flow state management |

### **APIs & Services**
| File | Purpose |
|---|---|
| [src/utils/geminiService.js](src/utils/geminiService.js) | Google Gemini 2.0 API (fallback AI) |
| [src/utils/apiClient.js](src/utils/apiClient.js) | Backend HTTP client |

### **Utilities**
| File | Purpose |
|---|---|
| [src/utils/audioService.js](src/utils/audioService.js) | Sound effects (click, success) |
| [src/utils/i18n.js](src/utils/i18n.js) | Multi-language translation (EN, HI, PA, BN, TA, TE, etc.) |
| [src/utils/regionalLanguages.js](src/utils/regionalLanguages.js) | Regional language support |
| [src/utils/pdfGenerator.js](src/utils/pdfGenerator.js) | Receipt & document PDF generation |
| [src/utils/offlineSync.js](src/utils/offlineSync.js) | Offline transaction queuing & sync |
| [src/utils/mockData.js](src/utils/mockData.js) | Demo data (mock citizens, bills, complaints) |
| [src/utils/navigationMap.js](src/utils/navigationMap.js) | Route definitions & mappings |
| [src/hooks/useSpeech.js](src/hooks/useSpeech.js) | Custom React hook for voice operations |

### **Styling**
| File | Purpose |
|---|---|
| [src/index.css](src/index.css) | Global styles, Tailwind config, animations |

---

## 🔄 DATA FLOW: How Navigation & Voice Interact

```
┌─────────────────────────────────────────────────────────────┐
│ User says "bijli bill"                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────▼──────────┐
         │   VoiceAgent.jsx     │  ← VOICE HUB
         │  (Web Speech API)    │
         │   - Listen          │
         │   - Process         │
         │   - Speak TTS       │
         └───────────┬──────────┘
                     │
         ┌───────────▼──────────────────────┐
         │ speechProcessor.js               │
         │  1. removeFillerWords()          │
         │  2. processSpeechInput()         │
         │  3. QUICK_LOOKUP match           │
         │  → action: navigate_bill_elec   │
         └───────────┬──────────────────────┘
                     │
         ┌───────────▼──────────────────────┐
         │ VoiceAgent.jsx                   │
         │ executeAction(action, params)    │
         │ → switch case: navigate_bill_*  │
         └───────────┬──────────────────────┘
                     │
         ┌───────────▼──────────────────────┐
         │ App.jsx (NAVIGATION HUB)         │  ← ROUTER
         │ navigate('/bill/electricity')    │
         │ setScreen('guest')               │
         └───────────┬──────────────────────┘
                     │
         ┌───────────▼──────────────────────┐
         │ React Router                     │
         │ <Route path="/bill/:type">       │
         │   <BillPayment />                │
         └───────────┬──────────────────────┘
                     │
         ┌───────────▼──────────────────────┐
         │ BillPayment.jsx loads            │
         │ Now listens for voice            │
         │ (num pad input, QR scan, pay)   │
         └─────────────────────────────────┘
```

---

## 🎮 Voice Command Examples

### **Navigation Commands** (→ App.jsx)
- `"bijli bill"` → Route: `/bill/electricity`
- `"pani bill"` → Route: `/bill/water`
- `"gas bill"` → Route: `/bill/gas`
- `"shikayat"` → Route: `/complaint`
- `"naam badalna"` → Route: `/name-change` (if citizen)
- `"home"` → Route: `/`
- `"back"` → Previous page

### **Payment Flow Commands** (→ BillPayment.jsx)
- `"consumer number"` → Show format
- `"123456"` → Numpad input
- `"fetch bill"` → API call for bill details
- `"pay now"` → Show payment methods
- `"upi"` / `"card"` / `"cash"` → Payment selection

### **Queries** (→ VoiceKnowledgeBase.js)
- `"consumer number kahan hota hai"` → KB match
- `"bill kaise bhare"` → Step-by-step guide
- `"receipt kaise download"` → Instructions

---

## 📊 State Management Flow

```
App.jsx (Main State)
├─ screen: 'screensaver' | 'idle' | 'gateway' | 'citizen-auth' | 'guest' | 'citizen-dashboard'
├─ lang: 'en' | 'hi' | 'pa'
├─ citizen: null | { name, aadhaar, ... }
├─ voiceMode: boolean
├─ blindMode: boolean
├─ pendingIntent: null | 'naam_change' | 'new_connection'
├─ isOnline: boolean
│
└─ VoiceAgent.jsx (Voice State)
   ├─ isActive: boolean (listening)
   ├─ status: 'idle' | 'listening' | 'processing' | 'speaking'
   ├─ lastTranscript: string
   ├─ lastReply: string
   └─ Refs:
      ├─ recognitionRef (Web Speech API)
      ├─ deBouncerRef (TranscriptDebouncer)
      ├─ sentenceQueueRef (SentenceQueue)
      └─ ttsResolverRef (TTS callback)
```

---

## 🔑 Key Architecture Principles

1. **VoiceAgent wraps everything** - All screens inherit voice capability
2. **App.jsx = Navigation** - Single source of truth for routing & state
3. **3-layer voice pipeline:**
   - Fast: Quick lookup (0-5ms)
   - Medium: KB fuzzy search (5-50ms)
   - Slow: Gemini API (500-2000ms)
4. **Silent redirects** - Bill payments have empty text → no confusing speech
5. **Multi-word matching** - "bijli bill" redirects instantly (not "what bill?")
6. **Offline support** - Local sync queue, works on dual SIM kiosks
7. **Accessibility-first** - Blind mode narrates everything via TTS

---

## 📍 How to Add a New Page

1. **Create component:** `src/components/NewPage.jsx`
2. **Add route in App.jsx:**
   ```jsx
   <Route path="/new-page" element={<NewPage lang={lang} />} />
   ```
3. **Add navigation action in speechProcessor.js:**
   ```javascript
   'command phrase': { action: 'navigate_new_page', ... }
   ```
4. **Add action case in VoiceAgent.jsx:**
   ```javascript
   case 'navigate_new_page':
       navigate('/new-page');
       break;
   ```
5. **Use voice in component:**
   ```javascript
   const { speakText, isListening } = useVoice();
   useVoiceInput((transcript) => { /* handle */ });
   ```

---

Generated: March 2024
SUVIDHA Setu v5.0
