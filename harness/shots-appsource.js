const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const src = path.join(projectRoot, 'harness', 'vhost.html');
const dst = path.join(projectRoot, '.tmp', 'drop', 'vhost.html');
const outDir = path.join(projectRoot, 'harness', 'appsource');
const oneDriveDir = '/mnt/c/Users/MKorb/OneDrive/01 Travel and work/01 MKO Contracting/04 AI stuff/AIprojects/projects/powerbi visuals/visuals/histogram-plus/appsource';

const HOST_W = 1280;
const HOST_H = 720;

const scenarios = [
  { name: 'appsourceDefault',        out: '01-default.png',        caption: 'Default histogram' },
  { name: 'appsourceAdvanced',       out: '02-advanced.png',       caption: 'Spec limits, target, Cp/Cpk, reference lines' },
  { name: 'appsourceDark',           out: '03-dark-theme.png',     caption: 'Dark report theme' },
  { name: 'appsourceHighContrast',   out: '04-high-contrast.png',  caption: 'Power BI high-contrast mode' },
  { name: 'appsourceLargeDataset',   out: '05-large-dataset.png',  caption: '2,000 samples, 40 bins' }
];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  try { fs.mkdirSync(oneDriveDir, { recursive: true }); } catch (_) {}
  fs.copyFileSync(src, dst);

  const browser = await chromium.launch();
  try {
    for (const scenario of scenarios) {
      const page = await browser.newPage({ viewport: { width: HOST_W + 40, height: HOST_H + 40 } });
      page.on('pageerror', e => console.error(`PAGEERROR ${scenario.name}: ${e.message}`));
      page.on('console', m => {
        if (m.type() === 'error') console.error(`CONSOLE ${scenario.name}: ${m.text()}`);
      });

      await page.goto(`file://${dst}?scenario=${encodeURIComponent(scenario.name)}&w=${HOST_W}&h=${HOST_H}`);
      await page.waitForFunction('window.__rendered === true', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(150);

      const target = path.join(outDir, scenario.out);
      await page.screenshot({ path: target, clip: { x: 0, y: 0, width: HOST_W + 2, height: HOST_H + 2 } });
      try { fs.copyFileSync(target, path.join(oneDriveDir, scenario.out)); } catch (_) {}

      const err = await page.$eval('#err', el => el.textContent).catch(() => '');
      if (err) console.error(`ERR ${scenario.name}: ${err}`);

      console.log(`✓ ${scenario.name} → ${path.relative(projectRoot, target)} — ${scenario.caption}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`done — ${scenarios.length} AppSource screenshots at ${HOST_W}×${HOST_H}`);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
