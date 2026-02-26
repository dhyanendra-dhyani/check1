# SUVIDHA Setu — Smart Civic Kiosk Interface

> 🏛️ C-DAC SUVIDHA 2026 Hackathon Entry  
> A voice-first, offline-capable civic kiosk interface for Indian government services.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🎤 Testing Voice Commands

Open the app in **Google Chrome** (required for Web Speech API).

| Say this... | What happens |
|---|---|
| "Pay electricity bill" | Opens Electricity Bill Payment |
| "Pay water bill" | Opens Water Bill Payment |
| "File complaint" | Opens Complaint Form |
| "Change language to Hindi" | Switches UI to Hindi |
| "Bijli ka bill" | Opens Electricity (Hindi voice) |
| "Shikayat darj karo" | Opens Complaint (Hindi voice) |

## 🔌 Testing Offline Mode

1. Open the app at `http://localhost:5173`
2. Open Chrome DevTools → **Network** tab
3. Toggle **Throttling** to "Offline"
4. A red banner "⚠️ Working in Offline Mode" appears
5. Complete a payment or file a complaint
6. Toggle back to "Online"
7. Watch the green sync notification appear

## 🔑 Admin Dashboard

Navigate to `/admin` or press `Ctrl+Shift+D` → click "Open Admin Dashboard".

**Credentials:**
| Field | Value |
|---|---|
| Username | `admin` |
| Password | `password123` |

## 📋 Sample Consumer IDs

| Service | Consumer ID | Name | Amount |
|---|---|---|---|
| Electricity | `PSEB-123456` | R*** Kumar | ₹450 |
| Water | `PHED-789012` | P*** Singh | ₹280 |
| Gas | `GPL-345678` | S*** Devi | ₹620 |

## 🛠️ Developer Mode

Press **Ctrl+Shift+D** to reveal the developer panel:
- Simulate offline/online transitions
- Navigate to any screen instantly
- View speech recognition logs
- Monitor application state

## 🏗️ Tech Stack

- **React 18** + Vite
- **React Router v6** — Client-side routing
- **Tailwind CSS v4** — Utility-first styling
- **Framer Motion** — Smooth animations
- **Recharts** — Dashboard charts
- **jsPDF** — PDF receipt generation
- **qrcode.react** — QR code generation
- **localforage** — IndexedDB offline storage
- **Web Speech API** — Voice recognition & synthesis

## 📁 Project Structure

```
src/
├── components/
│   ├── HomeScreen.jsx       # Voice-first home with service cards
│   ├── BillPayment.jsx      # Multi-step bill payment flow
│   ├── ComplaintForm.jsx     # Complaint filing with voice/photo
│   ├── AdminDashboard.jsx   # Analytics dashboard with charts
│   ├── VoiceButton.jsx      # Reusable mic button component
│   └── OfflineIndicator.jsx # Online/offline status manager
├── utils/
│   ├── i18n.js              # English/Hindi/Punjabi translations
│   ├── mockData.js          # All mock data and ID generators
│   ├── voiceCommands.js     # Speech recognition & synthesis
│   ├── offlineSync.js       # IndexedDB offline storage
│   └── pdfGenerator.js      # PDF receipt generation
├── App.jsx                  # Router, layout, dev panel
├── main.jsx                 # Entry point
└── index.css                # Design system & animations
```

## ✅ Features Checklist

- [x] Voice-first interface with Web Speech API
- [x] 3-language support (English, Hindi, Punjabi)
- [x] Bill payment with touch numpad, voice, QR input
- [x] Cash insertion, UPI QR, Card payment animations
- [x] PDF receipt generation & download
- [x] Complaint filing with voice recording & waveform
- [x] Photo upload for complaints
- [x] Geolocation auto-detection
- [x] Offline mode with IndexedDB storage
- [x] Auto-sync on reconnect
- [x] Admin dashboard with charts & heatmap
- [x] Developer mode panel (Ctrl+Shift+D)
- [x] Indian flag theme colors
- [x] WCAG AAA accessible design
- [x] Idle timeout (2 min → home)
- [x] Smooth 60fps animations

---

**Built with ❤️ for C-DAC SUVIDHA 2026 Hackathon**
