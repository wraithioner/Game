// Simulates a "skilled player" using the debug hook to read each upcoming
// checkpoint's obstacles and react correctly (steer into the guaranteed-clear
// quadrant, or steer onto a barrier and boost through it), to verify the
// core loop actually works as designed in a real browser (the tunnel is
// genuinely dodgeable, boost genuinely clears a barrier, the daily distance
// cap ends the run as "completed") - not just that the page loads without
// errors. Throwaway QA script.
//
// The bot drives the run directly via run.tick(1/60) in a tight synchronous
// loop inside the PAGE itself (the same small-step style test/game.test.js
// uses), rather than waiting on real wall-clock time through Playwright.
// This has to run as ONE uninterrupted synchronous pass: main.js's own
// requestAnimationFrame loop polls a live pointer/keyboard target every real
// frame and calls run.setTargetPosition() with it - if this script awaited
// between crank steps, that real loop would run in the gap and stomp the
// bot's steering back toward whatever the real (untouched) input state is.
// A synchronous loop never yields control back to the browser, so the real
// loop cannot interleave until the whole crank has already finished.
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:8837') + '/?debug=1';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE_URL, { waitUntil: 'load' });
await page.waitForTimeout(200);

/** Cranks the active run forward, dodging every obstacle correctly (and
 * deliberately boosting through the first barrier it meets, to exercise
 * that mechanic too) until it ends or `maxIterations` small time-steps have
 * passed. Returns a summary. */
async function crankToEnd(maxIterations = 400000) {
  return page.evaluate((iterationCap) => {
    function pickPlan(checkpoint, alreadyTestedBarrier) {
      if (!alreadyTestedBarrier) {
        const barrier = checkpoint.obstacles.find((o) => o.type === 'barrier');
        if (barrier) {
          return { x: Math.cos(barrier.angle) * barrier.radius, y: Math.sin(barrier.angle) * barrier.radius, needsBoost: true };
        }
      }
      // Steer to the dead center of whichever quadrant the fairness
      // guarantee left completely clear.
      const occupiedQuadrants = new Set(checkpoint.obstacles.map((o) => Math.floor(o.angle / (Math.PI / 2))));
      for (let q = 0; q < 4; q++) {
        if (!occupiedQuadrants.has(q)) {
          const angle = (q + 0.5) * (Math.PI / 2);
          return { x: Math.cos(angle) * 0.65, y: Math.sin(angle) * 0.65, needsBoost: false };
        }
      }
      return { x: 0, y: 0, needsBoost: false }; // unreachable given the fairness guarantee
    }

    const run = window.__swerveDebug.getRun();
    const REACTION_DISTANCE = 2; // start boosting this many distance units before a targeted barrier
    let steeredForIndex = -1;
    let currentPlan = null;
    let testedBarrier = false;
    let barrierBoostAttempts = 0;
    let iterations = 0;

    while (run.status === 'active' && iterations < iterationCap) {
      const checkpoint = run._nextCheckpoint;
      if (checkpoint.index !== steeredForIndex) {
        steeredForIndex = checkpoint.index;
        currentPlan = pickPlan(checkpoint, testedBarrier);
        if (currentPlan.needsBoost) {
          testedBarrier = true;
          barrierBoostAttempts += 1;
        }
        run.setTargetPosition(currentPlan.x, currentPlan.y);
      }
      if (currentPlan && currentPlan.needsBoost && !run.boosting && checkpoint.position - run.distance <= REACTION_DISTANCE) {
        run.triggerBoost();
      }
      run.tick(1 / 60);
      iterations++;
    }

    return {
      distance: run.distance,
      status: run.status,
      completed: run.completed,
      obstaclesCleared: run.obstaclesCleared,
      barrierBoostAttempts,
      iterations,
    };
  }, maxIterations);
}

console.log('=== Practice mode: bot dodges everything (and boosts through one barrier), cranked forward ===');
await page.click('#play-practice');
await page.waitForTimeout(100);
// 60 checkpoints at CHECKPOINT_SPACING=40 is 2400 distance units - comfortably
// past the speed ramp's plateau (SPEED_RAMP_DISTANCE=1600), so this also
// exercises max-speed obstacle timing, not just the easy early section.
const practiceOutcome = await crankToEnd(600000);
console.log('Practice outcome:', practiceOutcome);
const survivedManyObstacles = practiceOutcome.status === 'active' && practiceOutcome.obstaclesCleared >= 40;
const boostedThroughABarrier = practiceOutcome.barrierBoostAttempts >= 1;
console.log('Bot survived and cleared at least 40 obstacles without colliding:', survivedManyObstacles);
console.log('Bot boosted through at least one barrier:', boostedThroughABarrier);

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
// requestAnimationFrame loop - give that loop a real frame to notice the
// ended status, plus main.js's own RESULT_TRANSITION_DELAY_MS, before its
// normal finish-the-run transition to the result screen completes.
await page.waitForTimeout(1200);
const resultVisible = await page.isVisible('#screen-result');
const resultTitle = resultVisible ? await page.textContent('#result-title') : null;
console.log('Result screen visible:', resultVisible, '| title:', resultTitle);

const dailyCapReachedCleanly = dailyOutcome.status === 'ended' && dailyOutcome.completed === true;
console.log('Daily run reached the distance cap and ended as "completed":', dailyCapReachedCleanly);

console.log('\n=== Boost button + drag steering wiring (real DOM events, not the debug hook) ===');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(200);
await page.click('#play-practice');
await page.waitForTimeout(100);
const canvasBox = await page.locator('#canvas').boundingBox();
await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
await page.mouse.down();
await page.mouse.move(canvasBox.x + canvasBox.width * 0.85, canvasBox.y + canvasBox.height / 2, { steps: 8 });
await page.waitForTimeout(300);
await page.mouse.up();
const steeredByDrag = await page.evaluate(() => window.__swerveDebug.getRun().position.x > 0.3);
await page.click('#boost-btn');
await page.waitForTimeout(30);
const boostedByButton = await page.evaluate(() => window.__swerveDebug.getRun().boosting === true);
console.log('A real mouse drag moved the player right:', steeredByDrag);
console.log('Tapping the on-screen boost button triggered a boost:', boostedByButton);

console.log('\n=== Errors captured ===');
console.log(errors.length === 0 ? 'none' : errors.join('\n'));

await browser.close();
const failed =
  errors.length > 0 ||
  !survivedManyObstacles ||
  !boostedThroughABarrier ||
  !dailyCapReachedCleanly ||
  !resultVisible ||
  !steeredByDrag ||
  !boostedByButton;
process.exit(failed ? 1 : 0);
