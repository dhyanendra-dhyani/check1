/**
 * VoiceContext v8 — Global voice mode state + Blind Mode + Page Data
 *
 * voiceMode: boolean — set ONCE at IdleScreen
 * blindMode: boolean — accessibility mode for visually impaired
 * pageData: object — current page state reported by active component
 */

import { createContext, useContext } from 'react';

const VoiceContext = createContext({
    voiceMode: false,
    isActive: false,
    status: 'idle',
    lastTranscript: '',
    lastReply: '',
    blindMode: false,
    setBlindMode: () => { },
    pageData: null,
    setPageData: () => { },
    activate: () => { },
    deactivate: () => { },
});

export const useVoice = () => useContext(VoiceContext);
export default VoiceContext;
