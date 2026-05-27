const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  // Always sync vhost.html to .tmp/drop/ before screenshotting
  const src = path.join(process.env.HOME, 'histogramPlus/harness/vhost.html');
  const dst = path.join(process.env.HOME, 'histogramPlus/.tmp/drop/vhost.html');
  fs.copyFileSync(src, dst);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 480 } });
  page.on('console', m => console.log('PAGE:', m.type(), m.text()));
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('file://' + dst);
  await page.waitForFunction('window.__rendered === true', { timeout: 10000 }).catch(() => {});
  const out = path.join(process.env.HOME, 'histogramPlus/harness/screenshot.png');
  await page.screenshot({ path: out });
  const err = await page.$eval('#err', el => el.textContent).catch(() => '');
  if (err) console.log('ERROR:', err);
  await browser.close();
  console.log('screenshot:', out);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
