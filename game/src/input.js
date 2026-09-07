// Continuous drag-to-steer input, plus a boost trigger and a keyboard
// fallback. This replaced discrete swipe/lane-change gesture detection when
// the core mechanic switched to continuous 2D steering (matching the real
// Dookey Dash - see docs/RESEARCH.md's research addendum): rather than
// firing one-shot callbacks per gesture, this module tracks the player's
// live target position and hands it back to be polled once per frame, since
// "where the player wants to be" is continuous state, not a discrete event.

const KEYBOARD_STEER_SPEED = 2.5; // units/sec in normalized disc space (radius 1)
const DISC_RADIUS = 1; // matches game.js's DISC_RADIUS - kept local since input.js
// stays decoupled from simulation-specific constants, same as before.

const DIRECTION_KEYS = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
};
const BOOST_KEYS = new Set([' ', 'Shift']);

function clampToDisc(x, y) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= DISC_RADIUS || magnitude === 0) return { x, y };
  const scale = DISC_RADIUS / magnitude;
  return { x: x * scale, y: y * scale };
}

/**
 * @param {{pointerElement: HTMLElement, canvasElement: HTMLElement, boostButtonElement: HTMLElement, onBoost: Function}} opts
 *   pointerElement is the whole hit area to drag on (the Run screen, so HUD
 *   margins and hint text are draggable too, not just the canvas rectangle);
 *   canvasElement is used only to establish the coordinate frame the drag
 *   position maps into, so steering feels consistent regardless of how far
 *   outside the visible canvas a finger drifts (clamped to the disc either way).
 * @returns {{advance: (dt:number)=>{x:number,y:number}, destroy: () => void}}
 */
export function listenForSteering({ pointerElement, canvasElement, boostButtonElement, onBoost }) {
  let target = { x: 0, y: 0 };
  let activePointerId = null;
  const heldKeys = new Set();

  function normalizedFromEvent(event) {
    const rect = canvasElement.getBoundingClientRect();
    const halfSize = Math.min(rect.width, rect.height) / 2; // circular mapping, not stretched to an oval
    return clampToDisc(
      (event.clientX - (rect.left + rect.width / 2)) / halfSize,
      // Screen/DOM Y increases downward, but game.js's Y (and render.js's
      // Three.js world Y) increases upward, matching visual "up" - negate
      // here so dragging up actually moves the player up on screen, not down.
      -(event.clientY - (rect.top + rect.height / 2)) / halfSize
    );
  }

  function handlePointerDown(event) {
    if (event.isPrimary === false) return;
    activePointerId = event.pointerId;
    target = normalizedFromEvent(event);
  }

  function handlePointerMove(event) {
    if (event.pointerId !== activePointerId) return;
    target = normalizedFromEvent(event);
  }

  function handlePointerUp(event) {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null; // position holds where the finger was released
  }

  function handleKeyDown(event) {
    if (BOOST_KEYS.has(event.key)) {
      if (!event.repeat) onBoost();
      event.preventDefault();
      return;
    }
    const direction = DIRECTION_KEYS[event.key];
    if (direction) {
      heldKeys.add(direction);
      event.preventDefault();
    }
  }

  function handleKeyUp(event) {
    const direction = DIRECTION_KEYS[event.key];
    if (direction) heldKeys.delete(direction);
  }

  function handleBoostPress(event) {
    event.preventDefault();
    event.stopPropagation(); // don't also start a steering drag on the screen beneath the button
    onBoost();
  }

  pointerElement.addEventListener('pointerdown', handlePointerDown, { passive: true });
  pointerElement.addEventListener('pointermove', handlePointerMove, { passive: true });
  pointerElement.addEventListener('pointerup', handlePointerUp, { passive: true });
  pointerElement.addEventListener('pointercancel', handlePointerUp, { passive: true });
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  boostButtonElement.addEventListener('pointerdown', handleBoostPress);

  return {
    /** Integrates any keyboard-held steering by dtSeconds and returns the
     * current target position. An active pointer drag always takes priority
     * over the keyboard, matching how a real thumb-drag would. */
    advance(dtSeconds) {
      if (activePointerId === null && heldKeys.size > 0) {
        let dx = 0;
        let dy = 0;
        if (heldKeys.has('left')) dx -= 1;
        if (heldKeys.has('right')) dx += 1;
        if (heldKeys.has('up')) dy += 1; // +y is up, matching game.js/render.js's convention
        if (heldKeys.has('down')) dy -= 1;
        if (dx !== 0 || dy !== 0) {
          const length = Math.hypot(dx, dy);
          target = clampToDisc(
            target.x + (dx / length) * KEYBOARD_STEER_SPEED * dtSeconds,
            target.y + (dy / length) * KEYBOARD_STEER_SPEED * dtSeconds
          );
        }
      }
      return target;
    },
    destroy() {
      pointerElement.removeEventListener('pointerdown', handlePointerDown);
      pointerElement.removeEventListener('pointermove', handlePointerMove);
      pointerElement.removeEventListener('pointerup', handlePointerUp);
      pointerElement.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      boostButtonElement.removeEventListener('pointerdown', handleBoostPress);
    },
  };
}
