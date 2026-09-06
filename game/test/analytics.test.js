import test from 'node:test';
import assert from 'node:assert/strict';
import { track, getRecentEvents } from '../src/analytics.js';

test('track records an event with its properties', () => {
  track('run_started', { mode: 'practice' });
  const events = getRecentEvents();
  const last = events[events.length - 1];
  assert.equal(last.event, 'run_started');
  assert.deepEqual(last.properties, { mode: 'practice' });
  assert.equal(typeof last.atMs, 'number');
});

test('track defaults to an empty properties object', () => {
  track('session_start');
  const events = getRecentEvents();
  const last = events[events.length - 1];
  assert.deepEqual(last.properties, {});
});

test('the event buffer is capped and drops the oldest entries', () => {
  for (let i = 0; i < 250; i++) {
    track('run_started', { i });
  }
  const events = getRecentEvents();
  assert.ok(events.length <= 200, `buffer should be capped at 200, got ${events.length}`);
  // The most recent event should be the last one recorded.
  assert.equal(events[events.length - 1].properties.i, 249);
});

test('getRecentEvents returns a copy, not the live buffer', () => {
  track('run_started', { mode: 'daily' });
  const events = getRecentEvents();
  events.pop();
  const eventsAgain = getRecentEvents();
  assert.notEqual(events.length, eventsAgain.length);
});
