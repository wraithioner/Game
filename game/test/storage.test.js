import test from 'node:test';
import assert from 'node:assert/strict';
import { computeJournal, updateStreakOnDailyAttempt, recordRunResult } from '../src/storage.js';

test('computeJournal handles an empty history', () => {
  const journal = computeJournal({ recentOffsetsMs: [] });
  assert.equal(journal.medianOffsetMs, null);
  assert.equal(journal.sampleSize, 0);
});

test('computeJournal computes median and consistency', () => {
  const journal = computeJournal({ recentOffsetsMs: [10, 20, 30, 40, 50] });
  assert.equal(journal.medianOffsetMs, 30);
  assert.equal(journal.sampleSize, 5);
  assert.ok(journal.consistencyMs > 0);
});

test('recordRunResult accumulates lifetime totals and caps the offset window', () => {
  const base = { totalPerfects: 0, totalRuns: 0, longestLapStreak: 0, recentOffsetsMs: [] };
  const next = recordRunResult(base, { offsets: [5, 6, 7], perfects: 2, lapsCompleted: 3 });
  assert.equal(next.totalRuns, 1);
  assert.equal(next.totalPerfects, 2);
  assert.equal(next.longestLapStreak, 3);
  assert.deepEqual(next.recentOffsetsMs, [5, 6, 7]);
});

test('a fresh streak starts at 1 on first attempt', () => {
  const streak = { count: 0, lastCompletedUtcDate: null, freezesAvailable: 0, freezesEarnedAtMilestones: [] };
  const next = updateStreakOnDailyAttempt(streak, '2026-01-01');
  assert.equal(next.count, 1);
  assert.equal(next.lastCompletedUtcDate, '2026-01-01');
});

test('a consecutive-day attempt extends the streak', () => {
  const streak = { count: 3, lastCompletedUtcDate: '2026-01-01', freezesAvailable: 0, freezesEarnedAtMilestones: [] };
  const next = updateStreakOnDailyAttempt(streak, '2026-01-02');
  assert.equal(next.count, 4);
});

test('a skipped day with no freeze breaks the streak back to 1', () => {
  const streak = { count: 5, lastCompletedUtcDate: '2026-01-01', freezesAvailable: 0, freezesEarnedAtMilestones: [] };
  const next = updateStreakOnDailyAttempt(streak, '2026-01-03');
  assert.equal(next.count, 1);
});

test('a skipped day WITH an earned freeze preserves and extends the streak, consuming the freeze', () => {
  const streak = { count: 5, lastCompletedUtcDate: '2026-01-01', freezesAvailable: 1, freezesEarnedAtMilestones: [0] };
  const next = updateStreakOnDailyAttempt(streak, '2026-01-03');
  assert.equal(next.count, 6);
  assert.equal(next.freezesAvailable, 0);
});

test('attempting the same UTC day twice is a no-op', () => {
  const streak = { count: 2, lastCompletedUtcDate: '2026-01-01', freezesAvailable: 0, freezesEarnedAtMilestones: [] };
  const next = updateStreakOnDailyAttempt(streak, '2026-01-01');
  assert.deepEqual(next, streak);
});

test('reaching a 7-day milestone earns exactly one freeze, once', () => {
  let streak = { count: 6, lastCompletedUtcDate: '2026-01-06', freezesAvailable: 0, freezesEarnedAtMilestones: [] };
  streak = updateStreakOnDailyAttempt(streak, '2026-01-07'); // count -> 7
  assert.equal(streak.count, 7);
  assert.equal(streak.freezesAvailable, 1);
  assert.deepEqual(streak.freezesEarnedAtMilestones, [1]);

  // Extending further without hitting the next milestone must not re-grant a freeze.
  streak = updateStreakOnDailyAttempt(streak, '2026-01-08'); // count -> 8
  assert.equal(streak.freezesAvailable, 1);
});
