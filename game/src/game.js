// Core deterministic simulation for a Ringtrue run.
//
// Design constraints this file exists to satisfy (see docs/GAME_DESIGN.md §1.5,
// docs/RESEARCH.md §14):
//  - The sweep is NOT constant angular velocity, so players must read
//    instantaneous state rather than memorize a fixed rhythm.
//  - Difficulty ramps on exactly two knobs (speed, band width) up to a hard
//    plateau, so a skilled player can sustain an arbitrarily long run.
//  - Everything here is a pure function of (seed, lap index, time) so a hit
//    judgment can be reconstructed exactly from a raw input timestamp,
//    independent of frame timing - the fairness-critical property tested in
//    test/game.test.js.

import { mulberry32, lapSeed } from './rng.js';

export const TAU = Math.PI * 2;

export const DIFFICULTY = Object.freeze({
  baseSpeedStart: 0.9, // radians/sec
  baseSpeedMax: 2.6,
  fairHalfWidthStart: 0.55, // radians (~31.5deg)
  fairHalfWidthMin: 0.22,
  trueHalfWidthStart: 0.16,
  trueHalfWidthMin: 0.06,
  plateauLaps: 25, // lap index at which the ramp reaches its plateau
  nonPeriodicAmplitude: 0.35, // fraction of baseSpeed
  freqMin: 0.4,
  freqMax: 0.9,
});

function lerp(a, b, t) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

function normalizeAngle(angle) {
  const a = angle % TAU;
  return a < 0 ? a + TAU : a;
}

/** Shortest angular distance between two angles, always in [0, PI]. */
export function angularDiff(a, b) {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return d > Math.PI ? TAU - d : d;
}

/**
 * Builds the deterministic parameters for one lap: where the target sits,
 * how wide its Fair/True bands are, and the sweep's speed profile.
 */
export function createLap(runSeed, lapIndex) {
  const rand = mulberry32(lapSeed(runSeed, lapIndex));
  const t = lapIndex / DIFFICULTY.plateauLaps;

  const baseSpeed = lerp(DIFFICULTY.baseSpeedStart, DIFFICULTY.baseSpeedMax, t);
  const fairHalfWidth = lerp(DIFFICULTY.fairHalfWidthStart, DIFFICULTY.fairHalfWidthMin, t);
  const trueHalfWidth = lerp(DIFFICULTY.trueHalfWidthStart, DIFFICULTY.trueHalfWidthMin, t);

  return {
    lapIndex,
    centerAngle: rand() * TAU,
    baseSpeed,
    fairHalfWidth,
    trueHalfWidth,
    amplitude: DIFFICULTY.nonPeriodicAmplitude,
    freq: lerp(DIFFICULTY.freqMin, DIFFICULTY.freqMax, rand()),
    phase: rand() * TAU,
  };
}

/**
 * The pointer's angle at time `tSeconds` since this lap started, in [0, TAU).
 * Closed-form integral of a sinusoidally-varying angular velocity, so it can
 * be evaluated exactly at any timestamp - no frame-by-frame accumulation, and
 * therefore no accumulation error and no dependency on render framerate.
 */
export function angleAt(lap, tSeconds) {
  const { baseSpeed, amplitude, freq, phase } = lap;
  const raw =
    baseSpeed * tSeconds -
    ((baseSpeed * amplitude) / freq) * (Math.cos(freq * tSeconds + phase) - Math.cos(phase));
  return normalizeAngle(raw);
}

/** Instantaneous angular velocity at time `tSeconds`, in radians/sec. */
export function angularVelocityAt(lap, tSeconds) {
  const { baseSpeed, amplitude, freq, phase } = lap;
  return baseSpeed * (1 + amplitude * Math.sin(freq * tSeconds + phase));
}

/**
 * Judges a tap at time `tSeconds` against a lap's target bands.
 * offsetMs is the (unsigned) time-equivalent of the angular miss distance -
 * "how many milliseconds early or late" the tap effectively was, computed
 * from the local angular velocity so it stays meaningful as speed ramps up.
 */
export function judge(lap, tSeconds) {
  const angle = angleAt(lap, tSeconds);
  const diff = angularDiff(angle, lap.centerAngle);
  const velocity = Math.max(Math.abs(angularVelocityAt(lap, tSeconds)), 1e-4);
  const offsetMs = (diff / velocity) * 1000;

  let result;
  if (diff <= lap.trueHalfWidth) result = 'perfect';
  else if (diff <= lap.fairHalfWidth) result = 'fair';
  else result = 'miss';

  return { result, diff, offsetMs };
}

/**
 * A single run of the game: 'daily' (fixed lap cap, seeded by UTC date) or
 * 'practice' (unlimited, ends on the first miss).
 */
export class RingRun {
  constructor({ seed, mode, lapCap = null }) {
    if (mode !== 'daily' && mode !== 'practice') {
      throw new Error(`Unknown mode: ${mode}`);
    }
    this.seed = seed;
    this.mode = mode;
    this.lapCap = mode === 'daily' ? lapCap ?? 20 : null;
    this.lapIndex = 0;
    this.status = 'active'; // 'active' | 'ended'
    this.completed = false; // true only if a daily run reached its lap cap without missing
    this.score = 0;
    this.combo = 1;
    this.results = [];
    this.offsets = [];
    this.lap = createLap(this.seed, 0);
  }

  /** Angle of the pointer right now, given elapsed seconds since this lap started. */
  angleAtLapTime(tSeconds) {
    return angleAt(this.lap, tSeconds);
  }

  /**
   * Registers a tap at `tSeconds` since the current lap started. Returns the
   * outcome, or null if the run has already ended (a stray input should be
   * ignored, not throw).
   */
  registerTap(tSeconds) {
    if (this.status !== 'active') return null;

    const { result, diff, offsetMs } = judge(this.lap, tSeconds);
    this.results.push(result);

    if (result === 'miss') {
      this.status = 'ended';
      return this._outcome(result, diff, offsetMs);
    }

    this.offsets.push(offsetMs);
    if (result === 'perfect') {
      this.combo += 1;
    } else {
      // Fair softens the combo rather than zeroing it (GAME_DESIGN.md §1.5) -
      // only a Miss should feel like it erases a run's progress.
      this.combo = Math.max(1, Math.floor(this.combo / 2));
    }
    this.score += this.combo;
    this.lapIndex += 1;

    if (this.lapCap && this.lapIndex >= this.lapCap) {
      this.status = 'ended';
      this.completed = true;
      return this._outcome(result, diff, offsetMs);
    }

    this.lap = createLap(this.seed, this.lapIndex);
    return this._outcome(result, diff, offsetMs);
  }

  _outcome(result, diff, offsetMs) {
    return {
      result,
      diff,
      offsetMs,
      score: this.score,
      combo: this.combo,
      lapsCompleted: this.lapIndex,
      status: this.status,
      completed: this.completed,
    };
  }
}
