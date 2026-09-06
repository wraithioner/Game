import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8837';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const failures = [];
page.on('response', (res) => {
  if (res.status() >= 400) failures.push(`${res.status()} ${res.url()}`);
});
page.on('requestfailed', (req) => failures.push(`FAILED ${req.url()} - ${req.failure()?.errorText}`));

await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(500); // let the service worker registration settle

const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.active?.state || 'registered-no-active-yet' : 'none';
});

console.log('Service worker state:', swState);
console.log('Failed/4xx/5xx requests:', failures.length === 0 ? 'none' : failures.join('\n'));
await browser.close();
process.exit(failures.length > 0 ? 1 : 0);
