/**
 * ═══════════════════════════════════════════════════════════
 * API Client — Gemini SDK key rotation (round-robin)
 * Ported from suvidha_2.0
 * ═══════════════════════════════════════════════════════════
 */

import { GoogleGenAI } from "@google/genai";

// Gather VITE_GEMINI_KEY_* env variables
const getApiKeys = () => {
    const keys = [];
    for (let i = 1; i <= 10; i++) {
        const key = import.meta.env[`VITE_GEMINI_KEY_${i}`];
        if (key) keys.push(key.trim());
    }
    return keys.length > 0 ? keys : [""];
};

const API_KEYS = getApiKeys();
let currentIndex = 0;

/**
 * Returns a new GoogleGenAI instance using the next API key in rotation.
 */
export function getRotatedAIClient() {
    const apiKey = API_KEYS[currentIndex];
    currentIndex = (currentIndex + 1) % API_KEYS.length;
    return new GoogleGenAI({ apiKey });
}

/**
 * Returns the current API key (useful for direct fetch calls).
 */
export function getCurrentApiKey() {
    return API_KEYS[currentIndex];
}

/**
 * Check if any API keys are configured.
 */
export function hasApiKeys() {
    return API_KEYS.length > 0 && API_KEYS[0] !== "";
}
