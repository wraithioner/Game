import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareText, dayIndexFromUtcDate } from '../src/share.js';

test('dayIndexFromUtcDate starts at 1 on the epoch date', () => {
  assert.equal(dayIndexFromUtcDate('2026-01-01'), 1);
  assert.equal(dayIndexFromUtcDate('2026-01-02'), 2);
});

test('buildShareText uses simple geometric glyphs, not complex emoji', () => {
  const text = buildShareText({
    results: ['perfect', 'fair', 'miss'],
    lapsCompleted: 2,
    completed: false,
    streakCount: 1,
    utcDateString: '2026-01-05',
  });
  assert.match(text, /●◐○/);
  assert.match(text, /Ringtrue #5/);
  assert.match(text, /2 laps/);
  assert.doesNotMatch(text, /streak/); // streakCount of 1 shouldn't show a streak line
});

test('buildShareText shows a completed daily ring distinctly from an early miss', () => {
  const text = buildShareText({
    results: ['perfect', 'perfect'],
    lapsCompleted: 2,
    completed: true,
    streakCount: 4,
    utcDateString: '2026-01-05',
  });
  assert.match(text, /cleared all 2/);
  assert.match(text, /4-day streak/);
});
