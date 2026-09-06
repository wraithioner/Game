// localStorage-backed persistence: stats, settings, streak. No account, no
// server, no sync (docs/PRODUCT_PLAN.md - Technical Architecture: this is a
// deliberate MVP scope decision, not an oversight). Every read/write is
// wrapped in try/catch: private-browsing modes and storage-blocking settings
// can make localStorage throw, and the game must still run correctly with no
// persistence at all in that case.

const KEYS = {
  stats: 'ringtrue.stats.v1',
  settings: 'ringtrue.settings.v1',
  streak: 'ringtrue.streak.v1',
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota, disabled) - fail silently.
    // The game must remain fully playable with no persistence.
  }
}

const DEFAULT_SETTINGS = Object.freeze({
  soundEnabled: true,
  hapticsEnabled: true,
  reduceMotion: false,
  colorblindSafe: false,
  theme: 'auto', // 'auto' | 'light' | 'dark'
});

const DEFAULT_STATS = Object.freeze({
  totalPerfects: 0,
  totalRuns: 0,
  longestLapStreak: 0, // best lapsCompleted across any single run
  recentOffsetsMs: [], // capped rolling window, for median/consistency
});

const DEFAULT_STREAK = Object.freeze({
  count: 0,
  lastCompletedUtcDate: null, // "YYYY-MM-DD"
  freezesAvailable: 0,
  freezesEarnedAtMilestones: [], // which 7-day milestones already granted a freeze
});

const OFFSET_WINDOW = 200; // cap so storage doesn't grow unbounded over a long-lived install

export function loadSettings() {
  return readJSON(KEYS.settings, { ...DEFAULT_SETTINGS });
}

export function saveSettings(settings) {
  writeJSON(KEYS.settings, settings);
}

export function loadStats() {
  return readJSON(KEYS.stats, { ...DEFAULT_STATS, recentOffsetsMs: [] });
}

export function saveStats(stats) {
  writeJSON(KEYS.stats, stats);
}

/** Folds one completed run's results into lifetime stats. */
export function recordRunResult(stats, { offsets, perfects, lapsCompleted }) {
  const next = {
    ...stats,
    totalRuns: stats.totalRuns + 1,
    totalPerfects: stats.totalPerfects + perfects,
    longestLapStreak: Math.max(stats.longestLapStreak, lapsCompleted),
    recentOffsetsMs: [...stats.recentOffsetsMs, ...offsets].slice(-OFFSET_WINDOW),
  };
  return next;
}

/** Median and consistency (population stddev) of the recent-offsets window. */
export function computeJournal(stats) {
  const offsets = stats.recentOffsetsMs;
  if (offsets.length === 0) {
    return { medianOffsetMs: null, consistencyMs: null, sampleSize: 0 };
  }
  const sorted = [...offsets].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianOffsetMs =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const mean = offsets.reduce((sum, v) => sum + v, 0) / offsets.length;
  const variance = offsets.reduce((sum, v) => sum + (v - mean) ** 2, 0) / offsets.length;
  const consistencyMs = Math.sqrt(variance);

  return { medianOffsetMs, consistencyMs, sampleSize: offsets.length };
}

export function loadStreak() {
  return readJSON(KEYS.streak, { ...DEFAULT_STREAK, freezesEarnedAtMilestones: [] });
}

export function saveStreak(streak) {
  writeJSON(KEYS.streak, streak);
}

function daysBetweenUtc(dateStrA, dateStrB) {
  const a = Date.parse(dateStrA + 'T00:00:00Z');
  const b = Date.parse(dateStrB + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

/**
 * Updates the streak after a Daily Ring attempt. Counts PARTICIPATION, not
 * performance (docs/GAME_DESIGN.md §1.9) - any attempt, even a 1-lap result,
 * extends the streak, specifically to avoid punishing a bad day twice.
 * A gap of exactly one day consumes an earned freeze if one is available.
 */
export function updateStreakOnDailyAttempt(streak, todayUtcDate) {
  if (streak.lastCompletedUtcDate === todayUtcDate) {
    return streak; // already recorded today, no-op
  }

  let count = streak.count;
  let freezesAvailable = streak.freezesAvailable;

  if (streak.lastCompletedUtcDate === null) {
    count = 1;
  } else {
    const gap = daysBetweenUtc(streak.lastCompletedUtcDate, todayUtcDate);
    if (gap === 1) {
      count += 1;
    } else if (gap === 2 && freezesAvailable > 0) {
      // exactly one missed day, covered by an earned freeze
      freezesAvailable -= 1;
      count += 1;
    } else {
      count = 1; // streak broken
    }
  }

  const milestone = Math.floor(count / 7);
  const freezesEarnedAtMilestones = [...streak.freezesEarnedAtMilestones];
  if (milestone > 0 && !freezesEarnedAtMilestones.includes(milestone)) {
    freezesEarnedAtMilestones.push(milestone);
    freezesAvailable += 1;
  }

  return {
    count,
    lastCompletedUtcDate: todayUtcDate,
    freezesAvailable,
    freezesEarnedAtMilestones,
  };
}
