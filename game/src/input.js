// Swipe-gesture and keyboard input for the 3-lane runner. A quick tap (or
// swipe up) jumps; swipe down slides; swipe left/right changes lanes. Also
// listens for arrow keys / WASD / space, both for desktop play and as a
// motor-accessibility alternative to swipe gestures (docs/GAME_DESIGN.md -
// Eye-Comfort & Accessibility Specification).

const SWIPE_THRESHOLD_PX = 28; // minimum movement to count as a directional swipe rather than a tap

/**
 * @param {HTMLElement} element - the element to listen on (the whole Run screen)
 * @param {{onLeft: Function, onRight: Function, onJump: Function, onSlide: Function}} actions
 * @returns {() => void} an unsubscribe function
 */
export function listenForGestures(element, actions) {
  let startX = null;
  let startY = null;

  function handlePointerDown(event) {
    if (event.isPrimary === false) return;
    startX = event.clientX;
    startY = event.clientY;
  }

  function handlePointerUp(event) {
    if (startX === null) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    startX = null;
    startY = null;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX < SWIPE_THRESHOLD_PX && absY < SWIPE_THRESHOLD_PX) {
      actions.onJump(); // a plain tap jumps - the single most common action
      return;
    }

    if (absX > absY) {
      if (dx > 0) actions.onRight();
      else actions.onLeft();
    } else if (dy > 0) {
      actions.onSlide();
    } else {
      actions.onJump();
    }
  }

  function handleKeyDown(event) {
    if (event.repeat) return; // ignore OS key-repeat, act once per press
    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        actions.onLeft();
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        actions.onRight();
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ':
        actions.onJump();
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        actions.onSlide();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  element.addEventListener('pointerdown', handlePointerDown, { passive: true });
  element.addEventListener('pointerup', handlePointerUp, { passive: true });
  window.addEventListener('keydown', handleKeyDown);

  return () => {
    element.removeEventListener('pointerdown', handlePointerDown);
    element.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('keydown', handleKeyDown);
  };
}
