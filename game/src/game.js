// Core deterministic simulation for a Swerve run: continuous 2D steering
// within a circular cross-section ("the disc"), matching the real Dookey
// Dash's free continuous movement rather than a discrete-lane runner (see
// docs/RESEARCH.md's Dookey Dash research addendum for the sourcing behind
// this design - it explicitly is NOT a lane-swap game like Temple Run/Subway
// Surfers). Obstacles float freely within the disc and are generated lazily
// and deterministically from a seed, with a hard fairness guarantee (see
// createCheckpoint) so a fully clear escape route always exists regardless
// of the player's position or boost state.

import { mulberry32, childSeed } from './rng.js';

export const DISC_RADIUS = 1; // normalized units - all positions live in this unit disc
export const CHECKPOINT_SPACING = 40; // distance units between obstacle checkpoints
export const BASE_SPEED = 6; // units/sec at the start of a run
export const MAX_SPEED = 16; // units/sec plateau - never exceeded outside a boost, so a
// skilled player can sustain an arbitrarily long practice run rather than
// facing a guaranteed-unwinnable ramp.
export const SPEED_RAMP_DISTANCE = 1600; // distance over which speed ramps to MAX_SPEED
export const VIEW_DISTANCE = 100; // distance units visible ahead on screen - at MAX_SPEED
// this is still ~6 seconds of warning before an obstacle arrives, comfortably
// above human reaction time and, combined with the steering ease rate below,
// far more time than needed to steer anywhere in the disc from anywhere else
// in it - this is the actual fairness-critical constant, not a rendering nicety.
export const DAILY_DISTANCE_CAP = 1000; // Daily Run ends (as a clean "cleared")
// once this is reached, so every player's daily attempt is bounded and comparable.

export const STEER_EASE_RATE = 8; // 1/sec - how fast position closes the gap to targetPosition
export const BOOST_DURATION = 0.6; // seconds
export const BOOST_SPEED_MULTIPLIER = 1.8;
export const BOOST_STEER_MULTIPLIER = 0.25; // steering ease rate while boosting, matching
// the real game's tradeoff: boosting trades precise control for raw speed.

const PLAYER_HITBOX_RADIUS = 0.14;
const OBSTACLE_HITBOX_RADIUS = 0.24;
const QUADRANT_COUNT = 4;

const OBSTACLE_WEIGHTS = [
  ['empty', 0.55],
  ['hazard', 0.25], // never clearable - must be steered around
  ['barrier', 0.2], // clearable only while boosting; steerable around otherwise
];

function lerp(a, b, t) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

/** Current base scroll speed at a given distance, ramping to a hard plateau.
 * A boost temporarily multiplies this further (see tick()). */
export function speedAtDistance(distance) {
  return lerp(BASE_SPEED, MAX_SPEED, distance / SPEED_RAMP_DISTANCE);
}

function clampToDisc(x, y) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= DISC_RADIUS || magnitude === 0) return { x, y };
  const scale = DISC_RADIUS / magnitude;
  return { x: x * scale, y: y * scale };
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
 * Builds one deterministic checkpoint's obstacles. The fairness guarantee
 * lives here: the disc is divided into 4 quadrants, and at most 3 of them
 * may hold an obstacle - the 4th is always left completely clear, so a full
 * quarter of the disc (any radius, that quadrant's whole 90 degree arc) is
 * always a safe, reachable escape route regardless of where the player
 * currently is or what they're mid-boost doing. This directly generalizes
 * the discrete-lane game's "at most LANES-1 walled lanes" rule to continuous
 * space. Each obstacle's angle is strictly bounded within its own quadrant's
 * arc (by construction below), so a small hitbox near a quadrant boundary
 * can only nibble at the shared edge of the clear quadrant, never cover it -
 * there is always ample safe area deeper into the clear quadrant's arc.
 */
export function createCheckpoint(runSeed, index) {
  const rand = mulberry32(childSeed(runSeed, index));
  const quadrantTypes = Array.from({ length: QUADRANT_COUNT }, () => pickWeighted(rand));

  const occupiedCount = quadrantTypes.filter((t) => t !== 'empty').length;
  if (occupiedCount >= QUADRANT_COUNT) {
    // All four quadrants blocked - deterministically clear the last one so a
    // survivable path always exists, exactly mirroring the discrete-lane fix.
    quadrantTypes[QUADRANT_COUNT - 1] = 'empty';
  }

  const obstacles = quadrantTypes
    .map((type, quadrantIndex) => {
      if (type === 'empty') return null;
      const angle = (quadrantIndex + rand()) * (Math.PI / 2); // stays within this quadrant's arc
      const radius = 0.35 + rand() * 0.6; // off dead-center and off the rim
      return { type, angle, radius, hitboxRadius: OBSTACLE_HITBOX_RADIUS };
    })
    .filter(Boolean);

  return {
    index,
    position: (index + 1) * CHECKPOINT_SPACING,
    obstacles,
  };
}

/** Whether the player currently clears `obstacle`, given their position and boost state. */
function clears(obstacle, position, boosting) {
  const ox = Math.cos(obstacle.angle) * obstacle.radius;
  const oy = Math.sin(obstacle.angle) * obstacle.radius;
  const dist = Math.hypot(position.x - ox, position.y - oy);
  const hit = dist < PLAYER_HITBOX_RADIUS + obstacle.hitboxRadius;
  if (!hit) return true;
  return obstacle.type === 'barrier' && boosting; // a hazard is never clearable by boosting
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

    this.position = { x: 0, y: 0 }; // start centered
    this.targetPosition = { x: 0, y: 0 };
    this.boosting = false;
    this.boostTimeRemaining = 0;

    this.distance = 0;
    this.status = 'active'; // 'active' | 'ended'
    this.completed = false; // true only if a daily run reached its distance cap
    this.obstaclesCleared = 0;

    this._nextCheckpointIndex = 0;
    this._nextCheckpoint = createCheckpoint(this.seed, 0);
  }

  /** Sets where the player is steering toward, clamped to the disc. Called
   * once per frame by the input layer with the current pointer/keyboard target. */
  setTargetPosition(x, y) {
    if (this.status !== 'active') return;
    const clamped = clampToDisc(x, y);
    this.targetPosition.x = clamped.x;
    this.targetPosition.y = clamped.y;
  }

  /** Starts (or refreshes) a timed boost: faster forward speed, sloppier steering. */
  triggerBoost() {
    if (this.status === 'active') {
      this.boosting = true;
      this.boostTimeRemaining = BOOST_DURATION;
    }
  }

  /** Read-only lookahead for the renderer: every obstacle from the next
   * unresolved checkpoint up to `viewDistance` ahead of the player. Pure and
   * side-effect-free, so calling it every frame for drawing never affects
   * collision state. */
  getVisibleObstacles(viewDistance) {
    const list = [];
    let i = this._nextCheckpointIndex;
    let checkpoint = createCheckpoint(this.seed, i);
    while (checkpoint.position <= this.distance + viewDistance) {
      for (const obstacle of checkpoint.obstacles) {
        list.push({ ...obstacle, position: checkpoint.position });
      }
      i += 1;
      checkpoint = createCheckpoint(this.seed, i);
    }
    return list;
  }

  /**
   * Advances the simulation by `dtSeconds`. Exposed as an explicit,
   * exact-step function (rather than reading a real clock internally) so
   * tests can drive it deterministically; the real game loop in main.js
   * calls this once per animation frame with the measured frame delta.
   */
  tick(dtSeconds) {
    if (this.status !== 'active') return this._outcome();

    if (this.boostTimeRemaining > 0) {
      this.boostTimeRemaining = Math.max(0, this.boostTimeRemaining - dtSeconds);
      if (this.boostTimeRemaining === 0) this.boosting = false;
    }

    // Exponential-smoothing ease toward the target position, frame-rate
    // independent (uses dtSeconds directly rather than a fixed per-frame
    // fraction) - see docs/GAME_DESIGN.md §1.3.
    const steerRate = STEER_EASE_RATE * (this.boosting ? BOOST_STEER_MULTIPLIER : 1);
    const easing = 1 - Math.exp(-steerRate * dtSeconds);
    this.position.x += (this.targetPosition.x - this.position.x) * easing;
    this.position.y += (this.targetPosition.y - this.position.y) * easing;

    const speed = speedAtDistance(this.distance) * (this.boosting ? BOOST_SPEED_MULTIPLIER : 1);
    this.distance += speed * dtSeconds;

    // Resolve any checkpoints the player has now reached, up to (and
    // including) one sitting exactly at the distance cap. Normally at most
    // one checkpoint is crossed per frame, but a loop guards against a large
    // dt (e.g. a backgrounded tab, or a boost) skipping past more than one.
    while (
      this.status === 'active' &&
      this._nextCheckpoint.position <= this.distance &&
      (!this.distanceCap || this._nextCheckpoint.position <= this.distanceCap)
    ) {
      for (const obstacle of this._nextCheckpoint.obstacles) {
        if (!clears(obstacle, this.position, this.boosting)) {
          this.status = 'ended';
          return this._outcome();
        }
      }
      this.obstaclesCleared += this._nextCheckpoint.obstacles.length;
      this._nextCheckpointIndex += 1;
      this._nextCheckpoint = createCheckpoint(this.seed, this._nextCheckpointIndex);
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
      position: { x: this.position.x, y: this.position.y },
      boosting: this.boosting,
      status: this.status,
      completed: this.completed,
      obstaclesCleared: this.obstaclesCleared,
    };
  }
}
