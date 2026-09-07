// localStorage-backed persistence: stats, settings, streak. No account, no
// server, no sync (docs/PRODUCT_PLAN.md - Technical Architecture: this is a
// deliberate MVP scope decision, not an oversight). Every read/write is
// wrapped in try/catch: private-browsing modes and storage-blocking settings
// can make localStorage throw, and the game must still run correctly with no
// persistence at all in that case.

const KEYS = {
  stats: 'swerve.stats.v1',
  settings: 'swerve.settings.v1',
  streak: 'swerve.streak.v1',
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
  theme: 'auto', // 'auto' | 'light' | 'dark'
});

const DEFAULT_STATS = Object.freeze({
  totalRuns: 0,
  totalObstaclesCleared: 0,
  bestDistance: 0, // best distance reached across any single run, ever
  recentDistances: [], // capped rolling window, for recent-form stats
});

const DEFAULT_STREAK = Object.freeze({
  count: 0,
  lastCompletedUtcDate: null, // "YYYY-MM-DD"
  freezesAvailable: 0,
  freezesEarnedAtMilestones: [], // which 7-day milestones already granted a freeze
});

const DISTANCE_WINDOW = 200; // cap so storage doesn't grow unbounded over a long-lived install

export function loadSettings() {
  return readJSON(KEYS.settings, { ...DEFAULT_SETTINGS });
}

export function saveSettings(settings) {
  writeJSON(KEYS.settings, settings);
}

export function loadStats() {
  return readJSON(KEYS.stats, { ...DEFAULT_STATS, recentDistances: [] });
}

export function saveStats(stats) {
  writeJSON(KEYS.stats, stats);
}

/** Folds one completed run's results into lifetime stats. */
export function recordRunResult(stats, { obstaclesCleared, distance }) {
  const next = {
    ...stats,
    totalRuns: stats.totalRuns + 1,
    totalObstaclesCleared: stats.totalObstaclesCleared + obstaclesCleared,
    bestDistance: Math.max(stats.bestDistance, distance),
    recentDistances: [...stats.recentDistances, distance].slice(-DISTANCE_WINDOW),
  };
  return next;
}

/** Recent-form stats (average and best distance over the rolling window) -
 * distinct from lifetime bestDistance, which the window can't erase. */
export function computeJournal(stats) {
  const distances = stats.recentDistances;
  if (distances.length === 0) {
    return { averageDistance: null, recentBest: null, sampleSize: 0 };
  }
  const averageDistance = distances.reduce((sum, v) => sum + v, 0) / distances.length;
  const recentBest = Math.max(...distances);
  return { averageDistance, recentBest, sampleSize: distances.length };
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
 * Updates the streak after a Daily Run attempt. Counts PARTICIPATION, not
 * performance (docs/GAME_DESIGN.md §1.9) - any attempt, even one ending in
 * an immediate collision, extends the streak, specifically to avoid
 * punishing a bad day twice. A gap of exactly one day consumes an earned
 * freeze if one is available.
 */
export function updateStreakOnDailyAttempt(streak, todayUtcDate) {
  if (streak.lastCompletedUtcDate === todayUtcDate) {
    return streak; // already recorded today, no-op
  }

  let count = streak.count;
  let freezesAvailable = streak.freezesAvailable;
  // Milestones are tracked relative to the CURRENT streak, not lifetime -
  // otherwise rebuilding a fresh streak back up to a milestone already
  // reached (and reset) by an earlier, broken streak would silently
  // withhold the freeze it should re-earn.
  let freezesEarnedAtMilestones = streak.freezesEarnedAtMilestones;

  if (streak.lastCompletedUtcDate === null) {
    count = 1;
    freezesEarnedAtMilestones = [];
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
      freezesEarnedAtMilestones = [];
    }
  }

  const milestone = Math.floor(count / 7);
  const nextMilestones = [...freezesEarnedAtMilestones];
  if (milestone > 0 && !nextMilestones.includes(milestone)) {
    nextMilestones.push(milestone);
    freezesAvailable += 1;
  }

  return {
    count,
    lastCompletedUtcDate: todayUtcDate,
    freezesAvailable,
    freezesEarnedAtMilestones: nextMilestones,
  };
}
