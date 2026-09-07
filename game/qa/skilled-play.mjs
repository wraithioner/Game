// Simulates a "skilled player" using the debug hook to read each upcoming
// obstacle row and react correctly (lane change, jump, or slide), to verify
// the core loop actually works as designed in a real browser (obstacles are
// dodgeable, the daily distance cap ends the run as "completed") - not just
// that the page loads without errors. Throwaway QA script.
//
// The bot drives the run directly via run.tick(1/60) in a tight synchronous
// loop inside the PAGE itself (the same small-step style test/game.test.js
// uses via its stepUntil helper), rather than waiting on real wall-clock time
// through Playwright. This is deliberate, not just an optimization: an
// earlier version of this script reacted on a fixed DISTANCE threshold using
// requestAnimationFrame and real time, which is wrong for a game where speed
// changes - JUMP_DURATION/SLIDE_DURATION are fixed in *time* (0.45s/0.55s),
// but early in a run speed is as low as 6 units/sec, so a fixed distance
// threshold fires nearly a full second before the obstacle arrives, long
// enough for the action to expire before the row is actually crossed,
// producing an entirely avoidable collision. Reacting a fixed small DISTANCE
// before each row while ticking in small fixed TIME steps sidesteps the
// whole problem, and finishes in milliseconds instead of real minutes -
// reaching the 1000-unit daily cap at ~6-16 units/sec would otherwise take
// upwards of two real minutes of Playwright wall-clock time.
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:8837') + '/?debug=1';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE_URL, { waitUntil: 'load' });
await page.waitForTimeout(200);

/** Cranks the active run forward, dodging every obstacle correctly, until it
 * ends or `maxIterations` small time-steps have passed. Returns a summary. */
async function crankToEnd(maxIterations = 200000) {
  return page.evaluate((iterationCap) => {
    function pickPlan(row, currentLane) {
      const type = row.lanes[currentLane];
      if (type === 'empty') return { lane: currentLane, action: null };
      if (type === 'low') return { lane: currentLane, action: 'jump' };
      if (type === 'high') return { lane: currentLane, action: 'slide' };
      // 'wall': find a safe lane among the others, preferring one needing no action.
      const others = [0, 1, 2].filter((l) => l !== currentLane);
      for (const l of others) {
        if (row.lanes[l] === 'empty') return { lane: l, action: null };
      }
      for (const l of others) {
        if (row.lanes[l] === 'low') return { lane: l, action: 'jump' };
        if (row.lanes[l] === 'high') return { lane: l, action: 'slide' };
      }
      return { lane: currentLane, action: null }; // unreachable given the fairness guarantee
    }

    const run = window.__swerveDebug.getRun();
    const REACTION_DISTANCE = 2; // react this many distance units before each row, in 1/60s steps
    let actedForRow = -1;
    let iterations = 0;
    while (run.status === 'active' && iterations < iterationCap) {
      const row = run._nextRow;
      if (row.rowIndex !== actedForRow && row.position - run.distance <= REACTION_DISTANCE) {
        actedForRow = row.rowIndex;
        const plan = pickPlan(row, run.lane);
        let diff = plan.lane - run.lane;
        while (diff > 0) { run.moveRight(); diff--; }
        while (diff < 0) { run.moveLeft(); diff++; }
        if (plan.action === 'jump') run.jump();
        if (plan.action === 'slide') run.slide();
      }
      run.tick(1 / 60);
      iterations++;
    }
    return {
      distance: run.distance,
      status: run.status,
      completed: run.completed,
      obstaclesCleared: run.obstaclesCleared,
      iterations,
    };
  }, maxIterations);
}

console.log('=== Practice mode: bot dodges everything, cranked forward to a fixed obstacle count ===');
await page.click('#play-practice');
await page.waitForTimeout(100);
// 60 rows at ROW_SPACING=40 is 2400 distance units - comfortably past the
// speed ramp's plateau (SPEED_RAMP_DISTANCE=1600), so this also exercises
// max-speed obstacle spacing/timing, not just the easy early section.
const practiceOutcome = await crankToEnd(600000);
console.log('Practice outcome:', practiceOutcome);
const survivedManyObstacles = practiceOutcome.status === 'active' && practiceOutcome.obstaclesCleared >= 40;
console.log('Bot survived and cleared at least 40 obstacles without colliding:', survivedManyObstacles);

console.log('\n=== Daily mode: verifying the distance cap ends the run as "completed" ===');
// There's no in-game exit button by design, so reload back to a clean Home
// screen the same way a real user would (closing and reopening the app)
// rather than simulating a removed control.
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(200);
await page.click('#play-daily');
await page.waitForTimeout(100);
const dailyOutcome = await crankToEnd();
console.log('Daily outcome:', dailyOutcome);

// The run was ended directly via run.tick() above, bypassing main.js's own
// requestAnimationFrame loop - give that loop one real frame to notice the
// ended status and run its normal finish-the-run transition to the result screen.
await page.waitForTimeout(500);
const resultVisible = await page.isVisible('#screen-result');
const resultTitle = resultVisible ? await page.textContent('#result-title') : null;
console.log('Result screen visible:', resultVisible, '| title:', resultTitle);

const dailyCapReachedCleanly = dailyOutcome.status === 'ended' && dailyOutcome.completed === true;
console.log('Daily run reached the distance cap and ended as "completed":', dailyCapReachedCleanly);

console.log('\n=== Errors captured ===');
console.log(errors.length === 0 ? 'none' : errors.join('\n'));

await browser.close();
const failed = errors.length > 0 || !survivedManyObstacles || !dailyCapReachedCleanly || !resultVisible;
process.exit(failed ? 1 : 0);
