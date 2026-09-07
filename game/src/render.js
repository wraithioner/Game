// Real WebGL 3D rendering of the tunnel via three.js (vendored locally at
// vendor/three/, not loaded from a CDN, so the service worker can cache it
// for full offline play - see docs/RESEARCH.md's research addendum: the
// real Dookey Dash is itself a Three.js/WebGL scene, and a hand-rolled 2D
// canvas perspective trick read as flat and unconvincing by comparison).
// Colors are read live from the page's CSS custom properties (styles.css)
// rather than duplicated here, so there is exactly one place the palette is
// defined (docs/PRODUCT_PLAN.md - Technical Architecture).
//
// Coordinate scheme: nothing here uses absolute world position for anything
// that scrolls. The camera sits fixed at the origin's Z (matching the real
// game's own architecture, per the reverse-engineering research: "the world
// moves through you, the player's Z is always 0") and every obstacle's
// depth is computed fresh each frame as `-(obstacle.position - distance) *
// FORWARD_SCALE` - a small, bounded quantity (at most VIEW_DISTANCE away),
// so there's no unbounded-coordinate drift even across a very long practice
// run. The tunnel's depth rings use the same trick, cycling via `distance %
// RING_SPACING_WORLD`, so nothing is ever regenerated or grows unbounded.

import * as THREE from '../vendor/three/three.module.min.js';

// The canvas keeps a fixed 3:5 (0.6) aspect ratio via CSS regardless of
// device (styles.css's #canvas rule), so the frustum math below can safely
// assume that aspect exactly, rather than a live-measured value.
const CANVAS_ASPECT = 0.6;
const CAMERA_FOV_DEGREES = 60; // vertical FOV
const CAMERA_HEIGHT = 2.2;
const CAMERA_BACK = 4.5; // camera sits this far behind the player's z=0 plane
// Where the player should land on screen: 0 = top edge, 0.5 = dead center, 1
// = bottom edge. A classic runner keeps the player low in frame so most of
// the screen shows the track receding ahead, not behind-camera empty space.
const DESIRED_PLAYER_SCREEN_Y = 0.74;

// WORLD_RADIUS (world units the normalized, radius-1 disc maps onto) is
// DERIVED, not hand-picked: it must stay small enough that a player at the
// disc's rim (the most extreme legal position) is still comfortably inside
// the camera's frustum at its own depth (CAMERA_BACK) - otherwise steering
// to the edge would visibly push the player mesh off-screen, which is
// exactly the bug an earlier hand-picked WORLD_RADIUS=3 had. FRUSTUM_MARGIN
// keeps the full disc within ~77% of the frustum's width at that depth, so
// there's always a visible margin, not just an exact fit.
const FRUSTUM_MARGIN = 1.1;
const verticalHalfFovRad = (CAMERA_FOV_DEGREES / 2) * (Math.PI / 180);
const horizontalHalfFovRad = Math.atan(Math.tan(verticalHalfFovRad) * CANVAS_ASPECT);
const WORLD_RADIUS = (CAMERA_BACK * Math.tan(horizontalHalfFovRad)) / FRUSTUM_MARGIN;

const FORWARD_SCALE = (WORLD_RADIUS / 3) * 0.15; // world units per game distance-unit, scaled with WORLD_RADIUS
const RING_SPACING_WORLD = WORLD_RADIUS * 0.68;
const RING_COUNT = 18; // enough to keep the rings visually dense over the full TUNNEL_VISUAL_LENGTH below
const SPOKE_COUNT = 8;
const TUNNEL_VISUAL_LENGTH = WORLD_RADIUS * 16; // reaches far enough that the tunnel visibly recedes toward
// a real vanishing point instead of the ring/spoke geometry stopping well short of it and leaving bare
// background above - independent of ring spacing, just how far the spoke lines/lookAt target reach.
const OBSTACLE_POOL_SIZE = 12; // comfortably above the max obstacles ever visible at once
const BOOST_GLOW_COLOR = 0xfff3c4; // warm bright glow, visible against either theme's dark or light player color

let renderer = null;
let scene = null;
let camera = null;
let playerMesh = null;
let playerMaterial = null;
let boostLight = null;
let ringLines = [];
let hazardPool = [];
let barrierPool = [];
let paletteCache = null;

function getPalette() {
  const styles = getComputedStyle(document.documentElement);
  const token = (name) => styles.getPropertyValue(name).trim();
  return {
    bg: token('--bg'),
    track: token('--ring'),
    player: token('--accent-primary'),
    hazard: token('--accent-danger'), // never clearable, must be steered around
    barrier: token('--accent-true'), // clearable only while boosting
  };
}

function circlePoints(radius, segments, z) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z));
  }
  return points;
}

function buildTunnel(trackColor) {
  const group = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial({ color: trackColor, transparent: true, opacity: 0.5 });

  ringLines = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const geometry = new THREE.BufferGeometry().setFromPoints(circlePoints(WORLD_RADIUS, 32, 0));
    const ring = new THREE.LineLoop(geometry, lineMaterial);
    group.add(ring);
    ringLines.push(ring);
  }

  const spokeMaterial = new THREE.LineBasicMaterial({ color: trackColor, transparent: true, opacity: 0.3 });
  for (let i = 0; i < SPOKE_COUNT; i++) {
    const angle = (i / SPOKE_COUNT) * Math.PI * 2;
    const far = new THREE.Vector3(Math.cos(angle) * WORLD_RADIUS, Math.sin(angle) * WORLD_RADIUS, -TUNNEL_VISUAL_LENGTH);
    const near = new THREE.Vector3(Math.cos(angle) * WORLD_RADIUS, Math.sin(angle) * WORLD_RADIUS, CAMERA_BACK);
    const geometry = new THREE.BufferGeometry().setFromPoints([near, far]);
    group.add(new THREE.Line(geometry, spokeMaterial));
  }

  return group;
}

function buildObstaclePool(geometry, color) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
  const pool = [];
  for (let i = 0; i < OBSTACLE_POOL_SIZE; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    scene.add(mesh);
    pool.push(mesh);
  }
  return pool;
}

/** Builds the scene once for the given canvas. Safe to call again if the
 * canvas element itself ever changes (it doesn't in this app, but this
 * keeps the module free of a "must call exactly once" footgun). */
export function initRenderer(canvas) {
  paletteCache = getPalette();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  scene = new THREE.Scene();
  scene.background = new THREE.Color(paletteCache.bg);

  camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, CANVAS_ASPECT, 0.1, 100);
  camera.position.set(0, CAMERA_HEIGHT, CAMERA_BACK);
  // Pitch the camera down just enough that the player (at world y=0, z=0)
  // actually lands at DESIRED_PLAYER_SCREEN_Y, rather than picking a lookAt
  // target by eye - see the constant's comment for why that placement matters.
  const angleToPlayer = Math.atan(CAMERA_HEIGHT / CAMERA_BACK);
  const angleFromCenter = (DESIRED_PLAYER_SCREEN_Y - 0.5) * 2 * verticalHalfFovRad;
  const pitchDownRad = angleToPlayer - angleFromCenter;
  const lookDistance = CAMERA_BACK + TUNNEL_VISUAL_LENGTH;
  const lookAtY = CAMERA_HEIGHT - Math.tan(pitchDownRad) * lookDistance;
  camera.lookAt(0, lookAtY, -TUNNEL_VISUAL_LENGTH);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const directional = new THREE.DirectionalLight(0xffffff, 0.6);
  directional.position.set(1.5, 3, 2);
  scene.add(directional);

  // Fixed, theme-independent glow color - using the player's own base color
  // here would be invisible whenever that color is dark (as it is in the
  // light theme), since a dark emissive tint doesn't add visible brightness.
  boostLight = new THREE.PointLight(BOOST_GLOW_COLOR, 0, 4);
  scene.add(boostLight);

  scene.add(buildTunnel(paletteCache.track));

  const playerSize = WORLD_RADIUS * 0.16;
  playerMaterial = new THREE.MeshStandardMaterial({ color: paletteCache.player, roughness: 0.5, metalness: 0.1 });
  playerMesh = new THREE.Mesh(new THREE.BoxGeometry(playerSize, playerSize, playerSize), playerMaterial);
  playerMesh.position.set(0, 0, 0);
  scene.add(playerMesh);

  hazardPool = buildObstaclePool(new THREE.OctahedronGeometry(WORLD_RADIUS * 0.12), paletteCache.hazard);
  barrierPool = buildObstaclePool(
    new THREE.BoxGeometry(WORLD_RADIUS * 0.3, WORLD_RADIUS * 0.11, WORLD_RADIUS * 0.07),
    paletteCache.barrier
  );
}

// The projection's aspect is fixed at CANVAS_ASPECT rather than recomputed
// from live measurements - WORLD_RADIUS above is derived assuming exactly
// this aspect, so the frustum-containment guarantee only holds if the
// projection actually uses it. The canvas's own CSS aspect-ratio keeps its
// rendered box at this same ratio regardless of viewport size.
export function resizeRenderer(width, height, dpr) {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(dpr, 2));
  renderer.setSize(width, height, false);
  camera.aspect = CANVAS_ASPECT;
  camera.updateProjectionMatrix();
}

/**
 * @param {{position: {x:number,y:number}, boosting: boolean, distance: number, visibleObstacles: object[], reduceMotion: boolean}} state
 */
export function drawFrame(state) {
  const { position, boosting, distance, visibleObstacles, reduceMotion } = state;

  playerMesh.position.set(position.x * WORLD_RADIUS, position.y * WORLD_RADIUS, 0);

  const glowTarget = boosting ? 1 : 0;
  const pulse = boosting && !reduceMotion ? 0.75 + 0.25 * Math.sin(performance.now() / 60) : 1;
  playerMaterial.emissive.set(boosting ? BOOST_GLOW_COLOR : 0x000000);
  playerMaterial.emissiveIntensity = boosting ? 0.6 * pulse : 0;
  boostLight.intensity = glowTarget * 1.2 * pulse;
  boostLight.position.copy(playerMesh.position);

  const ringPhase = reduceMotion ? 0 : (distance * FORWARD_SCALE) % RING_SPACING_WORLD;
  ringLines.forEach((ring, i) => {
    ring.position.z = -(i * RING_SPACING_WORLD - ringPhase);
  });

  placeObstacles(hazardPool, visibleObstacles.filter((o) => o.type === 'hazard'), distance, reduceMotion);
  placeObstacles(barrierPool, visibleObstacles.filter((o) => o.type === 'barrier'), distance, reduceMotion);

  renderer.render(scene, camera);
}

function placeObstacles(pool, obstacles, distance, reduceMotion) {
  obstacles.forEach((obstacle, i) => {
    const mesh = pool[i];
    if (!mesh) return; // beyond the pool size - would need a wider VIEW_DISTANCE/pool to ever happen
    const ox = Math.cos(obstacle.angle) * obstacle.radius;
    const oy = Math.sin(obstacle.angle) * obstacle.radius;
    mesh.position.set(ox * WORLD_RADIUS, oy * WORLD_RADIUS, -(obstacle.position - distance) * FORWARD_SCALE);
    if (obstacle.type === 'hazard' && !reduceMotion) {
      mesh.rotation.y = distance * 0.08;
      mesh.rotation.x = distance * 0.05;
    }
    mesh.visible = true;
  });
  for (let i = obstacles.length; i < pool.length; i++) pool[i].visible = false;
}
