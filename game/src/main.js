// App wiring: screens, game loop, and glue between the pure modules
// (game.js, rng.js, storage.js, share.js, audio.js, render.js, input.js).
// This file intentionally holds all DOM/state-machine logic so the modules
// above stay pure and unit-testable.

import { SwerveRun, VIEW_DISTANCE, DAILY_DISTANCE_CAP, speedAtDistance } from './game.js';
import { dailySeed, practiceSeed, utcDateString, hashStringToSeed } from './rng.js';
import {
  loadSettings,
  saveSettings,
  loadStats,
  saveStats,
  recordRunResult,
  computeJournal,
  loadStreak,
  saveStreak,
  updateStreakOnDailyAttempt,
} from './storage.js';
import { buildShareText, shareResult, checkpointStripFor, dayIndexFromUtcDate } from './share.js';
import { playCue, unlockAudio } from './audio.js';
import { drawFrame } from './render.js';
import { listenForGestures } from './input.js';
import { track, getRecentEvents } from './analytics.js';

const RESULT_TRANSITION_DELAY_MS = 380;
const BASE_WIDTH = 300;
const BASE_HEIGHT = 500;

// ---- Persistent state (loaded once, saved on change) ----------------------

let settings = loadSettings();
let stats = loadStats();
let streak = loadStreak();
let hasPlayedEver = stats.totalRuns > 0;

// ---- DOM references --------------------------------------------------------

const screens = {};
document.querySelectorAll('[data-screen]').forEach((el) => {
  screens[el.dataset.screen] = el;
});

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ---- Screen management ------------------------------------------------------

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

// ---- Settings application ---------------------------------------------------

function applySettingsToDom() {
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  const root = document.documentElement;
  if (settings.theme === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', settings.theme);
  }

  document.getElementById('setting-sound').checked = settings.soundEnabled;
  document.getElementById('setting-haptics').checked = settings.hapticsEnabled;
  document.getElementById('setting-motion').checked = settings.reduceMotion;
  document.querySelectorAll('input[name="theme"]').forEach((el) => {
    el.checked = el.value === settings.theme;
  });
}

function wireSettings() {
  document.getElementById('setting-sound').addEventListener('change', (e) => {
    settings = { ...settings, soundEnabled: e.target.checked };
    saveSettings(settings);
    track('settings_changed', { settingName: 'soundEnabled', newValue: e.target.checked });
  });
  document.getElementById('setting-haptics').addEventListener('change', (e) => {
    settings = { ...settings, hapticsEnabled: e.target.checked };
    saveSettings(settings);
    track('settings_changed', { settingName: 'hapticsEnabled', newValue: e.target.checked });
  });
  document.getElementById('setting-motion').addEventListener('change', (e) => {
    settings = { ...settings, reduceMotion: e.target.checked };
    saveSettings(settings);
    applySettingsToDom();
    track('settings_changed', { settingName: 'reduceMotion', newValue: e.target.checked });
  });
  document.querySelectorAll('input[name="theme"]').forEach((el) => {
    el.addEventListener('change', () => {
      if (el.checked) {
        settings = { ...settings, theme: el.value };
        saveSettings(settings);
        applySettingsToDom();
        track('settings_changed', { settingName: 'theme', newValue: el.value });
      }
    });
  });
}

// ---- Home screen -------------------------------------------------------------

function todayKey() {
  return utcDateString(new Date());
}

function dailyResultKey() {
  return 'swerve.dailyResult.v1';
}

function loadTodaysDailyResult() {
  try {
    const raw = localStorage.getItem(dailyResultKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.utcDate === todayKey() ? parsed : null;
  } catch {
    return null;
  }
}

function saveTodaysDailyResult(result) {
  try {
    localStorage.setItem(dailyResultKey(), JSON.stringify({ ...result, utcDate: todayKey() }));
  } catch {
    // Non-fatal: worst case, the daily can be replayed once this session.
  }
}

function refreshHomeScreen() {
  document.getElementById('run-number').textContent = `Run #${dayIndexFromUtcDate(todayKey())}`;

  const existing = loadTodaysDailyResult();
  const statusEl = document.getElementById('today-status');
  const playDailyBtn = document.getElementById('play-daily');
  if (existing) {
    statusEl.textContent = existing.completed
      ? `Cleared today's run — ${Math.round(existing.distance)}m`
      : `Today's run: ${Math.round(existing.distance)}m`;
    playDailyBtn.textContent = 'View Result';
  } else {
    statusEl.textContent = 'One course. Every player. Once a day.';
    playDailyBtn.textContent = "Play Today's Run";
  }

  const flame = document.getElementById('streak-flame');
  if (streak.count > 1) {
    flame.hidden = false;
    document.getElementById('streak-count').textContent = String(streak.count);
  } else {
    flame.hidden = true;
  }
}

// ---- Journal screen ------------------------------------------------------------

function refreshJournalScreen() {
  const journal = computeJournal(stats);
  document.getElementById('stat-best').textContent = stats.bestDistance ? `${Math.round(stats.bestDistance)}m` : '—';
  document.getElementById('stat-average').textContent =
    journal.averageDistance == null ? '—' : `${Math.round(journal.averageDistance)}m`;
  document.getElementById('stat-recent-best').textContent =
    journal.recentBest == null ? '—' : `${Math.round(journal.recentBest)}m`;
  document.getElementById('stat-cleared').textContent = String(stats.totalObstaclesCleared);
  document.getElementById('stat-runs').textContent = String(stats.totalRuns);
  document.getElementById('stat-streak').textContent = `${streak.count} day${streak.count === 1 ? '' : 's'}`;
}

// ---- Run screen: the core game loop --------------------------------------------

let activeRun = null;
let lastFramePerfMs = null;
let runStartPerfMs = null;
let rafId = null;
let unsubscribeInput = null;
let showFirstRunHint = false;

function setupCanvasResolution() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = BASE_WIDTH * dpr;
  canvas.height = BASE_HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: BASE_WIDTH, height: BASE_HEIGHT };
}

let canvasLogicalSize = setupCanvasResolution();
window.addEventListener('resize', () => {
  canvasLogicalSize = setupCanvasResolution();
});

function startRun(mode) {
  const seed = mode === 'daily' ? dailySeed(new Date()) : practiceSeed();
  activeRun = new SwerveRun({ seed, mode });
  lastFramePerfMs = performance.now();
  runStartPerfMs = lastFramePerfMs;
  showFirstRunHint = !hasPlayedEver;
  document.getElementById('run-hint').hidden = !showFirstRunHint;

  track('run_started', { mode });
  if (mode === 'daily') track('daily_challenge_started', { dayIndex: dayIndexFromUtcDate(todayKey()) });
  if (showFirstRunHint) track('first_run_demo_seen', {});

  showScreen('run');
  updateHud();

  if (unsubscribeInput) unsubscribeInput();
  // Listens on the whole run screen, not just the canvas rectangle, so the
  // HUD margins and hint-text area are swipeable too, not just the track itself.
  unsubscribeInput = listenForGestures(screens.run, {
    onLeft: () => handleAction(() => activeRun.moveLeft(), 'laneChange'),
    onRight: () => handleAction(() => activeRun.moveRight(), 'laneChange'),
    onJump: () => handleAction(() => activeRun.jump(), 'jump'),
    onSlide: () => handleAction(() => activeRun.slide(), 'slide'),
  });

  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(renderLoop);
}

function updateHud() {
  document.getElementById('hud-distance').textContent = `${Math.round(activeRun.distance)}m`;
}

function handleAction(applyAction, cueName) {
  if (!activeRun || activeRun.status !== 'active') return;
  unlockAudio();
  applyAction();
  playCue(cueName, settings);

  if (showFirstRunHint) {
    showFirstRunHint = false;
    document.getElementById('run-hint').hidden = true;
  }
}

function renderLoop(nowPerf) {
  if (!activeRun) return;
  // Clamped so a backgrounded/throttled tab resuming after a long gap can't
  // hand the simulation a huge dt and skip straight past several rows.
  const dtSeconds = Math.min((nowPerf - lastFramePerfMs) / 1000, 0.1);
  lastFramePerfMs = nowPerf;

  const outcome = activeRun.tick(dtSeconds);

  drawFrame(ctx, canvasLogicalSize, {
    lane: outcome.lane,
    action: outcome.action,
    distance: outcome.distance,
    visibleRows: activeRun.getVisibleRows(VIEW_DISTANCE),
    reduceMotion: settings.reduceMotion,
  });

  if (outcome.status === 'active') {
    updateHud();
    rafId = requestAnimationFrame(renderLoop);
    return;
  }

  rafId = null;
  if (unsubscribeInput) {
    unsubscribeInput();
    unsubscribeInput = null;
  }
  playCue(outcome.completed ? 'milestone' : 'collision', settings);
  setTimeout(() => finishRun(outcome), RESULT_TRANSITION_DELAY_MS);
}

function voidCurrentRun() {
  // Backgrounding/navigating away mid-run discards it without penalty - not
  // scored as a collision, not saved anywhere.
  if (unsubscribeInput) {
    unsubscribeInput();
    unsubscribeInput = null;
  }
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  activeRun = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && activeRun && activeRun.status === 'active') {
    voidCurrentRun();
    showScreen('home');
    refreshHomeScreen();
  }
});

// ---- Result screen -------------------------------------------------------------

function finishRun(outcome) {
  const run = activeRun;

  stats = recordRunResult(stats, {
    obstaclesCleared: run.obstaclesCleared,
    distance: run.distance,
  });
  saveStats(stats);
  hasPlayedEver = true;

  track('run_ended', {
    mode: run.mode,
    durationMs: Math.round(performance.now() - runStartPerfMs),
    distance: Math.round(run.distance),
    completed: run.completed,
  });

  if (run.mode === 'daily') {
    const previousStreak = streak;
    streak = updateStreakOnDailyAttempt(streak, todayKey());
    saveStreak(streak);
    saveTodaysDailyResult({
      distance: run.distance,
      completed: run.completed,
      obstaclesCleared: run.obstaclesCleared,
    });

    track('daily_challenge_completed', {
      dayIndex: dayIndexFromUtcDate(todayKey()),
      completed: run.completed,
      distance: Math.round(run.distance),
    });

    if (streak.count === 1 && previousStreak.count > 1) {
      track('streak_broken', { streakLengthAtBreak: previousStreak.count });
    } else if (streak.freezesAvailable < previousStreak.freezesAvailable) {
      track('streak_freeze_used', { streakLength: streak.count });
    } else if (streak.count > previousStreak.count) {
      track('streak_extended', { streakLength: streak.count });
    }
  }

  renderResultScreen(run);
  activeRun = null;
  showScreen('result');
}

function renderResultScreen(run) {
  const title = run.completed ? 'Course cleared!' : `${Math.round(run.distance)}m`;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-detail').textContent =
    `${run.obstaclesCleared} obstacle${run.obstaclesCleared === 1 ? '' : 's'} cleared`;
  // Always normalized against the daily distance cap, even for a practice
  // run, so the strip reads as "progress toward a comparable benchmark"
  // rather than needing a second, uncapped visual language.
  document.getElementById('result-ticks').textContent = checkpointStripFor(run.distance, DAILY_DISTANCE_CAP);

  const againBtn = document.getElementById('result-again');
  againBtn.textContent = run.mode === 'daily' ? 'Practice' : 'Play Again';
  againBtn.onclick = () => startRun('practice');

  document.getElementById('share-btn').onclick = async () => {
    const text = buildShareText({
      distance: run.distance,
      distanceCap: DAILY_DISTANCE_CAP,
      completed: run.completed,
      streakCount: streak.count,
      utcDateString: todayKey(),
    });
    track('share_card_generated', {});
    const outcome = await shareResult(text);
    if (outcome === 'native-share' || outcome === 'clipboard') {
      track('share_card_shared', { destination: outcome });
    }
    const toast = document.getElementById('share-toast');
    toast.hidden = false;
    toast.textContent =
      outcome === 'clipboard'
        ? 'Copied to clipboard'
        : outcome === 'native-share'
        ? 'Shared'
        : outcome === 'cancelled'
        ? ''
        : 'Could not share on this device';
  };

  document.getElementById('share-toast').hidden = true;
}

function showStoredDailyResult(stored) {
  renderResultScreen({
    mode: 'daily',
    distance: stored.distance,
    completed: stored.completed,
    obstaclesCleared: stored.obstaclesCleared,
  });
  showScreen('result');
}

// ---- Wiring ----------------------------------------------------------------------

document.getElementById('play-daily').addEventListener('click', () => {
  const existing = loadTodaysDailyResult();
  if (existing) {
    showStoredDailyResult(existing);
  } else {
    startRun('daily');
  }
});

document.getElementById('play-practice').addEventListener('click', () => startRun('practice'));

document.getElementById('result-home').addEventListener('click', () => {
  showScreen('home');
  refreshHomeScreen();
});

document.getElementById('open-journal').addEventListener('click', () => {
  refreshJournalScreen();
  showScreen('journal');
});

document.getElementById('open-settings').addEventListener('click', () => showScreen('settings'));

document.querySelectorAll('.back-home').forEach((btn) => {
  btn.addEventListener('click', () => {
    showScreen('home');
    refreshHomeScreen();
  });
});

// ---- Boot ---------------------------------------------------------------------

applySettingsToDom();
wireSettings();
refreshHomeScreen();
showScreen('home');

track('session_start', {
  isPwaInstall: window.matchMedia && window.matchMedia('(display-mode: standalone)').matches,
  referrerType: document.referrer ? 'external' : 'direct',
  deviceTier: (navigator.hardwareConcurrency || 0) <= 4 ? 'low-or-unknown' : 'higher',
});

window.addEventListener('beforeinstallprompt', () => track('pwa_install_prompt_shown', {}));
window.addEventListener('appinstalled', () => track('pwa_install_accepted', {}));

window.addEventListener('error', (event) => {
  const detail = event.error ? event.error.stack || event.error.message : event.message;
  track('error_boundary_hit', { errorType: 'error', stackHash: hashStringToSeed(String(detail)) });
});
window.addEventListener('unhandledrejection', (event) => {
  const detail = event.reason && event.reason.stack ? event.reason.stack : String(event.reason);
  track('error_boundary_hit', { errorType: 'unhandledrejection', stackHash: hashStringToSeed(detail) });
});

// Read-only debug hook for automated QA (docs/PRODUCT_PLAN.md - Testing
// Strategy). Only attached behind an explicit query flag, never in normal
// play, and exposes no write access to the run itself beyond calling the
// same public methods a real gesture would - this is a single-player,
// offline, client-only game with no server-authoritative state to protect,
// so this carries no fairness or security risk.
if (new URLSearchParams(location.search).has('debug')) {
  window.__swerveDebug = {
    getRun: () => activeRun,
    getRecentEvents,
    speedAtDistance,
  };
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline support degrades gracefully to "requires network on first load".
    });
  });
}
