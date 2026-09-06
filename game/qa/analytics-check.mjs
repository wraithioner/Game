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
// A handful of untimed taps - some will miss quickly, which is fine, we just
// want run_started/run_ended/first_lap_result/first_run_demo_seen to fire.
for (let i = 0; i < 3; i++) {
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const stillRunning = await page.evaluate(() => window.__ringtrueDebug.getRun()?.status === 'active');
  if (!stillRunning) break;
}
await page.waitForTimeout(500);

await page.click('#result-home');
await page.waitForTimeout(150);
await page.click('#open-settings');
await page.uncheck('#setting-sound'); // sound defaults to on, so toggle it off to force a real change event
await page.waitForTimeout(100);

const events = await page.evaluate(() => window.__ringtrueDebug.getRecentEvents().map((e) => e.event));
console.log('Events recorded, in order:', events);

const expectedPresent = ['session_start', 'run_started', 'first_run_demo_seen', 'first_lap_result', 'run_ended', 'settings_changed'];
const missing = expectedPresent.filter((e) => !events.includes(e));
console.log('Missing expected events:', missing.length === 0 ? 'none' : missing.join(', '));

console.log('Errors:', errors.length === 0 ? 'none' : errors.join('\n'));
await browser.close();
process.exit(errors.length > 0 || missing.length > 0 ? 1 : 0);
