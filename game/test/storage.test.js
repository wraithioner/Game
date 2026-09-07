import test from 'node:test';
import assert from 'node:assert/strict';
import { computeJournal, updateStreakOnDailyAttempt, recordRunResult } from '../src/storage.js';

test('computeJournal handles an empty history', () => {
  const journal = computeJournal({ recentDistances: [] });
  assert.equal(journal.averageDistance, null);
  assert.equal(journal.recentBest, null);
  assert.equal(journal.sampleSize, 0);
});

test('computeJournal computes the average and best of the recent window', () => {
  const journal = computeJournal({ recentDistances: [100, 200, 300, 400, 500] });
  assert.equal(journal.averageDistance, 300);
  assert.equal(journal.recentBest, 500);
  assert.equal(journal.sampleSize, 5);
});

test('recordRunResult accumulates lifetime totals and caps the distance window', () => {
  const base = { totalObstaclesCleared: 0, totalRuns: 0, bestDistance: 0, recentDistances: [] };
  const next = recordRunResult(base, { obstaclesCleared: 8, distance: 340 });
  assert.equal(next.totalRuns, 1);
  assert.equal(next.totalObstaclesCleared, 8);
  assert.equal(next.bestDistance, 340);
  assert.deepEqual(next.recentDistances, [340]);
});

test('recordRunResult tracks the best distance across multiple runs, not just the latest', () => {
  let stats = { totalObstaclesCleared: 0, totalRuns: 0, bestDistance: 0, recentDistances: [] };
  stats = recordRunResult(stats, { obstaclesCleared: 5, distance: 500 });
  stats = recordRunResult(stats, { obstaclesCleared: 2, distance: 210 });
  assert.equal(stats.bestDistance, 500, 'a worse later run must not overwrite the personal best');
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

test('rebuilding a fresh streak back up to a milestone re-earns the freeze after an earlier streak broke at that same milestone', () => {
  // Reach the 7-day milestone once, spend the freeze it grants.
  let streak = { count: 6, lastCompletedUtcDate: '2026-01-06', freezesAvailable: 0, freezesEarnedAtMilestones: [] };
  streak = updateStreakOnDailyAttempt(streak, '2026-01-07'); // count -> 7, freeze earned
  assert.equal(streak.freezesAvailable, 1);
  streak = { ...streak, freezesAvailable: 0 }; // simulate spending it

  // Now the streak breaks entirely (a gap with no freeze available).
  streak = updateStreakOnDailyAttempt(streak, '2026-01-10');
  assert.equal(streak.count, 1, 'streak should have reset to 1');
  assert.deepEqual(streak.freezesEarnedAtMilestones, [], 'milestone history should reset with the streak');

  // Build a brand-new streak back up to 7 days.
  for (let day = 11; day <= 16; day++) {
    streak = updateStreakOnDailyAttempt(streak, `2026-01-${day}`);
  }
  assert.equal(streak.count, 7);
  assert.equal(streak.freezesAvailable, 1, 'the milestone must re-grant a freeze on the new streak, not be silently withheld');
});
