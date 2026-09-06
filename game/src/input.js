// Pointer input, judged against the RAW input event timestamp rather than
// "state at the last rendered frame" (docs/GAME_DESIGN.md §1.5, §3.6;
// docs/PRODUCT_PLAN.md - Technical Architecture). This is the single most
// important fairness property in the whole build: a dropped or delayed frame
// must never silently shift a hit judgment.

/**
 * Attaches a single-tap listener to `element` and calls `onTap(tSeconds)`
 * with the elapsed time, in seconds, between `lapStartPerfMs` (a
 * performance.now() timestamp) and the event's own high-resolution timestamp.
 *
 * @returns {() => void} an unsubscribe function
 */
export function listenForTap(element, getLapStartPerfMs, onTap) {
  function handlePointerDown(event) {
    // Ignore multi-touch/secondary pointers - the whole game is one tap.
    if (event.isPrimary === false) return;

    const lapStartPerfMs = getLapStartPerfMs();
    if (lapStartPerfMs == null) return;

    let eventPerfMs = event.timeStamp;
    // Defensive fallback: per the UI Events spec, PointerEvent.timeStamp is a
    // DOMHighResTimeStamp in the same domain as performance.now(). A small
    // number of older/unusual environments have been known to report
    // Date.now()-epoch-based timestamps instead; that would be orders of
    // magnitude larger than any plausible performance.now() reading, so treat
    // an implausible value as a signal to fall back to "now" rather than
    // silently computing a nonsense elapsed time.
    if (!Number.isFinite(eventPerfMs) || eventPerfMs > 1e11) {
      eventPerfMs = performance.now();
    }

    const tSeconds = (eventPerfMs - lapStartPerfMs) / 1000;
    onTap(Math.max(tSeconds, 0));
  }

  element.addEventListener('pointerdown', handlePointerDown, { passive: true });
  return () => element.removeEventListener('pointerdown', handlePointerDown);
}
