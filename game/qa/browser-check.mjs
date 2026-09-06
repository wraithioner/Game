// One-off manual browser smoke test, driven by Playwright, exercising the
// real game in a real (headless) browser. Not part of the shipped game or
// the `npm test` unit suite - a throwaway verification script for this
// build session. Requires a static server for game/ running already.
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8837';

const errors = [];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const context = await browser.newContext({ viewport: { width: 420, height: 820 } });
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(BASE_URL, { waitUntil: 'load' });
await page.waitForTimeout(300);

console.log('--- Home screen loaded ---');
await page.screenshot({ path: 'qa/screenshots/01-home.png' });

const ringNumber = await page.textContent('#ring-number');
console.log('Ring number text:', ringNumber);

console.log('--- Opening Practice ---');
await page.click('#play-practice');
await page.waitForTimeout(300);
await page.screenshot({ path: 'qa/screenshots/02-run.png' });

// Simulate a handful of taps on the canvas at varying delays, to exercise
// both successful laps and (eventually) a miss that ends the run.
const canvas = await page.$('#canvas');
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

let endedNaturally = false;
for (let i = 0; i < 40; i++) {
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(120 + Math.floor(Math.random() * 400));
  const resultVisible = await page.isVisible('#screen-result');
  if (resultVisible) {
    endedNaturally = true;
    break;
  }
}

console.log('Run ended naturally (a Miss occurred within 40 taps):', endedNaturally);
await page.waitForTimeout(300);
await page.screenshot({ path: 'qa/screenshots/03-result.png' });

const resultTitle = await page.textContent('#result-title').catch(() => null);
const resultDetail = await page.textContent('#result-detail').catch(() => null);
const ticks = await page.textContent('#result-ticks').catch(() => null);
console.log('Result title:', resultTitle);
console.log('Result detail:', resultDetail);
console.log('Tick strip:', ticks);

console.log('--- Testing share (clipboard fallback) ---');
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
await page.click('#share-btn');
await page.waitForTimeout(200);
const toast = await page.textContent('#share-toast').catch(() => null);
console.log('Share toast:', toast);
const clipboardText = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => `(unavailable: ${e})`);
console.log('Clipboard contents:', clipboardText);

console.log('--- Home -> Journal ---');
await page.click('#result-home');
await page.waitForTimeout(150);
await page.click('#open-journal');
await page.waitForTimeout(150);
await page.screenshot({ path: 'qa/screenshots/04-journal.png' });
const median = await page.textContent('#stat-median');
const runs = await page.textContent('#stat-runs');
console.log('Journal median offset:', median, '| runs played:', runs);

console.log('--- Settings: toggle dark theme, reduce motion, colorblind mode ---');
await page.click('#screen-journal .back-home');
await page.waitForTimeout(100);
await page.click('#open-settings');
await page.waitForTimeout(100);
await page.check('#setting-motion');
await page.check('#setting-colorblind');
await page.click('input[name="theme"][value="dark"]');
await page.waitForTimeout(200);
await page.screenshot({ path: 'qa/screenshots/05-settings-dark.png' });

const dataTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const bodyClasses = await page.evaluate(() => document.body.className);
console.log('data-theme:', dataTheme, '| body classes:', bodyClasses);

console.log('--- Reload: settings persisted? ---');
await page.reload();
await page.waitForTimeout(300);
const dataThemeAfterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const motionChecked = await page.isChecked('#setting-motion').catch(() => null);
await page.click('#open-settings');
const motionCheckedAfterOpen = await page.isChecked('#setting-motion');
console.log('data-theme after reload:', dataThemeAfterReload, '| reduce-motion checked after reopening settings:', motionCheckedAfterOpen);

console.log('--- Testing Daily Ring flow ---');
await page.click('#screen-settings .back-home');
await page.waitForTimeout(100);
await page.click('#play-daily');
await page.waitForTimeout(300);
await page.screenshot({ path: 'qa/screenshots/06-daily-run.png' });
// Tap once for a first lap, then click back without finishing (voids run).
await page.mouse.click(cx, cy);
await page.waitForTimeout(200);

console.log('--- Offline check ---');
await context.setOffline(true);
await page.reload().catch((e) => console.log('reload while offline threw (expected on first-ever load without SW cache warm):', String(e)));
await page.waitForTimeout(500);
const homeVisibleOffline = await page.isVisible('#screen-home').catch(() => false);
console.log('Home visible while offline (after a prior online load primed the cache):', homeVisibleOffline);
await context.setOffline(false);

console.log('\n=== Console/page errors captured ===');
console.log(errors.length === 0 ? 'none' : errors.join('\n'));

await browser.close();

if (errors.length > 0) {
  console.log('\nFAIL: console/page errors were captured.');
  process.exit(1);
}
console.log('\nAll smoke checks completed with no console/page errors.');
