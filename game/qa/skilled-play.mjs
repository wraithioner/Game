// Simulates a "skilled player" using the debug hook to compute exact
// dead-center tap timing, to verify the core loop actually works as designed
// (laps survive, combo grows, difficulty ramps, daily mode caps correctly) -
// not just that the page loads without errors. Throwaway QA script.
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:8837') + '/?debug=1';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE_URL, { waitUntil: 'load' });
await page.waitForTimeout(200);

async function tapWhenPerfect() {
  const { lapStart, idealT, browserNow } = await page.evaluate(() => {
    const dbg = window.__ringtrueDebug;
    return {
      lapStart: dbg.getLapStartPerfMs(),
      idealT: dbg.findPerfectTapSeconds(),
      browserNow: performance.now(),
    };
  });
  const targetPerfMs = lapStart + idealT * 1000;
  const waitMs = Math.max(0, targetPerfMs - browserNow);
  await page.waitForTimeout(waitMs);
  const canvas = await page.$('#canvas');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

console.log('=== Practice mode: attempting 15 precisely-timed taps ===');
await page.click('#play-practice');
await page.waitForTimeout(150);

const lapLog = [];
for (let i = 0; i < 15; i++) {
  const before = await page.evaluate(() => ({
    lapIndex: window.__ringtrueDebug.getRun()?.lapIndex,
    status: window.__ringtrueDebug.getRun()?.status,
  }));
  if (!before || before.status !== 'active') {
    console.log(`Run ended before iteration ${i} (lapIndex=${before?.lapIndex})`);
    break;
  }
  await tapWhenPerfect();
  await page.waitForTimeout(60);
  const after = await page.evaluate(() => {
    const run = window.__ringtrueDebug.getRun();
    return run ? { lapIndex: run.lapIndex, combo: run.combo, status: run.status, lastResult: run.results[run.results.length - 1] } : null;
  });
  lapLog.push(after);
}

console.log(JSON.stringify(lapLog, null, 2));
const perfects = lapLog.filter((l) => l && l.lastResult === 'perfect').length;
console.log(`Perfects landed: ${perfects}/${lapLog.length}`);
const maxCombo = Math.max(...lapLog.filter(Boolean).map((l) => l.combo));
console.log(`Max combo reached: ×${maxCombo}`);

console.log('\n=== Daily mode: verifying the 20-lap cap ends the run as "completed" ===');
await page.click('#run-back');
await page.waitForTimeout(150);
await page.click('#play-daily');
await page.waitForTimeout(150);

let dailyOutcome = null;
for (let i = 0; i < 25; i++) {
  const status = await page.evaluate(() => window.__ringtrueDebug.getRun()?.status);
  if (status !== 'active') break;
  await tapWhenPerfect();
  await page.waitForTimeout(60);
  dailyOutcome = await page.evaluate(() => {
    const run = window.__ringtrueDebug.getRun();
    return run ? { lapIndex: run.lapIndex, status: run.status, completed: run.completed } : null;
  });
}
console.log('Daily outcome after loop:', dailyOutcome);
await page.waitForTimeout(500);
const resultVisible = await page.isVisible('#screen-result');
const resultTitle = resultVisible ? await page.textContent('#result-title') : null;
console.log('Result screen visible:', resultVisible, '| title:', resultTitle);

console.log('\n=== Errors captured ===');
console.log(errors.length === 0 ? 'none' : errors.join('\n'));

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
