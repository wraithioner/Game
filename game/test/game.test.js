import test from 'node:test';
import assert from 'node:assert/strict';
import { createLap, angleAt, angularVelocityAt, angularDiff, judge, RingRun, TAU } from '../src/game.js';

test('angularDiff is symmetric and bounded by PI', () => {
  assert.equal(angularDiff(0.1, 0.1), 0);
  assert.ok(Math.abs(angularDiff(0, Math.PI) - Math.PI) < 1e-9);
  assert.ok(Math.abs(angularDiff(0.1, TAU - 0.1) - 0.2) < 1e-9);
  for (let i = 0; i < 100; i++) {
    const a = Math.random() * TAU;
    const b = Math.random() * TAU;
    const d = angularDiff(a, b);
    assert.ok(d >= 0 && d <= Math.PI + 1e-9);
    assert.ok(Math.abs(d - angularDiff(b, a)) < 1e-9);
  }
});

test('angleAt is a deterministic, exact function of time (no accumulation state)', () => {
  const lap = createLap(777, 5);
  const a1 = angleAt(lap, 3.14159);
  const a2 = angleAt(lap, 3.14159);
  assert.equal(a1, a2);
  // Evaluating "out of order" (as a real input event might arrive relative to
  // rendering) must give the same answer as evaluating in order - this is the
  // whole point of a closed-form angle function instead of frame accumulation.
  const late = angleAt(lap, 10);
  const early = angleAt(lap, 1);
  assert.equal(early, angleAt(lap, 1));
  assert.equal(late, angleAt(lap, 10));
});

test('angleAt stays within [0, TAU)', () => {
  const lap = createLap(1, 0);
  for (let t = 0; t < 50; t += 0.37) {
    const a = angleAt(lap, t);
    assert.ok(a >= 0 && a < TAU, `angle out of range at t=${t}: ${a}`);
  }
});

test('the non-periodic sweep is not constant angular velocity', () => {
  const lap = createLap(1, 0);
  const v1 = angularVelocityAt(lap, 0.5);
  const v2 = angularVelocityAt(lap, 4.5);
  assert.notEqual(v1, v2, 'angular velocity should vary over time, not stay constant');
});

test('difficulty ramps toward the plateau and then holds', () => {
  const early = createLap(1, 0);
  const mid = createLap(1, 10);
  const plateau = createLap(1, 25);
  const pastPlateau = createLap(1, 100);
  assert.ok(early.baseSpeed < mid.baseSpeed);
  assert.ok(mid.baseSpeed < plateau.baseSpeed);
  assert.equal(plateau.baseSpeed, pastPlateau.baseSpeed, 'speed must not exceed the plateau');
  assert.equal(plateau.fairHalfWidth, pastPlateau.fairHalfWidth, 'band width must not exceed the plateau');
});

test('a tap dead-center at t=0 is always a Perfect', () => {
  const lap = createLap(1, 0);
  // Force the tap time to exactly match the target center by construction:
  // find t such that angleAt(lap, t) === lap.centerAngle at t=0 is unlikely,
  // so instead verify the inverse property: a diff of 0 always judges Perfect.
  const result = judge({ ...lap, centerAngle: angleAt(lap, 0) }, 0);
  assert.equal(result.result, 'perfect');
  assert.equal(result.diff, 0);
});

test('a tap far from the target is a Miss', () => {
  const lap = createLap(1, 0);
  const farAngle = lap.centerAngle + Math.PI; // maximally far, on the ring
  // Solve for a t whose angle is far from center: since angleAt(0)=0, offset
  // the lap's centerAngle instead of searching for t, for a deterministic test.
  const farLap = { ...lap, centerAngle: (angleAt(lap, 0) + Math.PI) % TAU };
  const result = judge(farLap, 0);
  assert.equal(result.result, 'miss');
});

test('RingRun.registerTap is deterministic: replaying the same tap sequence on the same seed reproduces the same outcomes', () => {
  function playSequence(seed, taps) {
    const run = new RingRun({ seed, mode: 'practice' });
    const outcomes = [];
    for (const t of taps) {
      const outcome = run.registerTap(t);
      outcomes.push(outcome);
      if (outcome.status === 'ended') break;
    }
    return outcomes;
  }

  const seed = 424242;
  // Use each lap's own dead-center angle as the "tap angle", converted to a
  // tap time by scanning - simpler: just tap at fixed times and compare two
  // independent runs against each other, which is what determinism actually
  // requires (not that they're all Perfects).
  const taps = [0.3, 1.1, 2.7, 0.9, 4.2, 1.6, 3.3];
  const outcomesA = playSequence(seed, taps);
  const outcomesB = playSequence(seed, taps);
  assert.deepEqual(outcomesA, outcomesB);
});

test('two different seeds produce a different daily ring layout', () => {
  const lapA = createLap(111, 0);
  const lapB = createLap(222, 0);
  assert.notEqual(lapA.centerAngle, lapB.centerAngle);
});

test('a Miss ends the run and further taps are ignored', () => {
  const run = new RingRun({ seed: 5, mode: 'practice' });
  // Force a miss deterministically by overriding the lap's center to be
  // maximally far from wherever t=0 currently points.
  run.lap = { ...run.lap, centerAngle: (angleAt(run.lap, 0) + Math.PI) % TAU };
  const first = run.registerTap(0);
  assert.equal(first.result, 'miss');
  assert.equal(run.status, 'ended');
  const second = run.registerTap(1);
  assert.equal(second, null);
});

test('a Fair result halves the combo instead of resetting it to zero', () => {
  const run = new RingRun({ seed: 9, mode: 'practice' });
  run.combo = 8;
  // Force a Fair: center offset just outside trueHalfWidth but inside fairHalfWidth.
  const center = angleAt(run.lap, 0);
  const offset = (run.lap.trueHalfWidth + run.lap.fairHalfWidth) / 2;
  run.lap = { ...run.lap, centerAngle: (center + offset) % TAU };
  const outcome = run.registerTap(0);
  assert.equal(outcome.result, 'fair');
  assert.equal(outcome.combo, 4); // floor(8/2)
});

test('a Perfect increments the combo by one', () => {
  const run = new RingRun({ seed: 9, mode: 'practice' });
  run.combo = 3;
  run.lap = { ...run.lap, centerAngle: angleAt(run.lap, 0) };
  const outcome = run.registerTap(0);
  assert.equal(outcome.result, 'perfect');
  assert.equal(outcome.combo, 4);
});

test('daily mode ends (completed) once the lap cap is reached without a miss', () => {
  const run = new RingRun({ seed: 3, mode: 'daily', lapCap: 3 });
  for (let i = 0; i < 3; i++) {
    run.lap = { ...run.lap, centerAngle: angleAt(run.lap, 0) };
    const outcome = run.registerTap(0);
    if (i < 2) {
      assert.equal(outcome.status, 'active');
    } else {
      assert.equal(outcome.status, 'ended');
      assert.equal(outcome.completed, true);
      assert.equal(outcome.lapsCompleted, 3);
    }
  }
});

test('practice mode has no lap cap', () => {
  const run = new RingRun({ seed: 3, mode: 'practice' });
  assert.equal(run.lapCap, null);
});

test('constructing a run with an invalid mode throws', () => {
  assert.throws(() => new RingRun({ seed: 1, mode: 'bogus' }));
});
