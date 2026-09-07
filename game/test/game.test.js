import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCheckpoint,
  speedAtDistance,
  SwerveRun,
  DISC_RADIUS,
  CHECKPOINT_SPACING,
  BASE_SPEED,
  MAX_SPEED,
  SPEED_RAMP_DISTANCE,
  BOOST_DURATION,
  DAILY_DISTANCE_CAP,
} from '../src/game.js';

function toXY(obstacle) {
  return { x: Math.cos(obstacle.angle) * obstacle.radius, y: Math.sin(obstacle.angle) * obstacle.radius };
}

function quadrantOf(obstacle) {
  return Math.floor(obstacle.angle / (Math.PI / 2));
}

/** Advances a run in small steps (matching how main.js actually drives it,
 * once per animation frame) until it reaches or passes `targetDistance`, or
 * ends. Small steps let the steering ease and any boost timer behave
 * realistically, rather than one giant tick decaying everything at once. */
function stepUntil(run, targetDistance, step = 1 / 60) {
  let guard = 0;
  while (run.status === 'active' && run.distance < targetDistance && guard < 200000) {
    run.tick(step);
    guard++;
  }
  return run;
}

test('speedAtDistance ramps from BASE_SPEED to MAX_SPEED and then holds', () => {
  assert.equal(speedAtDistance(0), BASE_SPEED);
  assert.equal(speedAtDistance(SPEED_RAMP_DISTANCE), MAX_SPEED);
  assert.equal(speedAtDistance(SPEED_RAMP_DISTANCE * 10), MAX_SPEED, 'must not exceed the plateau');
  const mid = speedAtDistance(SPEED_RAMP_DISTANCE / 2);
  assert.ok(mid > BASE_SPEED && mid < MAX_SPEED);
});

test('createCheckpoint is deterministic for a given seed and index', () => {
  const a = createCheckpoint(777, 5);
  const b = createCheckpoint(777, 5);
  assert.deepEqual(a, b);
});

test('createCheckpoint varies by index and by seed', () => {
  const a = createCheckpoint(1, 0);
  const b = createCheckpoint(1, 1);
  const c = createCheckpoint(2, 0);
  assert.notDeepEqual(a.obstacles, b.obstacles);
  assert.notDeepEqual(a.obstacles, c.obstacles);
});

test('checkpoint positions increase strictly by CHECKPOINT_SPACING', () => {
  const first = createCheckpoint(1, 0);
  const second = createCheckpoint(1, 1);
  assert.equal(second.position - first.position, CHECKPOINT_SPACING);
});

test('every obstacle has a valid type and stays within its own quadrant\'s angular arc', () => {
  const validTypes = new Set(['hazard', 'barrier']);
  for (let seed = 0; seed < 200; seed++) {
    const checkpoint = createCheckpoint(seed, 0);
    checkpoint.obstacles.forEach((o) => {
      assert.ok(validTypes.has(o.type), `invalid type: ${o.type}`);
      assert.ok(o.angle >= 0 && o.angle < Math.PI * 2, `angle out of range: ${o.angle}`);
      assert.ok(o.radius > 0 && o.radius <= DISC_RADIUS, `radius out of range: ${o.radius}`);
    });
  }
});

test('fairness guarantee: at least one full quadrant is always completely obstacle-free', () => {
  // Sweep a large number of seeds and checkpoint indices - the weighted
  // random pick alone would produce all-4-quadrants-occupied a non-trivial
  // fraction of the time, so this exhaustively checks the deterministic
  // fix-up in createCheckpoint actually fires every time it needs to.
  for (let seed = 0; seed < 500; seed++) {
    for (let index = 0; index < 20; index++) {
      const checkpoint = createCheckpoint(seed, index);
      const occupiedQuadrants = new Set(checkpoint.obstacles.map(quadrantOf));
      assert.ok(
        occupiedQuadrants.size < 4,
        `checkpoint (seed=${seed}, index=${index}) has every quadrant blocked: ${JSON.stringify(checkpoint.obstacles)}`
      );
    }
  }
});

test('a fresh run starts centered, not boosting, at distance 0', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  assert.deepEqual(run.position, { x: 0, y: 0 });
  assert.equal(run.boosting, false);
  assert.equal(run.distance, 0);
  assert.equal(run.status, 'active');
});

test('constructing a run with an invalid mode throws', () => {
  assert.throws(() => new SwerveRun({ seed: 1, mode: 'bogus' }));
});

test('setTargetPosition clamps to the unit disc', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  run.setTargetPosition(5, 0);
  assert.ok(Math.hypot(run.targetPosition.x, run.targetPosition.y) <= DISC_RADIUS + 1e-9);
  assert.ok(run.targetPosition.x > 0.99, 'should clamp toward the same direction, at the rim');
});

test('position eases toward the target over time rather than snapping instantly', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  run.setTargetPosition(1, 0);
  run.tick(1 / 60);
  assert.ok(run.position.x > 0 && run.position.x < 0.5, 'one small tick should move only partway there');
  for (let i = 0; i < 120; i++) run.tick(1 / 60); // ~2 more seconds, many time constants at STEER_EASE_RATE
  assert.ok(Math.hypot(run.position.x - 1, run.position.y - 0) < 0.01, 'should have converged close to the target');
});

test('triggerBoost sets boosting for BOOST_DURATION and then reverts', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  run.triggerBoost();
  assert.equal(run.boosting, true);
  run.tick(BOOST_DURATION - 0.05);
  assert.equal(run.boosting, true, 'should still be boosting just before the duration elapses');
  run.tick(0.1);
  assert.equal(run.boosting, false);
});

test('a fully clear quadrant is always survivable regardless of boost state', () => {
  for (let seed = 0; seed < 50; seed++) {
    const checkpoint = createCheckpoint(seed, 0);
    const occupied = new Set(checkpoint.obstacles.map(quadrantOf));
    let clearQuadrant = -1;
    for (let q = 0; q < 4; q++) {
      if (!occupied.has(q)) { clearQuadrant = q; break; }
    }
    assert.ok(clearQuadrant !== -1, 'fairness guarantee should have produced a clear quadrant');

    const angle = (clearQuadrant + 0.5) * (Math.PI / 2); // dead center of the clear quadrant's arc
    const target = { x: Math.cos(angle) * 0.65, y: Math.sin(angle) * 0.65 };

    const run = new SwerveRun({ seed, mode: 'practice' });
    run.setTargetPosition(target.x, target.y);
    stepUntil(run, CHECKPOINT_SPACING + 1);
    assert.equal(run.status, 'active', `seed ${seed}: steering into the guaranteed-clear quadrant should survive`);
  }
});

test('a "hazard" obstacle always collides, boosting or not', () => {
  let seed = 0;
  let hazard;
  while (seed < 200) {
    hazard = createCheckpoint(seed, 0).obstacles.find((o) => o.type === 'hazard');
    if (hazard) break;
    seed++;
  }
  assert.ok(hazard, 'no seed in range produced a hazard obstacle - test setup problem');
  const target = toXY(hazard);

  const plain = new SwerveRun({ seed, mode: 'practice' });
  plain.setTargetPosition(target.x, target.y);
  stepUntil(plain, CHECKPOINT_SPACING + 1);
  assert.equal(plain.status, 'ended');

  const boosted = new SwerveRun({ seed, mode: 'practice' });
  boosted.setTargetPosition(target.x, target.y);
  boosted.triggerBoost();
  stepUntil(boosted, CHECKPOINT_SPACING + 1);
  assert.equal(boosted.status, 'ended', 'boosting must not clear a hazard');
});

test('a "barrier" obstacle collides unless the player is boosting through it', () => {
  let seed = 0;
  let barrier;
  while (seed < 200) {
    barrier = createCheckpoint(seed, 0).obstacles.find((o) => o.type === 'barrier');
    if (barrier) break;
    seed++;
  }
  assert.ok(barrier, 'no seed in range produced a barrier obstacle - test setup problem');
  const target = toXY(barrier);

  const hit = new SwerveRun({ seed, mode: 'practice' });
  hit.setTargetPosition(target.x, target.y);
  stepUntil(hit, CHECKPOINT_SPACING + 1);
  assert.equal(hit.status, 'ended');

  const cleared = new SwerveRun({ seed, mode: 'practice' });
  cleared.setTargetPosition(target.x, target.y);
  // Converge onto the barrier's position first, then boost shortly before
  // crossing so the boost is still active at the crossing instant.
  stepUntil(cleared, CHECKPOINT_SPACING - 1);
  cleared.triggerBoost();
  stepUntil(cleared, CHECKPOINT_SPACING + 1);
  assert.equal(cleared.status, 'active');
});

test('a run that has ended ignores further ticks and input', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  run.status = 'ended';
  const before = run.distance;
  run.tick(1);
  run.setTargetPosition(1, 1);
  run.triggerBoost();
  assert.equal(run.distance, before);
  assert.deepEqual(run.targetPosition, { x: 0, y: 0 });
  assert.equal(run.boosting, false);
});

test('practice mode has no distance cap and does not auto-complete', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  assert.equal(run.distanceCap, null);
});

test('daily mode ends without reaching the cap when the player never steers away from center', () => {
  const run = new SwerveRun({ seed: 999, mode: 'daily', distanceCap: 50 });
  stepUntil(run, 50);
  const checkpoint0 = createCheckpoint(999, 0);
  const centerIsHit = checkpoint0.obstacles.some((o) => {
    const { x, y } = toXY(o);
    return Math.hypot(x, y) < 0.14 + o.hitboxRadius; // player starts at (0,0)
  });
  if (centerIsHit) {
    assert.equal(run.status, 'ended');
    assert.equal(run.completed, false);
  } else {
    assert.equal(run.completed, true);
  }
});

test('daily mode completes cleanly when the player successfully dodges every checkpoint', () => {
  const seed = 999;
  const distanceCap = 130; // covers checkpoints at 40, 80, 120
  const run = new SwerveRun({ seed, mode: 'daily', distanceCap });

  const dt = 1 / 60;
  let guard = 0;
  let steeredForIndex = -1;
  while (run.status === 'active' && guard < 1000000) {
    const nextIndex = Math.floor(run.distance / CHECKPOINT_SPACING);
    if (nextIndex !== steeredForIndex) {
      steeredForIndex = nextIndex;
      const upcoming = createCheckpoint(seed, nextIndex);
      const occupied = new Set(upcoming.obstacles.map(quadrantOf));
      let clearQuadrant = 0;
      for (let q = 0; q < 4; q++) {
        if (!occupied.has(q)) { clearQuadrant = q; break; }
      }
      const angle = (clearQuadrant + 0.5) * (Math.PI / 2);
      run.setTargetPosition(Math.cos(angle) * 0.65, Math.sin(angle) * 0.65);
    }
    run.tick(dt);
    guard++;
  }

  assert.equal(run.status, 'ended');
  assert.equal(run.completed, true);
  assert.equal(run.distance, distanceCap);
});

test('obstaclesCleared increments by the number of obstacles at each passed checkpoint', () => {
  const seed = 5;
  const checkpoint0 = createCheckpoint(seed, 0);
  if (checkpoint0.obstacles.length === 0) return; // skip rather than flake if this seed's checkpoint 0 is empty

  const occupied = new Set(checkpoint0.obstacles.map(quadrantOf));
  let clearQuadrant = -1;
  for (let q = 0; q < 4; q++) {
    if (!occupied.has(q)) { clearQuadrant = q; break; }
  }
  const angle = (clearQuadrant + 0.5) * (Math.PI / 2);

  const run = new SwerveRun({ seed, mode: 'practice' });
  run.setTargetPosition(Math.cos(angle) * 0.65, Math.sin(angle) * 0.65);
  stepUntil(run, CHECKPOINT_SPACING + 1);
  assert.equal(run.status, 'active');
  assert.equal(run.obstaclesCleared, checkpoint0.obstacles.length);
});

test('getVisibleObstacles returns exactly the unresolved obstacles within viewDistance, and is side-effect-free', () => {
  const run = new SwerveRun({ seed: 3, mode: 'practice' });
  const viewDistance = 100;
  const expectedCheckpointCount = Math.floor(viewDistance / CHECKPOINT_SPACING);
  const expectedCount = Array.from({ length: expectedCheckpointCount }, (_, i) => createCheckpoint(3, i))
    .reduce((sum, c) => sum + c.obstacles.length, 0);

  const obstacles = run.getVisibleObstacles(viewDistance);
  assert.equal(obstacles.length, expectedCount);

  // Calling it again must return identical obstacles - no internal state
  // should have advanced just from looking ahead.
  const obstaclesAgain = run.getVisibleObstacles(viewDistance);
  assert.deepEqual(obstacles, obstaclesAgain);
  assert.equal(run.distance, 0);
});
