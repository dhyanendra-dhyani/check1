/**
 * VoiceContext — Shares voice agent state across all screens.
 * Any component can call `activate()` to start continuous voice conversation.
 */

import { createContext, useContext } from 'react';

const VoiceContext = createContext({
    isActive: false,
    status: 'idle', // idle | listening | processing | speaking
    activate: () => { },
    deactivate: () => { },
    lastTranscript: '',
    lastReply: '',
});

export const useVoice = () => useContext(VoiceContext);
export default VoiceContext;
