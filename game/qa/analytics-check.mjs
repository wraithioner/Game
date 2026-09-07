// Verifies the analytics instrumentation actually fires the events
// docs/PRODUCT_PLAN.md's Analytics Specification defines, at the right
// moments, using the read-only debug hook. Throwaway QA script.
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:8837') + '/?debug=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE_URL, { waitUntil: 'load' });
await page.waitForTimeout(200);

await page.click('#play-practice');
await page.waitForTimeout(150);
const canvas = await page.$('#canvas');
const box = await canvas.boundingBox();
const canvasCenterX = box.x + box.width / 2;
const canvasCenterY = box.y + box.height / 2;

// Drag deliberately onto a real upcoming obstacle's exact position, waiting
// exactly as long as the real ramping speed says it should take to arrive
// (computed from speedAtDistance, exposed on the debug hook) - deterministic,
// rather than hoping an undirected drag happens to collide with something.
// We just want run_started/run_ended/first_run_demo_seen to fire; which
// obstacle ends it doesn't matter here.
const collisionPlan = await page.evaluate(() => {
  const run = window.__swerveDebug.getRun();
  const obstacle = run.getVisibleObstacles(300)[0];
  const speed = window.__swerveDebug.speedAtDistance(run.distance);
  return {
    x: Math.cos(obstacle.angle) * obstacle.radius,
    y: Math.sin(obstacle.angle) * obstacle.radius,
    etaSeconds: (obstacle.position - run.distance) / speed,
  };
});
const targetX = canvasCenterX + collisionPlan.x * (box.width / 2);
const targetY = canvasCenterY + collisionPlan.y * (box.height / 2);
await page.mouse.move(targetX, targetY);
await page.mouse.down();
await page.mouse.move(targetX, targetY, { steps: 3 });
await page.waitForTimeout(Math.min(Math.max(collisionPlan.etaSeconds * 1000 + 700, 800), 20000));
await page.mouse.up();
await page.waitForTimeout(500);

await page.click('#result-home');
await page.waitForTimeout(150);
await page.click('#open-settings');
await page.uncheck('#setting-sound'); // sound defaults to on, so toggle it off to force a real change event
await page.waitForTimeout(100);

const events = await page.evaluate(() => window.__swerveDebug.getRecentEvents().map((e) => e.event));
console.log('Events recorded, in order:', events);

const expectedPresent = ['session_start', 'run_started', 'first_run_demo_seen', 'run_ended', 'settings_changed'];
const missing = expectedPresent.filter((e) => !events.includes(e));
console.log('Missing expected events:', missing.length === 0 ? 'none' : missing.join(', '));

console.log('Errors:', errors.length === 0 ? 'none' : errors.join('\n'));
await browser.close();
process.exit(errors.length > 0 || missing.length > 0 ? 1 : 0);
