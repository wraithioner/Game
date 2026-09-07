// Synthesized audio (Web Audio oscillators - no licensed samples, see
// docs/PRODUCT_PLAN.md - Legal) and haptics (Vibration API). Both are pure
// enhancement: every gameplay-critical signal is already fully conveyed
// visually (docs/GAME_DESIGN.md §1.12), so a missing/blocked AudioContext or
// an unsupported Vibration API must never break the game, only quiet it.

let audioCtx = null;

function getAudioContext() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    audioCtx = new Ctx();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

/** Must be called from within a user-gesture handler (e.g. the first tap) to
 * satisfy browser autoplay policies. Safe to call repeatedly. */
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function playTone(freqs, { duration = 0.12, type = 'sine', gain = 0.15 } = {}) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = now + i * duration * 0.6;
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(gain, start + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gainNode).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  });
}

const CUES = {
  boost: () => playTone([392, 587, 880], { duration: 0.1, type: 'sawtooth', gain: 0.11 }), // quick rising surge
  collision: () => playTone([180], { duration: 0.24, type: 'sine', gain: 0.12 }), // soft low thud, deliberately not harsh
  milestone: () => playTone([523.25, 659.25, 783.99, 1046.5], { duration: 0.11, type: 'triangle' }), // ascending arpeggio
};

const HAPTICS = {
  boost: [10, 20],
  collision: [30],
  milestone: [15, 40, 15, 40, 15],
};

/**
 * Plays the audio + haptic cue for a game event, respecting independent
 * sound/haptics settings (docs/GAME_DESIGN.md §5.5).
 */
export function playCue(name, settings) {
  if (settings.soundEnabled && CUES[name]) {
    try {
      CUES[name]();
    } catch {
      // Never let an audio failure interrupt gameplay.
    }
  }
  if (settings.hapticsEnabled && HAPTICS[name] && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(HAPTICS[name]);
    } catch {
      // iOS Safari and some browsers have no Vibration API - silently no-op.
    }
  }
}
