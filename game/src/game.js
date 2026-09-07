// Core deterministic simulation for a Swerve run: a 3-lane endless obstacle
// dodge. Distance and speed drive everything; obstacle rows are generated
// lazily and deterministically from a seed, with a hard fairness guarantee
// (see createRow) so no pattern is ever unavoidable regardless of the
// player's lane or timing.

import { mulberry32, childSeed } from './rng.js';

export const LANES = 3; // 0 = left, 1 = center, 2 = right
export const ROW_SPACING = 40; // distance units between obstacle rows
export const BASE_SPEED = 6; // units/sec at the start of a run
export const MAX_SPEED = 16; // units/sec plateau - never exceeded, so a
// skilled player can sustain an arbitrarily long practice run rather than
// facing a guaranteed-unwinnable ramp (the same design principle validated
// for the previous concept in docs/RESEARCH.md carries over: a difficulty
// ramp should have a hard ceiling, not climb forever).
export const SPEED_RAMP_DISTANCE = 1600; // distance over which speed ramps to MAX_SPEED
export const VIEW_DISTANCE = 100; // distance units visible ahead on screen -
// at MAX_SPEED this is still ~6 seconds of warning before an obstacle
// arrives, comfortably above human reaction time; this is the actual
// fairness-critical constant, not a rendering nicety.
export const JUMP_DURATION = 0.45; // seconds
export const SLIDE_DURATION = 0.55; // seconds
export const DAILY_DISTANCE_CAP = 1000; // Daily Run ends (as a clean "cleared")
// once this is reached, so every player's daily attempt is bounded and
// comparable - the same reasoning as the previous concept's bounded Daily
// Ring (docs/RESEARCH.md): an uncapped daily mode makes "how far did you
// get" incomparable across players with different amounts of free time.

const OBSTACLE_WEIGHTS = [
  ['empty', 0.3],
  ['low', 0.25], // must jump
  ['high', 0.25], // must slide
  ['wall', 0.2], // must be in a different lane - never jumpable or slideable
];

function lerp(a, b, t) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

/** Current scroll speed at a given distance, ramping to a hard plateau. */
export function speedAtDistance(distance) {
  return lerp(BASE_SPEED, MAX_SPEED, distance / SPEED_RAMP_DISTANCE);
}

function pickWeighted(rand) {
  let r = rand();
  for (const [type, weight] of OBSTACLE_WEIGHTS) {
    if (r < weight) return type;
    r -= weight;
  }
  return 'empty';
}

/**
 * Builds one deterministic obstacle row. The fairness guarantee lives here:
 * at most LANES-1 lanes may be 'wall' (the one obstacle type that cannot be
 * cleared by jumping or sliding), so there is always at least one lane a
 * player can switch into and survive, regardless of which lane they're
 * currently in or what action they're mid-way through.
 */
export function createRow(runSeed, rowIndex) {
  const rand = mulberry32(childSeed(runSeed, rowIndex));
  const lanes = Array.from({ length: LANES }, () => pickWeighted(rand));

  const wallCount = lanes.filter((t) => t === 'wall').length;
  if (wallCount >= LANES) {
    // All lanes blocked with no clearable action - deterministically demote
    // the last lane to something jumpable rather than leave an unavoidable row.
    lanes[LANES - 1] = 'low';
  }

  return {
    rowIndex,
    position: (rowIndex + 1) * ROW_SPACING,
    lanes,
  };
}

/** Whether `action` clears `obstacleType` while in the obstacle's lane. */
function clears(obstacleType, action) {
  if (obstacleType === 'empty') return true;
  if (obstacleType === 'low') return action === 'jumping';
  if (obstacleType === 'high') return action === 'sliding';
  return false; // 'wall' is never clearable by action, only by lane choice
}

/**
 * A single run: 'daily' (bounded by DAILY_DISTANCE_CAP, seeded by UTC date)
 * or 'practice' (unbounded, ends only on collision).
 */
export class SwerveRun {
  constructor({ seed, mode, distanceCap = null }) {
    if (mode !== 'daily' && mode !== 'practice') {
      throw new Error(`Unknown mode: ${mode}`);
    }
    this.seed = seed;
    this.mode = mode;
    this.distanceCap = mode === 'daily' ? distanceCap ?? DAILY_DISTANCE_CAP : null;

    this.lane = 1; // start centered
    this.action = 'running'; // 'running' | 'jumping' | 'sliding'
    this.actionTimeRemaining = 0;

    this.distance = 0;
    this.status = 'active'; // 'active' | 'ended'
    this.completed = false; // true only if a daily run reached its distance cap
    this.obstaclesCleared = 0;

    this._nextRowIndex = 0;
    this._nextRow = createRow(this.seed, 0);
  }

  moveLeft() {
    if (this.status === 'active') this.lane = Math.max(0, this.lane - 1);
  }

  moveRight() {
    if (this.status === 'active') this.lane = Math.min(LANES - 1, this.lane + 1);
  }

  jump() {
    if (this.status === 'active' && this.action !== 'sliding') {
      this.action = 'jumping';
      this.actionTimeRemaining = JUMP_DURATION;
    }
  }

  slide() {
    if (this.status === 'active' && this.action !== 'jumping') {
      this.action = 'sliding';
      this.actionTimeRemaining = SLIDE_DURATION;
    }
  }

  /**
   * Read-only lookahead for the renderer: every row from the next unresolved
   * one up to `viewDistance` ahead of the player. Pure and side-effect-free
   * (uses createRow directly rather than mutating _nextRow/_nextRowIndex),
   * so calling it every frame for drawing never affects collision state.
   */
  getVisibleRows(viewDistance) {
    const rows = [];
    let i = this._nextRowIndex;
    let row = createRow(this.seed, i);
    while (row.position <= this.distance + viewDistance) {
      rows.push(row);
      i += 1;
      row = createRow(this.seed, i);
    }
    return rows;
  }

  /**
   * Advances the simulation by `dtSeconds`. Exposed as an explicit,
   * exact-step function (rather than reading a real clock internally) so
   * tests can drive it deterministically; the real game loop in main.js
   * calls this once per animation frame with the measured frame delta.
   */
  tick(dtSeconds) {
    if (this.status !== 'active') return this._outcome();

    if (this.actionTimeRemaining > 0) {
      this.actionTimeRemaining = Math.max(0, this.actionTimeRemaining - dtSeconds);
      if (this.actionTimeRemaining === 0) this.action = 'running';
    }

    const speed = speedAtDistance(this.distance);
    this.distance += speed * dtSeconds;

    // Resolve any rows the player has now reached, up to (and including) one
    // sitting exactly at the distance cap - reaching the cap doesn't let a
    // player skip a fairly-clearable obstacle positioned right at the
    // boundary. Normally at most one row is crossed per frame, but a loop
    // guards against a large dt (e.g. a backgrounded tab) skipping past more
    // than one.
    while (
      this.status === 'active' &&
      this._nextRow.position <= this.distance &&
      (!this.distanceCap || this._nextRow.position <= this.distanceCap)
    ) {
      const obstacleType = this._nextRow.lanes[this.lane];
      if (!clears(obstacleType, this.action)) {
        this.status = 'ended';
        return this._outcome();
      }
      this.obstaclesCleared += 1;
      this._nextRowIndex += 1;
      this._nextRow = createRow(this.seed, this._nextRowIndex);
    }

    if (this.status === 'active' && this.distanceCap && this.distance >= this.distanceCap) {
      this.distance = this.distanceCap;
      this.status = 'ended';
      this.completed = true;
    }

    return this._outcome();
  }

  _outcome() {
    return {
      distance: this.distance,
      lane: this.lane,
      action: this.action,
      status: this.status,
      completed: this.completed,
      obstaclesCleared: this.obstaclesCleared,
    };
  }
}
