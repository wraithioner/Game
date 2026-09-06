// App wiring: screens, game loop, and glue between the pure modules
// (game.js, rng.js, storage.js, share.js, audio.js, render.js, input.js).
// This file intentionally holds all DOM/state-machine logic so the modules
// above stay pure and unit-testable.

import { RingRun, angleAt, angularDiff } from './game.js';
import { dailySeed, practiceSeed, utcDateString } from './rng.js';
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
import { buildShareText, shareResult, tickStripFor } from './share.js';
import { playCue, unlockAudio } from './audio.js';
import { drawFrame } from './render.js';
import { listenForTap } from './input.js';

const DAILY_LAP_CAP = 20;
const FEEDBACK_PULSE_MS = 260;
const RESULT_TRANSITION_DELAY_MS = 380;

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
  document.body.classList.toggle('colorblind-safe', settings.colorblindSafe);
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
  document.getElementById('setting-colorblind').checked = settings.colorblindSafe;
  document.querySelectorAll('input[name="theme"]').forEach((el) => {
    el.checked = el.value === settings.theme;
  });
}

function currentTheme() {
  if (settings.theme !== 'auto') return settings.theme;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function wireSettings() {
  document.getElementById('setting-sound').addEventListener('change', (e) => {
    settings = { ...settings, soundEnabled: e.target.checked };
    saveSettings(settings);
  });
  document.getElementById('setting-haptics').addEventListener('change', (e) => {
    settings = { ...settings, hapticsEnabled: e.target.checked };
    saveSettings(settings);
  });
  document.getElementById('setting-motion').addEventListener('change', (e) => {
    settings = { ...settings, reduceMotion: e.target.checked };
    saveSettings(settings);
    applySettingsToDom();
  });
  document.getElementById('setting-colorblind').addEventListener('change', (e) => {
    settings = { ...settings, colorblindSafe: e.target.checked };
    saveSettings(settings);
    applySettingsToDom();
  });
  document.querySelectorAll('input[name="theme"]').forEach((el) => {
    el.addEventListener('change', () => {
      if (el.checked) {
        settings = { ...settings, theme: el.value };
        saveSettings(settings);
        applySettingsToDom();
      }
    });
  });
}

// ---- Home screen -------------------------------------------------------------

function todayKey() {
  return utcDateString(new Date());
}

function dailyResultKey() {
  return 'ringtrue.dailyResult.v1';
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
  const dayIndex = Math.floor((Date.parse(todayKey() + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000) + 1;
  document.getElementById('ring-number').textContent = `Ring #${dayIndex}`;

  const existing = loadTodaysDailyResult();
  const statusEl = document.getElementById('today-status');
  const playDailyBtn = document.getElementById('play-daily');
  if (existing) {
    statusEl.textContent = existing.completed
      ? `Cleared today's ring — ${existing.lapsCompleted} laps`
      : `Today's ring: ${existing.lapsCompleted} laps`;
    playDailyBtn.textContent = 'View Result';
  } else {
    statusEl.textContent = 'One ring. Every player. Once a day.';
    playDailyBtn.textContent = "Play Today's Ring";
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
  document.getElementById('stat-median').textContent =
    journal.medianOffsetMs == null ? '—' : `${journal.medianOffsetMs.toFixed(0)} ms`;
  document.getElementById('stat-consistency').textContent =
    journal.consistencyMs == null ? '—' : `±${journal.consistencyMs.toFixed(0)} ms`;
  document.getElementById('stat-longest').textContent = `${stats.longestLapStreak} laps`;
  document.getElementById('stat-perfects').textContent = String(stats.totalPerfects);
  document.getElementById('stat-runs').textContent = String(stats.totalRuns);
  document.getElementById('stat-streak').textContent = `${streak.count} day${streak.count === 1 ? '' : 's'}`;
}

// ---- Run screen: the core game loop --------------------------------------------

let activeRun = null;
let lapStartPerfMs = null;
let rafId = null;
let unsubscribeInput = null;
let lastFeedback = null; // { type, atPerfMs }
let showFirstRunHint = false;

function setupCanvasResolution() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const size = 640;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return size;
}

let canvasLogicalSize = setupCanvasResolution();
window.addEventListener('resize', () => {
  canvasLogicalSize = setupCanvasResolution();
});

function startRun(mode) {
  const seed = mode === 'daily' ? dailySeed(new Date()) : practiceSeed();
  activeRun = new RingRun({ seed, mode, lapCap: mode === 'daily' ? DAILY_LAP_CAP : null });
  lapStartPerfMs = performance.now();
  lastFeedback = null;
  showFirstRunHint = !hasPlayedEver;
  document.getElementById('run-hint').hidden = !showFirstRunHint;

  showScreen('run');
  updateHud();

  if (unsubscribeInput) unsubscribeInput();
  unsubscribeInput = listenForTap(canvas, () => lapStartPerfMs, handleTap);

  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(renderLoop);
}

function updateHud() {
  document.getElementById('hud-lap').textContent = `Lap ${activeRun.lapIndex + 1}`;
  document.getElementById('hud-combo').textContent = activeRun.combo > 1 ? `×${activeRun.combo}` : '';
}

function renderLoop() {
  if (!activeRun) return;
  const nowPerf = performance.now();
  const tSeconds = (nowPerf - lapStartPerfMs) / 1000;
  const angle = activeRun.status === 'active' ? activeRun.angleAtLapTime(tSeconds) : activeRun.angleAtLapTime(0);

  const feedback = lastFeedback
    ? { type: lastFeedback.type, age: (nowPerf - lastFeedback.atPerfMs) / FEEDBACK_PULSE_MS }
    : null;

  drawFrame(ctx, canvasLogicalSize, {
    lap: activeRun.lap,
    angle,
    theme: currentTheme(),
    reduceMotion: settings.reduceMotion,
    feedback,
  });

  if (activeRun.status === 'active') {
    rafId = requestAnimationFrame(renderLoop);
  }
}

function handleTap(tSeconds) {
  if (!activeRun || activeRun.status !== 'active') return;
  unlockAudio();

  const priorLapIndex = activeRun.lapIndex;
  const outcome = activeRun.registerTap(tSeconds);
  if (!outcome) return;

  playCue(outcome.result, settings);
  lastFeedback = { type: outcome.result, atPerfMs: performance.now() };

  if (showFirstRunHint) {
    showFirstRunHint = false;
    document.getElementById('run-hint').hidden = true;
  }

  if (outcome.status === 'active') {
    lapStartPerfMs = performance.now();
    updateHud();
  } else {
    void priorLapIndex;
    setTimeout(() => finishRun(outcome), RESULT_TRANSITION_DELAY_MS);
  }
}

function voidCurrentRun() {
  // Backgrounding/navigating away mid-run discards it without penalty
  // (docs/GAME_DESIGN.md §1.13) - not scored as a Miss, not saved anywhere.
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
  if (unsubscribeInput) {
    unsubscribeInput();
    unsubscribeInput = null;
  }
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const run = activeRun;
  const perfectCount = run.results.filter((r) => r === 'perfect').length;

  stats = recordRunResult(stats, {
    offsets: run.offsets,
    perfects: perfectCount,
    lapsCompleted: run.lapIndex,
  });
  saveStats(stats);
  hasPlayedEver = true;

  if (run.mode === 'daily') {
    streak = updateStreakOnDailyAttempt(streak, todayKey());
    saveStreak(streak);
    saveTodaysDailyResult({
      results: run.results,
      lapsCompleted: run.lapIndex,
      completed: run.completed,
      score: run.score,
    });
  }

  renderResultScreen(run);
  activeRun = null;
  showScreen('result');
}

function renderResultScreen(run) {
  const title =
    run.mode === 'daily' && run.completed
      ? 'Ring cleared!'
      : run.mode === 'daily'
      ? `${run.lapIndex} laps`
      : `${run.lapIndex} laps`;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-detail').textContent = `Score ${run.score} · best combo ×${run.combo}`;
  document.getElementById('result-ticks').textContent = tickStripFor(run.results);

  const againBtn = document.getElementById('result-again');
  againBtn.textContent = run.mode === 'daily' ? 'Practice' : 'Play Again';
  againBtn.onclick = () => startRun('practice');

  document.getElementById('share-btn').onclick = async () => {
    const text = buildShareText({
      results: run.results,
      lapsCompleted: run.lapIndex,
      completed: run.completed,
      streakCount: streak.count,
      utcDateString: todayKey(),
    });
    const outcome = await shareResult(text);
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
    results: stored.results,
    lapIndex: stored.lapsCompleted,
    completed: stored.completed,
    score: stored.score,
    combo: 1,
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

document.getElementById('run-back').addEventListener('click', () => {
  voidCurrentRun();
  showScreen('home');
  refreshHomeScreen();
});

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

// Read-only debug hook for automated QA (docs/PRODUCT_PLAN.md - Testing
// Strategy). Only attached behind an explicit query flag, never in normal
// play, and exposes no write access - this is a single-player, offline,
// client-only game with no server-authoritative state to protect, so a
// read-only introspection hook carries no fairness or security risk.
if (new URLSearchParams(location.search).has('debug')) {
  window.__ringtrueDebug = {
    getRun: () => activeRun,
    getLapStartPerfMs: () => lapStartPerfMs,
    // Coarse numeric search for a tap time within the next few laps that
    // lands dead-center - used only by automated QA to simulate skilled play
    // deterministically, never by the game itself.
    findPerfectTapSeconds: (withinSeconds = 8, stepSeconds = 0.002) => {
      const lap = activeRun.lap;
      let best = { t: 0, diff: Infinity };
      for (let t = 0; t < withinSeconds; t += stepSeconds) {
        const diff = angularDiff(angleAt(lap, t), lap.centerAngle);
        if (diff < best.diff) best = { t, diff };
      }
      return best.t;
    },
  };
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline support degrades gracefully to "requires network on first load".
    });
  });
}
