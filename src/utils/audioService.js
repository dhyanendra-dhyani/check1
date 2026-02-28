/**
 * ═══════════════════════════════════════════════════════════
 * Audio Service — Subtle UI sounds via Web Audio API
 * Ported from suvidha_2.0 — no external assets needed
 * ═══════════════════════════════════════════════════════════
 */

let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

export const playClickSound = () => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        console.warn("Click sound failed", e);
    }
};

export const playSuccessSound = () => {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        const playNote = (freq, start, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.1, start + 0.05);
            gain.gain.linearRampToValueAtTime(0, start + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + duration);
        };

        // A simple major triad chime
        playNote(523.25, now, 0.3);      // C5
        playNote(659.25, now + 0.1, 0.3); // E5
        playNote(783.99, now + 0.2, 0.5); // G5
        playNote(1046.50, now + 0.3, 0.6); // C6
    } catch (e) {
        console.warn("Success sound failed", e);
    }
};
