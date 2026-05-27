const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 480 } });
  page.on('console', m => console.log('PAGE:', m.type(), m.text()));
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  const f = path.join(process.env.HOME, 'histogramPlus/.tmp/drop/vhost.html');
  await page.goto('file://' + f);
  await page.waitForFunction('window.__rendered === true', { timeout: 10000 }).catch(() => {});
  const out = path.join(process.env.HOME, 'histogramPlus/harness/screenshot.png');
  await page.screenshot({ path: out });
  const err = await page.$eval('#err', el => el.textContent).catch(() => '');
  if (err) console.log('ERROR:', err);
  await browser.close();
  console.log('screenshot:', out);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
