// Shareable result card: plain text/emoji, not a rendered image, and using
// simple geometric glyphs rather than complex emoji (docs/PRODUCT_PLAN.md -
// "Important Things You Didn't Ask About" #2: emoji rendering is inconsistent
// across platforms, but these simple Unicode symbols are broadly consistent).
// This is deliberately the lowest-friction possible share action - it pastes
// into any chat app instantly, matching Wordle's own mechanism rather than a
// heavier reinterpretation of it (docs/RESEARCH.md §14).

const CHECKPOINT_COUNT = 10;
const FILLED_GLYPH = '■';
const EMPTY_GLYPH = '□';

/**
 * A progress strip across the day's course, filled proportionally to how far
 * the run got - shape-based (filled vs. outline square), not a color-coded
 * grid, so it reads the same for colorblind viewers and in a plain-text
 * chat message with no formatting at all.
 */
export function checkpointStripFor(distance, distanceCap) {
  const reached = Math.min(CHECKPOINT_COUNT, Math.floor((distance / distanceCap) * CHECKPOINT_COUNT));
  return FILLED_GLYPH.repeat(reached) + EMPTY_GLYPH.repeat(CHECKPOINT_COUNT - reached);
}

/** Builds the run number shown in the share card: days since a fixed epoch. */
export function dayIndexFromUtcDate(utcDateString) {
  const epoch = Date.parse('2026-01-01T00:00:00Z');
  const day = Date.parse(utcDateString + 'T00:00:00Z');
  return Math.floor((day - epoch) / 86400000) + 1;
}

/**
 * @param {{distance: number, distanceCap: number, completed: boolean, streakCount: number, utcDateString: string}} run
 */
export function buildShareText(run) {
  const strip = checkpointStripFor(run.distance, run.distanceCap);
  const dayIndex = dayIndexFromUtcDate(run.utcDateString);
  const outcome = run.completed ? 'cleared the course' : `reached ${Math.round(run.distance)}m`;
  const streakLine = run.streakCount > 1 ? `\n🔥 ${run.streakCount}-day streak` : '';
  return `Swerve #${dayIndex} — ${outcome}\n${strip}${streakLine}`;
}

/**
 * Shares via the native share sheet where available, otherwise copies to the
 * clipboard. Returns a string describing which path was used, for analytics.
 */
export async function shareResult(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'native-share';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // Fall through to clipboard on any other failure.
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'clipboard';
    } catch {
      return 'unavailable';
    }
  }
  return 'unavailable';
}
