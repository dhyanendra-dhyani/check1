/**
 * VoiceContext v7 — Global voice mode state
 *
 * voiceMode: boolean — set ONCE at IdleScreen
 *   true  = entire session is voice-controlled
 *   false = touch-only, no voice elements shown
 */

import { createContext, useContext } from 'react';

const VoiceContext = createContext({
    voiceMode: false,
    isActive: false,
    status: 'idle',
    lastTranscript: '',
    lastReply: '',
    activate: () => { },
    deactivate: () => { },
});

export const useVoice = () => useContext(VoiceContext);
export default VoiceContext;
