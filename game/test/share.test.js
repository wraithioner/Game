import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareText, checkpointStripFor, dayIndexFromUtcDate } from '../src/share.js';

test('dayIndexFromUtcDate starts at 1 on the epoch date', () => {
  assert.equal(dayIndexFromUtcDate('2026-01-01'), 1);
  assert.equal(dayIndexFromUtcDate('2026-01-02'), 2);
});

test('checkpointStripFor fills proportionally to distance reached', () => {
  assert.equal(checkpointStripFor(0, 1000), '□□□□□□□□□□');
  assert.equal(checkpointStripFor(340, 1000), '■■■□□□□□□□');
  assert.equal(checkpointStripFor(1000, 1000), '■■■■■■■■■■');
});

test('checkpointStripFor never exceeds the strip length even past the cap', () => {
  assert.equal(checkpointStripFor(1500, 1000), '■■■■■■■■■■');
});

test('buildShareText uses simple geometric glyphs, not complex emoji', () => {
  const text = buildShareText({
    distance: 340,
    distanceCap: 1000,
    completed: false,
    streakCount: 1,
    utcDateString: '2026-01-05',
  });
  assert.match(text, /■■■□□□□□□□/);
  assert.match(text, /Swerve #5/);
  assert.match(text, /reached 340m/);
  assert.doesNotMatch(text, /streak/); // streakCount of 1 shouldn't show a streak line
});

test('buildShareText shows a completed daily run distinctly from an early collision', () => {
  const text = buildShareText({
    distance: 1000,
    distanceCap: 1000,
    completed: true,
    streakCount: 4,
    utcDateString: '2026-01-05',
  });
  assert.match(text, /cleared the course/);
  assert.match(text, /4-day streak/);
});
