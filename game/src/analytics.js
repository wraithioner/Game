// Privacy-first analytics instrumentation (docs/PRODUCT_PLAN.md - Analytics
// Specification). The MVP ships with NO third-party SDK and sends nothing
// anywhere - this module exists so every event the spec defines is actually
// fired at the right place in the code, ready to be pointed at a real
// privacy-respecting, cookie-less, aggregate-only provider later with a
// one-line change here, instead of re-auditing main.js for instrumentation
// points at that point.
//
// In the meantime events are kept in a small in-memory ring buffer (useful
// for QA - see qa/browser-check.mjs) and, only when ?debug=1 is present,
// echoed to the console.

const BUFFER_LIMIT = 200;
const buffer = [];

const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

/**
 * Records an analytics event. `properties` must never contain anything
 * personally identifying (docs/PRODUCT_PLAN.md - "no personally identifying
 * data is collected in the MVP") - every call site below only ever passes
 * gameplay/settings values, never device or user identifiers.
 */
export function track(event, properties = {}) {
  const entry = { event, properties, atMs: typeof performance !== 'undefined' ? performance.now() : Date.now() };
  buffer.push(entry);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, properties);
  }
}

/** Read-only access to recently recorded events - used by QA scripts only. */
export function getRecentEvents() {
  return [...buffer];
}
