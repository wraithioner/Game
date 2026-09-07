// Canvas rendering for the tunnel. Purely visual - collision truth lives
// entirely in game.js; this only ever reads state, never decides outcomes.
// Colors are read live from the page's CSS custom properties (styles.css)
// rather than duplicated here, so there is exactly one place the palette is
// defined (docs/PRODUCT_PLAN.md - Technical Architecture explains why, from
// a bug this caused in an earlier build).
//
// The view is a pseudo-3D chase camera looking down a receding tunnel - a
// real perspective-divide projection (scale = CAMERA_Z / (CAMERA_Z + depth))
// drawn with plain 2D canvas primitives (arcs, lines, simple polygons), not
// a 3D engine. This matches the real Dookey Dash's camera framing (see
// docs/RESEARCH.md's research addendum) while staying within the minimalist
// geometric mandate - no textures, no lighting, just projected flat shapes.

const CAMERA_Z = 25; // perspective-divide constant: larger = flatter/less dramatic depth
const VANISH_Y_FRAC = 0.22; // vanishing point Y, as a fraction of canvas height
const NEAR_Y_FRAC = 0.88; // the player's fixed on-screen Y, as a fraction of canvas height
const NEAR_RADIUS_FRAC = 0.42; // tunnel's on-screen radius at the player's depth, as a fraction of width
const TUNNEL_RING_SPACING = 20; // distance units between drawn depth rings
const TUNNEL_SPOKE_COUNT = 8;
const OBSTACLE_BASE_RADIUS_FRAC = 0.16; // obstacle drawn size at the near plane, as a fraction of width
const PLAYER_BASE_RADIUS_FRAC = 0.09;

export function getPalette() {
  const styles = getComputedStyle(document.documentElement);
  const token = (name) => styles.getPropertyValue(name).trim();
  return {
    bg: token('--bg'),
    track: token('--ring'),
    player: token('--accent-primary'),
    hazard: token('--accent-danger'), // violet - never clearable, must be steered around
    barrier: token('--accent-true'), // amber - clearable only while boosting
    text: token('--text'),
  };
}

/** Perspective-divide projection: 1 right at the camera, shrinking toward 0
 * as depth increases. Also used to interpolate Y between the vanishing
 * point and the near (player) plane at the same depth. */
function projectionScale(aheadDistance) {
  return CAMERA_Z / (CAMERA_Z + Math.max(aheadDistance, 0));
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width: number, height: number}} size - logical (CSS pixel) canvas size
 * @param {{position: {x:number,y:number}, boosting: boolean, distance: number, visibleObstacles: object[], reduceMotion: boolean}} state
 */
export function drawFrame(ctx, size, state) {
  const { position, boosting, distance, visibleObstacles, reduceMotion } = state;
  const palette = getPalette();
  const { width, height } = size;
  const centerX = width / 2;
  const vanishY = height * VANISH_Y_FRAC;
  const nearY = height * NEAR_Y_FRAC;
  const nearRadiusPx = width * NEAR_RADIUS_FRAC;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  drawTunnel(ctx, palette, centerX, vanishY, nearY, nearRadiusPx, distance, reduceMotion);

  // Farthest obstacles first, so nearer ones correctly draw on top of them.
  const sorted = [...visibleObstacles].sort((a, b) => b.position - a.position);
  for (const obstacle of sorted) {
    const aheadDistance = obstacle.position - distance;
    const scale = projectionScale(aheadDistance);
    const depthY = vanishY + (nearY - vanishY) * scale;
    const radiusPx = nearRadiusPx * scale;
    const ox = Math.cos(obstacle.angle) * obstacle.radius;
    const oy = Math.sin(obstacle.angle) * obstacle.radius;
    const screenX = centerX + ox * radiusPx;
    const screenY = depthY + oy * radiusPx;
    const drawSize = width * OBSTACLE_BASE_RADIUS_FRAC * scale;
    drawObstacle(ctx, palette, obstacle.type, screenX, screenY, drawSize, distance, reduceMotion);
  }

  drawPlayer(ctx, palette, centerX + position.x * nearRadiusPx, nearY + position.y * nearRadiusPx, width * PLAYER_BASE_RADIUS_FRAC, boosting, reduceMotion);
}

function drawTunnel(ctx, palette, centerX, vanishY, nearY, nearRadiusPx, distance, reduceMotion) {
  ctx.strokeStyle = palette.track;
  ctx.lineWidth = 1.5;

  // Concentric depth rings, receding toward the vanishing point. The ring
  // phase scrolls with distance so the tunnel visibly moves even during an
  // obstacle-free stretch - frozen under Reduce Motion since it also carries
  // real information (how fast you're currently going), same rationale as
  // the lane-divider scroll in the previous build.
  const phase = reduceMotion ? 0 : distance % TUNNEL_RING_SPACING;
  for (let d = -phase; d <= 100; d += TUNNEL_RING_SPACING) {
    if (d < 0) continue;
    const scale = projectionScale(d);
    const depthY = vanishY + (nearY - vanishY) * scale;
    const radiusPx = nearRadiusPx * scale;
    ctx.globalAlpha = 0.5 * scale + 0.15;
    ctx.beginPath();
    ctx.arc(centerX, depthY, Math.max(radiusPx, 0.5), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Radial spokes from the vanishing point to the near-plane rim - a
  // simplified but effective "converging lines" depth cue.
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < TUNNEL_SPOKE_COUNT; i++) {
    const angle = (i / TUNNEL_SPOKE_COUNT) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, vanishY);
    ctx.lineTo(centerX + Math.cos(angle) * nearRadiusPx, nearY + Math.sin(angle) * nearRadiusPx);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawObstacle(ctx, palette, type, x, y, size, distance, reduceMotion) {
  ctx.save();
  ctx.translate(x, y);

  if (type === 'hazard') {
    // A spinning 4-pointed cross - the never-clearable hazard, distinct in
    // both color and silhouette (a "danger" star shape) from the barrier.
    if (!reduceMotion) ctx.rotate((distance * 0.06) % (Math.PI * 2));
    ctx.fillStyle = palette.hazard;
    drawCross(ctx, size);
  } else {
    // A plain rectangular "plank" - the boost-through barrier.
    ctx.fillStyle = palette.barrier;
    roundRect(ctx, -size, -size * 0.4, size * 2, size * 0.8, size * 0.15);
    ctx.fill();
  }

  ctx.restore();
}

function drawCross(ctx, size) {
  const arm = size * 0.42;
  ctx.beginPath();
  ctx.moveTo(-arm, -size);
  ctx.lineTo(arm, -size);
  ctx.lineTo(arm, -arm);
  ctx.lineTo(size, -arm);
  ctx.lineTo(size, arm);
  ctx.lineTo(arm, arm);
  ctx.lineTo(arm, size);
  ctx.lineTo(-arm, size);
  ctx.lineTo(-arm, arm);
  ctx.lineTo(-size, arm);
  ctx.lineTo(-size, -arm);
  ctx.lineTo(-arm, -arm);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer(ctx, palette, x, y, size, boosting, reduceMotion) {
  if (boosting) {
    // A soft glow behind the player - static (not pulsing) under Reduce
    // Motion, so the boost state stays visible without relying on animation.
    ctx.save();
    ctx.globalAlpha = reduceMotion ? 0.35 : 0.35 + 0.15 * Math.sin(performance.now() / 60);
    ctx.fillStyle = palette.player;
    ctx.beginPath();
    ctx.arc(x, y, size * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = palette.player;
  roundRect(ctx, x - size, y - size, size * 2, size * 2, size * 0.35);
  ctx.fill();
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
