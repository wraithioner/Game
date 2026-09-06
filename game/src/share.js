// Shareable result card: plain text/emoji, not a rendered image, and using
// simple geometric glyphs rather than complex emoji (docs/PRODUCT_PLAN.md -
// "Important Things You Didn't Ask About" #2: emoji rendering is inconsistent
// across platforms, but these simple Unicode symbols are broadly consistent).
// This is deliberately the lowest-friction possible share action - it pastes
// into any chat app instantly, matching Wordle's own mechanism rather than a
// heavier reinterpretation of it (docs/RESEARCH.md §14).

const GLYPHS = {
  perfect: '●', // ●
  fair: '◐', // ◐
  miss: '○', // ○
};

/** The same glyph mapping used in the share card, for in-app result display. */
export function tickStripFor(results) {
  return results.map((r) => GLYPHS[r] || GLYPHS.miss).join('');
}

/** Builds the puzzle number shown in the share card: days since a fixed epoch. */
export function dayIndexFromUtcDate(utcDateString) {
  const epoch = Date.parse('2026-01-01T00:00:00Z');
  const day = Date.parse(utcDateString + 'T00:00:00Z');
  return Math.floor((day - epoch) / 86400000) + 1;
}

/**
 * @param {{results: string[], lapsCompleted: number, completed: boolean, streakCount: number, utcDateString: string}} run
 */
export function buildShareText(run) {
  const tickStrip = tickStripFor(run.results);
  const dayIndex = dayIndexFromUtcDate(run.utcDateString);
  const outcome = run.completed ? `cleared all ${run.lapsCompleted}` : `${run.lapsCompleted} laps`;
  const streakLine = run.streakCount > 1 ? `\n🔥 ${run.streakCount}-day streak` : '';
  return `Ringtrue #${dayIndex} — ${outcome}\n${tickStrip}${streakLine}`;
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
