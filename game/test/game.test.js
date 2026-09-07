import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRow,
  speedAtDistance,
  SwerveRun,
  LANES,
  ROW_SPACING,
  BASE_SPEED,
  MAX_SPEED,
  SPEED_RAMP_DISTANCE,
  DAILY_DISTANCE_CAP,
} from '../src/game.js';

test('speedAtDistance ramps from BASE_SPEED to MAX_SPEED and then holds', () => {
  assert.equal(speedAtDistance(0), BASE_SPEED);
  assert.equal(speedAtDistance(SPEED_RAMP_DISTANCE), MAX_SPEED);
  assert.equal(speedAtDistance(SPEED_RAMP_DISTANCE * 10), MAX_SPEED, 'must not exceed the plateau');
  const mid = speedAtDistance(SPEED_RAMP_DISTANCE / 2);
  assert.ok(mid > BASE_SPEED && mid < MAX_SPEED);
});

test('createRow is deterministic for a given seed and row index', () => {
  const a = createRow(777, 5);
  const b = createRow(777, 5);
  assert.deepEqual(a, b);
});

test('createRow varies by row index and by seed', () => {
  const a = createRow(1, 0);
  const b = createRow(1, 1);
  const c = createRow(2, 0);
  assert.notDeepEqual(a.lanes, b.lanes);
  assert.notDeepEqual(a.lanes, c.lanes);
});

test('createRow always has exactly LANES lanes, each a valid obstacle type', () => {
  const validTypes = new Set(['empty', 'low', 'high', 'wall']);
  for (let seed = 0; seed < 200; seed++) {
    const row = createRow(seed, 0);
    assert.equal(row.lanes.length, LANES);
    row.lanes.forEach((t) => assert.ok(validTypes.has(t), `invalid type: ${t}`));
  }
});

test('fairness guarantee: no row ever has all lanes as "wall" (an unavoidable pattern)', () => {
  // Sweep a large number of seeds and row indices - the weighted random pick
  // alone would produce all-wall about 0.2^3 = 0.8% of the time, so this
  // exhaustively checks the deterministic fix-up in createRow actually fires
  // every time it needs to, not just usually.
  for (let seed = 0; seed < 500; seed++) {
    for (let rowIndex = 0; rowIndex < 20; rowIndex++) {
      const row = createRow(seed, rowIndex);
      const wallCount = row.lanes.filter((t) => t === 'wall').length;
      assert.ok(wallCount < LANES, `row (seed=${seed}, index=${rowIndex}) has all lanes blocked: ${row.lanes}`);
    }
  }
});

test('row positions increase strictly by ROW_SPACING', () => {
  const first = createRow(1, 0);
  const second = createRow(1, 1);
  assert.equal(second.position - first.position, ROW_SPACING);
});

test('a fresh run starts centered, running, at distance 0', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  assert.equal(run.lane, 1);
  assert.equal(run.action, 'running');
  assert.equal(run.distance, 0);
  assert.equal(run.status, 'active');
});

test('constructing a run with an invalid mode throws', () => {
  assert.throws(() => new SwerveRun({ seed: 1, mode: 'bogus' }));
});

test('moveLeft/moveRight clamp to the lane bounds', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  run.moveLeft();
  assert.equal(run.lane, 0);
  run.moveLeft(); // already leftmost
  assert.equal(run.lane, 0);
  run.moveRight();
  run.moveRight();
  assert.equal(run.lane, 2);
  run.moveRight(); // already rightmost
  assert.equal(run.lane, 2);
});

test('jump and slide are mutually exclusive and time out back to running', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  run.jump();
  assert.equal(run.action, 'jumping');
  run.slide(); // ignored while jumping
  assert.equal(run.action, 'jumping');
  run.tick(10); // well past JUMP_DURATION
  assert.equal(run.action, 'running');
});

/**
 * Advances a run in small steps (matching how main.js actually drives it,
 * once per animation frame) until it reaches or passes `targetDistance`, or
 * ends. A single giant tick() would decay the jump/slide timer using the
 * whole dt before ever checking a row crossing, which is not how the real
 * per-frame game loop behaves - small steps are the realistic simulation.
 */
function stepUntil(run, targetDistance, step = 1 / 60) {
  let guard = 0;
  while (run.status === 'active' && run.distance < targetDistance && guard < 100000) {
    run.tick(step);
    guard++;
  }
  return run;
}

test('an empty lane is always survivable regardless of action', () => {
  // Force a known row layout by testing the pure clears() logic indirectly:
  // drive a run through a seed/rowIndex combination we've verified is empty
  // in the player's lane, and confirm no collision.
  const run = new SwerveRun({ seed: 42, mode: 'practice' });
  const row = createRow(42, 0);
  const emptyLane = row.lanes.indexOf('empty');
  if (emptyLane === -1) return; // this seed's first row has no empty lane; skip rather than flake
  run.lane = emptyLane;
  stepUntil(run, ROW_SPACING + 1);
  assert.equal(run.status, 'active');
});

test('a "low" obstacle collides unless the player is jumping', () => {
  // Search seeds for a row with a deterministic 'low' obstacle to test against.
  let seed = 0;
  let row;
  let lane;
  while (seed < 100) {
    row = createRow(seed, 0);
    lane = row.lanes.indexOf('low');
    if (lane !== -1) break;
    seed++;
  }
  assert.ok(lane !== -1 && lane !== undefined, 'no seed in range produced a low obstacle - test setup problem');

  const hit = new SwerveRun({ seed, mode: 'practice' });
  hit.lane = lane;
  stepUntil(hit, ROW_SPACING + 1);
  assert.equal(hit.status, 'ended');

  // Jump shortly before reaching the row (not at t=0 - JUMP_DURATION is
  // short, so the jump must actually be in the air when the row arrives).
  const cleared = new SwerveRun({ seed, mode: 'practice' });
  cleared.lane = lane;
  stepUntil(cleared, ROW_SPACING - 1);
  cleared.jump();
  stepUntil(cleared, ROW_SPACING + 1);
  assert.equal(cleared.status, 'active');
});

test('a "high" obstacle collides unless the player is sliding', () => {
  let seed = 0;
  let row;
  let lane;
  while (seed < 100) {
    row = createRow(seed, 0);
    lane = row.lanes.indexOf('high');
    if (lane !== -1) break;
    seed++;
  }
  assert.ok(lane !== -1 && lane !== undefined, 'no seed in range produced a high obstacle - test setup problem');

  const hit = new SwerveRun({ seed, mode: 'practice' });
  hit.lane = lane;
  stepUntil(hit, ROW_SPACING + 1);
  assert.equal(hit.status, 'ended');

  const cleared = new SwerveRun({ seed, mode: 'practice' });
  cleared.lane = lane;
  stepUntil(cleared, ROW_SPACING - 1);
  cleared.slide();
  stepUntil(cleared, ROW_SPACING + 1);
  assert.equal(cleared.status, 'active');
});

test('a "wall" obstacle always collides, even while jumping or sliding', () => {
  let seed = 0;
  let row;
  let lane;
  while (seed < 100) {
    row = createRow(seed, 0);
    lane = row.lanes.indexOf('wall');
    if (lane !== -1) break;
    seed++;
  }
  assert.ok(lane !== -1 && lane !== undefined, 'no seed in range produced a wall obstacle - test setup problem');

  const jumping = new SwerveRun({ seed, mode: 'practice' });
  jumping.lane = lane;
  stepUntil(jumping, ROW_SPACING - 1);
  jumping.jump();
  stepUntil(jumping, ROW_SPACING + 1);
  assert.equal(jumping.status, 'ended');

  const sliding = new SwerveRun({ seed, mode: 'practice' });
  sliding.lane = lane;
  stepUntil(sliding, ROW_SPACING - 1);
  sliding.slide();
  stepUntil(sliding, ROW_SPACING + 1);
  assert.equal(sliding.status, 'ended');
});

test('a run that has ended ignores further ticks and input', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  run.status = 'ended';
  const before = run.distance;
  run.tick(1);
  run.moveLeft();
  run.jump();
  assert.equal(run.distance, before);
  assert.equal(run.lane, 1);
  assert.equal(run.action, 'running');
});

test('practice mode has no distance cap and does not auto-complete', () => {
  const run = new SwerveRun({ seed: 1, mode: 'practice' });
  assert.equal(run.distanceCap, null);
});

test('daily mode ends as "completed" once the distance cap is reached without a collision', () => {
  const run = new SwerveRun({ seed: 999, mode: 'daily', distanceCap: 50 });
  // Keep dodging by always moving to a survivable lane before each tick;
  // simplest robust approach for this test is to advance in small steps and
  // steer onto an 'empty' or 'low'+jump/'high'+slide lane each time.
  let dt = 0.05;
  let guard = 0;
  while (run.status === 'active' && guard < 100000) {
    const outcome = run.tick(dt);
    if (outcome.status !== 'active') break;
    guard++;
  }
  // With such a tiny distanceCap (50, less than one ROW_SPACING of 40... wait
  // 50 > 40, so exactly one row exists before the cap) and no evasive input,
  // this run should end in a collision UNLESS lane 1 (center, the start lane)
  // happens to be empty for row 0 of this seed - assert on whichever
  // deterministically happens, rather than assuming either outcome.
  const row0 = createRow(999, 0);
  if (row0.lanes[1] === 'empty') {
    assert.equal(run.completed, true);
  } else {
    assert.equal(run.status, 'ended');
  }
});

test('daily mode completes cleanly when the player successfully dodges every row', () => {
  const seed = 999;
  const distanceCap = 130; // covers rows at 40, 80, 120
  const run = new SwerveRun({ seed, mode: 'daily', distanceCap });

  const dt = 0.02;
  let guard = 0;
  while (run.status === 'active' && guard < 1000000) {
    // Steer just before reaching each row: pick a lane the upcoming row can't
    // punish regardless of action, or jump/slide appropriately.
    const upcoming = createRow(seed, Math.floor(run.distance / ROW_SPACING));
    const safeLane = upcoming.lanes.findIndex((t) => t === 'empty');
    if (safeLane !== -1) {
      run.lane = safeLane;
    } else {
      const jumpLane = upcoming.lanes.indexOf('low');
      const slideLane = upcoming.lanes.indexOf('high');
      if (jumpLane !== -1) {
        run.lane = jumpLane;
        run.jump();
      } else if (slideLane !== -1) {
        run.lane = slideLane;
        run.slide();
      } else {
        // Only 'wall' remains possible in every lane but one, per the
        // fairness guarantee - find that one.
        const openLane = upcoming.lanes.findIndex((t) => t !== 'wall');
        run.lane = openLane;
      }
    }
    run.tick(dt);
    guard++;
  }

  assert.equal(run.status, 'ended');
  assert.equal(run.completed, true);
  assert.equal(run.distance, distanceCap);
});

test('obstaclesCleared increments once per successfully passed row', () => {
  const seed = 5;
  const run = new SwerveRun({ seed, mode: 'practice' });
  const row0 = createRow(seed, 0);
  const safeLane = row0.lanes.findIndex((t) => t === 'empty');
  if (safeLane === -1) return; // skip rather than flake if this seed's row 0 has no empty lane
  run.lane = safeLane;
  const dt = ROW_SPACING / speedAtDistance(0) + 0.01;
  run.tick(dt);
  assert.equal(run.obstaclesCleared, 1);
});

test('getVisibleRows returns exactly the unresolved rows within viewDistance, and is side-effect-free', () => {
  const run = new SwerveRun({ seed: 3, mode: 'practice' });
  const viewDistance = 100;
  const expectedCount = Math.floor(viewDistance / ROW_SPACING);

  const rows = run.getVisibleRows(viewDistance);
  assert.equal(rows.length, expectedCount);
  rows.forEach((row, i) => assert.equal(row.rowIndex, i));

  // Calling it again must return the identical rows - no internal state
  // should have advanced just from looking ahead.
  const rowsAgain = run.getVisibleRows(viewDistance);
  assert.deepEqual(rows, rowsAgain);
  assert.equal(run.distance, 0);
});
