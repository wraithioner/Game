import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, hashStringToSeed, dailySeed, childSeed } from '../src/rng.js';

test('mulberry32 is deterministic for a given seed', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = Array.from({ length: 10 }, () => a());
  const seqB = Array.from({ length: 10 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test('mulberry32 produces values in [0, 1)', () => {
  const rand = mulberry32(1);
  for (let i = 0; i < 1000; i++) {
    const v = rand();
    assert.ok(v >= 0 && v < 1, `value out of range: ${v}`);
  }
});

test('different seeds produce different sequences', () => {
  const a = mulberry32(1)();
  const b = mulberry32(2)();
  assert.notEqual(a, b);
});

test('hashStringToSeed is deterministic', () => {
  assert.equal(hashStringToSeed('hello'), hashStringToSeed('hello'));
  assert.notEqual(hashStringToSeed('hello'), hashStringToSeed('world'));
});

test('dailySeed is identical for the same UTC calendar date regardless of time-of-day', () => {
  const morning = new Date('2026-03-14T00:00:01Z');
  const evening = new Date('2026-03-14T23:59:59Z');
  assert.equal(dailySeed(morning), dailySeed(evening));
});

test('dailySeed differs across different UTC calendar dates', () => {
  const day1 = new Date('2026-03-14T12:00:00Z');
  const day2 = new Date('2026-03-15T12:00:00Z');
  assert.notEqual(dailySeed(day1), dailySeed(day2));
});

test('childSeed is deterministic and varies by index', () => {
  assert.equal(childSeed(123, 0), childSeed(123, 0));
  assert.notEqual(childSeed(123, 0), childSeed(123, 1));
});
