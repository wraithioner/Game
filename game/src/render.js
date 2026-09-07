// Canvas rendering for the 3-lane track. Purely visual - collision truth
// lives entirely in game.js; this only ever reads state, never decides
// outcomes. Colors are read live from the page's CSS custom properties
// (styles.css) rather than duplicated here, so there is exactly one place
// the palette is defined (docs/PRODUCT_PLAN.md - Technical Architecture
// explains why, from a bug this caused in the previous concept).

import { LANES, VIEW_DISTANCE } from './game.js';

export function getPalette() {
  const styles = getComputedStyle(document.documentElement);
  const token = (name) => styles.getPropertyValue(name).trim();
  return {
    bg: token('--bg'),
    track: token('--ring'),
    player: token('--accent-primary'),
    low: token('--accent-true'), // amber - jump over
    high: token('--accent-fair'), // blue - slide under
    wall: token('--accent-danger'), // violet - change lanes, never clearable by action
    text: token('--text'),
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width: number, height: number}} size - logical (CSS pixel) canvas size
 * @param {{lane: number, action: string, distance: number, visibleRows: object[], reduceMotion: boolean}} state
 */
export function drawFrame(ctx, size, state) {
  const { lane, action, distance, visibleRows, reduceMotion } = state;
  const palette = getPalette();
  const { width, height } = size;
  const laneWidth = width / LANES;
  const playerY = height * 0.78;
  const pixelsPerUnit = playerY / VIEW_DISTANCE;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  drawLaneDividers(ctx, palette, width, height, laneWidth, distance, reduceMotion);

  for (const row of visibleRows) {
    const rowY = playerY - (row.position - distance) * pixelsPerUnit;
    if (rowY < -60 || rowY > height + 60) continue;
    row.lanes.forEach((type, i) => {
      if (type === 'empty') return;
      drawObstacle(ctx, palette, type, i * laneWidth, rowY, laneWidth);
    });
  }

  drawPlayer(ctx, palette, lane * laneWidth, playerY, laneWidth, action);
}

function drawLaneDividers(ctx, palette, width, height, laneWidth, distance, reduceMotion) {
  ctx.strokeStyle = palette.track;
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 18]);
  // The dash offset scrolls with distance so the track visibly moves even
  // during a straight, obstacle-free stretch - motion is capped/disabled
  // under Reduce Motion rather than removed entirely, since it also carries
  // real information (how fast you're currently going).
  ctx.lineDashOffset = reduceMotion ? 0 : -((distance * 8) % 32);
  for (let i = 1; i < LANES; i++) {
    const x = i * laneWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawObstacle(ctx, palette, type, laneX, rowY, laneWidth) {
  const pad = laneWidth * 0.18;
  const w = laneWidth - pad * 2;
  ctx.fillStyle = palette[type];

  if (type === 'low') {
    // A hurdle sitting at ground level - jump over it. Rounded top for a
    // distinct silhouette, not just a plain block.
    const h = laneWidth * 0.32;
    roundRect(ctx, laneX + pad, rowY - h, w, h, [8, 8, 2, 2]);
    ctx.fill();
  } else if (type === 'high') {
    // A bar suspended above the lane - slide under it. Drawn higher up
    // with visible clearance beneath, so its silhouette alone (even in
    // grayscale) reads differently from a ground-level hurdle.
    const h = laneWidth * 0.22;
    roundRect(ctx, laneX + pad, rowY - laneWidth * 0.85, w, h, 4);
    ctx.fill();
  } else if (type === 'wall') {
    // Full-height block - only a lane change avoids it. Gets a distinct
    // diagonal-stripe texture on top of its own hue, so the most dangerous
    // obstacle type is never distinguished by color alone.
    const h = laneWidth * 0.95;
    const x = laneX + pad;
    const y = rowY - h;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    ctx.save();
    roundRect(ctx, x, y, w, h, 6);
    ctx.clip();
    ctx.strokeStyle = palette.bg;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 4;
    const diagonal = w + h;
    for (let d = -h; d < diagonal; d += 12) {
      ctx.beginPath();
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d + h, y + h);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, palette, laneX, playerY, laneWidth, action) {
  const cx = laneX + laneWidth / 2;
  const baseSize = laneWidth * 0.5;
  ctx.fillStyle = palette.player;

  if (action === 'jumping') {
    // Airborne: smaller and lifted, with a soft ground shadow left behind so
    // "in the air" reads clearly even as a static frame.
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(cx, playerY + baseSize * 0.35, baseSize * 0.4, baseSize * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    roundRect(ctx, cx - baseSize * 0.32, playerY - baseSize * 1.15, baseSize * 0.64, baseSize * 0.64, 10);
    ctx.fill();
  } else if (action === 'sliding') {
    // Flattened silhouette, low to the ground.
    roundRect(ctx, cx - baseSize * 0.42, playerY - baseSize * 0.34, baseSize * 0.84, baseSize * 0.34, 8);
    ctx.fill();
  } else {
    roundRect(ctx, cx - baseSize * 0.34, playerY - baseSize * 0.7, baseSize * 0.68, baseSize * 0.7, 10);
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, radius) {
  const r = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
  ctx.beginPath();
  ctx.moveTo(x + r[0], y);
  ctx.lineTo(x + w - r[1], y);
  ctx.arcTo(x + w, y, x + w, y + r[1], r[1]);
  ctx.lineTo(x + w, y + h - r[2]);
  ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
  ctx.lineTo(x + r[3], y + h);
  ctx.arcTo(x, y + h, x, y + h - r[3], r[3]);
  ctx.lineTo(x, y + r[0]);
  ctx.arcTo(x, y, x + r[0], y, r[0]);
  ctx.closePath();
}
