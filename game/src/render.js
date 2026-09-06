// Canvas rendering. Purely visual - never a source of truth for hit judgment
// (that lives entirely in game.js's closed-form angle function), and
// deliberately decoupled from feedback timing so a slow frame never changes
// an outcome (docs/GAME_DESIGN.md §1.5, "fairness notes").

import { TAU } from './game.js';

const COLORS = {
  light: {
    bg: '#faf8f5',
    ring: '#d8d3ca',
    pointer: '#2b2b2e',
    fair: '#3d6fb4', // blue - colorblind-safe pairing with amber
    true: '#c98a1c', // amber
    text: '#2b2b2e',
  },
  dark: {
    bg: '#15151a',
    ring: '#39393f',
    pointer: '#f2f0ec',
    fair: '#6fa8e0',
    true: '#e0ac4b',
    text: '#f2f0ec',
  },
};

export function getPalette(theme) {
  return COLORS[theme] || COLORS.light;
}

/**
 * Draws one frame: the ring, the target's Fair/True bands, the sweeping
 * pointer, and (for Perfect/Miss) a brief feedback pulse.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{lap: object, angle: number, theme: 'light'|'dark', reduceMotion: boolean, feedback: {type: string, age: number}|null}} state
 */
export function drawFrame(ctx, canvasSize, state) {
  const { lap, angle, theme, reduceMotion, feedback } = state;
  const palette = getPalette(theme);
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const radius = canvasSize * 0.36;

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Ring track
  ctx.lineWidth = canvasSize * 0.02;
  ctx.strokeStyle = palette.ring;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.stroke();

  // Fair band (wide arc)
  drawBand(ctx, cx, cy, radius, lap.centerAngle, lap.fairHalfWidth, palette.fair, canvasSize * 0.055);
  // True band (narrow arc, drawn on top - also visually distinct by width,
  // not just color, per docs/GAME_DESIGN.md §3.2 redundant-encoding rule)
  drawBand(ctx, cx, cy, radius, lap.centerAngle, lap.trueHalfWidth, palette.true, canvasSize * 0.055);

  // Perfect/Fair feedback pulse (skipped or minimized under reduceMotion)
  if (feedback && !reduceMotion) {
    drawPulse(ctx, cx, cy, radius, feedback, palette);
  }

  // Sweeping pointer
  const px = cx + Math.cos(angle) * radius;
  const py = cy + Math.sin(angle) * radius;
  ctx.fillStyle = palette.pointer;
  ctx.beginPath();
  ctx.arc(px, py, canvasSize * 0.022, 0, TAU);
  ctx.fill();
}

function drawBand(ctx, cx, cy, radius, centerAngle, halfWidth, color, lineWidth) {
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, centerAngle - halfWidth, centerAngle + halfWidth);
  ctx.stroke();
}

function drawPulse(ctx, cx, cy, radius, feedback, palette) {
  const { type, age } = feedback; // age in [0, 1], 0 = just happened
  if (age >= 1) return;
  const alpha = 1 - age;
  const scale = 1 + age * (type === 'perfect' ? 0.5 : 0.25);
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = type === 'perfect' ? palette.true : type === 'fair' ? palette.fair : palette.pointer;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * scale, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
