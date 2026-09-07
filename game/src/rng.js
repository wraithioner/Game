// Deterministic PRNG and seed derivation.
// mulberry32 is a small, fast, well-distributed PRNG - good enough for gameplay
// randomness (not cryptography), and its output is fully reproducible for a
// given 32-bit seed, which is the property the daily-seeded challenge depends on.

/**
 * @param {number} seed 32-bit unsigned integer seed.
 * @returns {() => number} A function producing floats in [0, 1).
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple deterministic string hash (djb2 variant) into a 32-bit unsigned int. */
export function hashStringToSeed(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/** UTC calendar date as "YYYY-MM-DD", the unit the daily challenge is keyed on. */
export function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * The daily seed: every player on the same UTC calendar date gets this exact
 * value, and therefore the exact same sequence of obstacle rows (see game.js).
 */
export function dailySeed(date = new Date()) {
  return hashStringToSeed('swerve-daily-v1-' + utcDateString(date));
}

/** A fresh, non-shared seed for Practice mode. */
export function practiceSeed() {
  return hashStringToSeed('swerve-practice-' + Date.now() + '-' + Math.random());
}

/** Derives a per-row seed from a run seed and row index, so each row within a
 * run is independently seeded but the whole run stays fully deterministic. */
export function childSeed(runSeed, index) {
  return hashStringToSeed(runSeed + ':' + index);
}
