const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Derive visual name from the project root (two levels up from harness/)
const projectRoot = path.resolve(__dirname, '..');
const visualName = path.basename(projectRoot);

(async () => {
  const src = path.join(projectRoot, 'harness', 'vhost.html');
  const dst = path.join(projectRoot, '.tmp', 'drop', 'vhost.html');
  fs.copyFileSync(src, dst);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 480 } });
  page.on('console', m => console.log('PAGE:', m.type(), m.text()));
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('file://' + dst);
  await page.waitForFunction('window.__rendered === true', { timeout: 10000 }).catch(() => {});
  const out = path.join(projectRoot, 'harness', 'screenshot.png');
  await page.screenshot({ path: out });
  const err = await page.$eval('#err', el => el.textContent).catch(() => '');
  if (err) console.log('ERROR:', err);
  await browser.close();

  // Mirror to OneDrive so Marek can watch along on Windows
  const mirror = '/mnt/c/Users/MKorb/OneDrive/01 Travel and work/01 MKO Contracting/04 AI stuff/AIprojects/projects/powerbi visuals/visuals/histogram-plus/screenshot.png';
  try { fs.copyFileSync(out, mirror); } catch(_) {}

  console.log('screenshot:', out);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
