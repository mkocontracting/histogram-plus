const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const src = path.join(projectRoot, 'harness', 'vhost.html');
const dst = path.join(projectRoot, '.tmp', 'drop', 'vhost.html');

function loadResjson(locale) {
  const file = path.join(projectRoot, 'stringResources', locale, 'resources.resjson');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function injectLocStrings(htmlPath) {
  const locales = ['en-US', 'nl-NL', 'de-DE', 'fr-FR', 'es-ES', 'zh-CN'];
  const bundle = Object.fromEntries(locales.map(l => [l, loadResjson(l)]));
  const injection = `<script>window.__resStrings = ${JSON.stringify(bundle)};\n` +
    `window.__locStrings = window.__resStrings['en-US'];</script>`;
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace('<body>', `<body>\n${injection}`);
  fs.writeFileSync(htmlPath, html);
}

const scenarios = [
  { name: 'default', bars: true, normalCurve: true, specLimits: 3, referenceLines: true, capability: true, axisTitles: true, totalCount: 150, exactBarCounts: [3, 9, 12, 13, 15, 14, 14, 12, 13, 12, 11, 12, 9, 1], capabilityText: /Cp 0\.443\s+Cpk 0\.414/, formattedTicks: true },
  { name: 'tooltip', bars: true, tooltip: true },
  { name: 'highContrast', bars: true, normalCurve: true, specLimits: 2, referenceLines: true, capability: true, highContrast: { fill: '#000000', stroke: '#ffff00' } },
  { name: 'barStyle', bars: true, barStyle: { fill: '#123456', stroke: '#654321', opacity: 0.55 } },
  { name: 'toggleOff', bars: true, normalCurve: false, specLimits: 2, referenceLines: false, capability: false, lineLabels: 0 },
  { name: 'resize', bars: true, resize: { width: 360, height: 260 } },
  { name: 'nlLocale', bars: true, exactBarCounts: [2, 2, 1], formattedTicks: true },
  { name: 'invalidConfig', bars: true, specLimits: 2, capability: false, exactBarCounts: [5] },
  { name: 'invalidValues', bars: true, totalCount: 3, exactBarCounts: [1, 1, 1] },
  { name: 'frequency', bars: true, totalCount: 10, exactBarCounts: [1, 2, 4, 3] },
  { name: 'highlight', bars: true, totalCount: 18, highlightCount: 6, exactBarCounts: [2, 4, 6, 6], expectedHighlightCounts: [0, 2, 3, 1] },
  { name: 'boundary', bars: true, totalCount: 9, exactBarCounts: [2, 2, 2, 1, 2] },
  { name: 'normalSymmetry', bars: true, normalCurve: true, normalSymmetry: true },
  { name: 'medianEven', bars: true, referenceLines: true, expectedReferenceLineXs: [300] },
  { name: 'customRange', bars: true },
  { name: 'noValuesInRange', message: 'No values in the selected x-axis range' },
  { name: 'allNull', message: 'No numeric values to display' },
  { name: 'single', bars: true },
  { name: 'negative', bars: true, referenceLines: true },
  { name: 'noData', landing: true },
  { name: 'capabilityExtras', bars: true, capability: true, capabilityExtra: 2 },
  { name: 'qqPlot', bars: true, qqPoints: true },
  { name: 'boxPlot', bars: true, boxPlot: true },
  { name: 'mobile', bars: true, mobile: true },
  { name: 'tooltipMini', bars: true, tooltip: true, miniChart: true },
  { name: 'tour', bars: true, tour: true }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  injectLocStrings(dst);
  const capabilities = JSON.parse(fs.readFileSync(path.join(projectRoot, 'capabilities.json'), 'utf8'));
  assert(capabilities.supportsLandingPage === true, 'capabilities: supportsLandingPage must stay enabled for the custom landing page');
  assert(capabilities.supportsEmptyDataView === true, 'capabilities: supportsEmptyDataView must stay enabled for the custom landing page');

  const browser = await chromium.launch();

  try {
    for (const scenario of scenarios) {
      const page = await browser.newPage({ viewport: { width: 700, height: 480 } });
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(`${msg.type()}: ${msg.text()}`);
      });
      page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));

      await page.goto('file://' + dst + '?scenario=' + encodeURIComponent(scenario.name));
      await page.waitForFunction('window.__rendered === true', { timeout: 10000 });
      await page.waitForTimeout(50);
      const err = await page.$eval('#err', el => el.textContent).catch(() => '');
      assert(!err, `${scenario.name}: rendering error: ${err}`);
      assert(consoleErrors.length === 0, `${scenario.name}: console errors: ${consoleErrors.join('; ')}`);

      const result = await page.evaluate(() => ({
        bars: document.querySelectorAll('rect.bar').length,
        highlights: document.querySelectorAll('rect.bar-highlight').length,
        normalCurve: document.querySelectorAll('.normal-curve').length,
        specLimits: document.querySelectorAll('.spec-limit').length,
        referenceLines: document.querySelectorAll('.reference-line').length,
        referenceLineXs: Array.from(document.querySelectorAll('.reference-line')).map(el => Number(el.getAttribute('x1'))),
        lineLabels: document.querySelectorAll('.line-label').length,
        capability: document.querySelectorAll('.capability-label').length,
        qqPoints: document.querySelectorAll('.qq-point').length,
        boxPlots: document.querySelectorAll('.box-plot').length,
        tours: document.querySelectorAll('.tour').length,
        tooltipServiceCalled: typeof window.tooltipShown === 'undefined' ? 0 : window.tooltipShown,
        capabilityExtra: document.querySelectorAll('.capability-extra').length,
        capabilityText: document.querySelector('.capability-label')?.textContent || '',
        capabilityExtraText: Array.from(document.querySelectorAll('.capability-extra')).map(el => el.textContent || ''),
        axisTitles: document.querySelectorAll('.axis-title').length,
        xTickTexts: Array.from(document.querySelectorAll('.x-axis text')).map(el => el.textContent || ''),
        yTickTexts: Array.from(document.querySelectorAll('.y-axis text')).map(el => el.textContent || ''),
        firstBarFill: document.querySelector('rect.bar')?.getAttribute('fill') || '',
        firstBarStroke: document.querySelector('rect.bar')?.getAttribute('stroke') || '',
        firstBarOpacity: Number(document.querySelector('rect.bar')?.getAttribute('fill-opacity') || 0),
        normalCurveStroke: document.querySelector('.normal-curve')?.getAttribute('stroke') || '',
        referenceStroke: document.querySelector('.reference-line')?.getAttribute('stroke') || '',
        specStroke: document.querySelector('.spec-limit')?.getAttribute('stroke') || '',
        barBoxes: Array.from(document.querySelectorAll('rect.bar')).map(el => ({
          x: Number(el.getAttribute('x')),
          y: Number(el.getAttribute('y')),
          width: Number(el.getAttribute('width')),
          height: Number(el.getAttribute('height'))
        })),
        highlightBoxes: Array.from(document.querySelectorAll('rect.bar-highlight')).map(el => ({
          x: Number(el.getAttribute('x')),
          y: Number(el.getAttribute('y')),
          width: Number(el.getAttribute('width')),
          height: Number(el.getAttribute('height'))
        })),
        barCounts: Array.from(document.querySelectorAll('rect.bar')).map(el => Number(el.getAttribute('data-count') || 0)),
        message: document.querySelector('.empty-message')?.textContent || '',
        landingNodes: document.querySelectorAll('.landing-page,.landing-title,.landing-step-text').length,
        landingTitle: document.querySelector('.landing-title')?.textContent || '',
        landingSteps: document.querySelectorAll('.landing-step-text').length,
        bodyChildren: document.querySelector('svg.histogram-plus')?.children.length || 0,
        svgWidth: Number(document.querySelector('svg.histogram-plus')?.getAttribute('width') || 0),
        svgHeight: Number(document.querySelector('svg.histogram-plus')?.getAttribute('height') || 0),
        aria: document.querySelector('svg.histogram-plus')?.getAttribute('aria-label') || '',
        focusedBarCount: document.querySelectorAll('rect.bar[tabindex="0"]').length,
        rovingBarCount: document.querySelectorAll('rect.bar[tabindex="-1"]').length,
        normalCurveMetrics: (() => {
          const path = document.querySelector('.normal-curve');
          if (!path) return null;
          const length = path.getTotalLength();
          const points = Array.from({ length: 301 }, (_, i) => path.getPointAtLength(length * i / 300))
            .sort((a, b) => a.x - b.x);
          const bbox = path.getBBox();
          const centerX = bbox.x + bbox.width / 2;
          const peak = points.reduce((best, point) => point.y < best.y ? point : best, points[0]);
          const yAt = (x) => {
            for (let i = 1; i < points.length; i++) {
              const prev = points[i - 1];
              const next = points[i];
              if (x >= prev.x && x <= next.x) {
                const t = next.x === prev.x ? 0 : (x - prev.x) / (next.x - prev.x);
                return prev.y + (next.y - prev.y) * t;
              }
            }
            return points[points.length - 1].y;
          };
          const deltas = [];
          for (let i = 1; i <= 8; i++) {
            const dx = bbox.width * i / 20;
            deltas.push(Math.abs(yAt(centerX - dx) - yAt(centerX + dx)));
          }
          return {
            peakDelta: Math.abs(peak.x - centerX),
            maxMirrorYDelta: Math.max(...deltas),
            bboxHeight: bbox.height
          };
        })()
      }));

      if (scenario.bars) {
        assert(result.bars > 0, `${scenario.name}: expected bars`);
        assert(result.focusedBarCount === 1, `${scenario.name}: exactly one bar must hold tabindex 0 (roving), got ${result.focusedBarCount}`);
        assert(result.focusedBarCount + result.rovingBarCount === result.bars, `${scenario.name}: every bar should be either tabindex 0 or -1`);
        const selected = await page.evaluate(() => {
          const firstBar = document.querySelector('rect.bar');
          firstBar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          return window.__selected || 0;
        });
        assert(selected > 0, `${scenario.name}: keyboard selection did not fire`);
        const contextMenu = await page.evaluate(() => {
          const firstBar = document.querySelector('rect.bar');
          firstBar?.dispatchEvent(new MouseEvent('contextmenu', { clientX: 12, clientY: 34, bubbles: true, cancelable: true }));
          return window.__contextMenu || null;
        });
        assert(contextMenu?.pos?.x === 12 && contextMenu?.pos?.y === 34, `${scenario.name}: context menu did not fire`);
      }
      if (scenario.normalCurve === true) assert(result.normalCurve > 0, `${scenario.name}: expected normal curve`);
      if (scenario.normalCurve === false) assert(result.normalCurve === 0, `${scenario.name}: expected no normal curve`);
      if (scenario.specLimits) assert(result.specLimits === scenario.specLimits, `${scenario.name}: expected ${scenario.specLimits} spec/target lines`);
      if (scenario.referenceLines === true) assert(result.referenceLines > 0, `${scenario.name}: expected reference lines`);
      if (scenario.referenceLines === false) assert(result.referenceLines === 0, `${scenario.name}: expected no reference lines`);
      if (scenario.expectedReferenceLineXs) {
        assert(result.referenceLineXs.length === scenario.expectedReferenceLineXs.length, `${scenario.name}: expected ${scenario.expectedReferenceLineXs.length} reference lines, got ${result.referenceLineXs.length}`);
        scenario.expectedReferenceLineXs.forEach((expected, i) => {
          assert(Math.abs(result.referenceLineXs[i] - expected) <= 1, `${scenario.name}: expected reference line x ${expected}, got ${result.referenceLineXs[i]}`);
        });
      }
      if (scenario.capability === true) assert(result.capability === 1, `${scenario.name}: expected Cp/Cpk label`);
      if (scenario.capability === false) assert(result.capability === 0, `${scenario.name}: expected no Cp/Cpk label`);
      if (scenario.capabilityText) assert(scenario.capabilityText.test(result.capabilityText), `${scenario.name}: unexpected Cp/Cpk text "${result.capabilityText}"`);
      if (scenario.capabilityExtra !== undefined) assert(result.capabilityExtra === scenario.capabilityExtra, `${scenario.name}: expected ${scenario.capabilityExtra} extra capability lines, got ${result.capabilityExtra}`);
      if (scenario.axisTitles) assert(result.axisTitles === 2, `${scenario.name}: expected axis titles`);
      if (scenario.lineLabels !== undefined) assert(result.lineLabels === scenario.lineLabels, `${scenario.name}: expected ${scenario.lineLabels} line labels, got ${result.lineLabels}`);
      if (scenario.formattedTicks) {
        const xTicks = result.xTickTexts.filter(Boolean);
        assert(xTicks.length > 0, `${scenario.name}: expected x-axis tick labels`);
        assert(xTicks.every(text => /^-?[\d,]+\.\d$/.test(text)), `${scenario.name}: x tick labels do not match .1f format: ${xTicks.join(', ')}`);
        const yTicks = result.yTickTexts.filter(Boolean);
        assert(yTicks.length > 0, `${scenario.name}: expected y-axis tick labels`);
        assert(yTicks.every(text => /^-?[\d,]+$/.test(text)), `${scenario.name}: y tick labels do not match ,.0f format: ${yTicks.join(', ')}`);
      }
      if (scenario.totalCount !== undefined) {
        const total = result.barCounts.reduce((sum, value) => sum + value, 0);
        assert(total === scenario.totalCount, `${scenario.name}: expected total count ${scenario.totalCount}, got ${total}`);
      }
      if (scenario.exactBarCounts) {
        assert(JSON.stringify(result.barCounts) === JSON.stringify(scenario.exactBarCounts), `${scenario.name}: expected bar counts ${scenario.exactBarCounts.join(',')}, got ${result.barCounts.join(',')}`);
      }
      if (scenario.normalSymmetry) {
        assert(result.normalCurveMetrics, `${scenario.name}: expected normal-curve metrics`);
        assert(result.normalCurveMetrics.peakDelta <= 3, `${scenario.name}: curve peak is not centered, delta ${result.normalCurveMetrics.peakDelta}`);
        assert(result.normalCurveMetrics.maxMirrorYDelta <= Math.max(2, result.normalCurveMetrics.bboxHeight * 0.08), `${scenario.name}: curve mirror mismatch ${result.normalCurveMetrics.maxMirrorYDelta}`);
      }
      if (scenario.highlightCount !== undefined) {
        assert(result.highlights > 0, `${scenario.name}: expected highlight overlay bars`);
        assert(result.highlightBoxes.length === result.barBoxes.length, `${scenario.name}: highlight overlay should have one rect per bin`);
        result.highlightBoxes.forEach((box, i) => {
          const base = result.barBoxes[i];
          assert(Math.abs(box.x - base.x) <= 0.01 && Math.abs(box.width - base.width) <= 0.01, `${scenario.name}: highlight ${i} does not align with base bar`);
          assert(box.height <= base.height + 0.01, `${scenario.name}: highlight ${i} height exceeds base bar`);
          if (scenario.expectedHighlightCounts) {
            const expectedRatio = scenario.expectedHighlightCounts[i] / result.barCounts[i];
            const actualRatio = base.height === 0 ? 0 : box.height / base.height;
            assert(Math.abs(actualRatio - expectedRatio) <= 0.02, `${scenario.name}: highlight ${i} expected ratio ${expectedRatio}, got ${actualRatio}`);
          }
        });
        const highlighted = await page.evaluate(() => Array.from(document.querySelectorAll('rect.bar-highlight')).reduce((sum, el) => sum + Number(el.getAttribute('height') || 0), 0));
        assert(highlighted > 0, `${scenario.name}: highlight scenario rendered no visible highlight height`);
      }
      if (scenario.message) assert(result.message === scenario.message, `${scenario.name}: expected message "${scenario.message}", got "${result.message}"`);
      if (scenario.qqPoints) assert(result.qqPoints > 0, `${scenario.name}: expected Q-Q points`);
      if (scenario.boxPlot) assert(result.boxPlots > 0, `${scenario.name}: expected box plot group`);
      if (scenario.mobile) {
        const titles = await page.$$eval('.axis-title', els => els.length);
        assert(titles === 0, `${scenario.name}: expected axis titles to be dropped at narrow viewport, got ${titles}`);
      }
      if (scenario.tour) assert(result.tours > 0, `${scenario.name}: expected tour overlay`);
      if (scenario.landing) {
        assert(result.landingNodes > 0, `${scenario.name}: custom landing page should render`);
        assert(result.landingTitle === 'Histogram+', `${scenario.name}: expected Histogram+ landing title, got "${result.landingTitle}"`);
        assert(result.landingSteps === 2, `${scenario.name}: expected two landing steps, got ${result.landingSteps}`);
      }
      if (scenario.highContrast) {
        assert(result.firstBarFill.toLowerCase() === scenario.highContrast.fill, `${scenario.name}: expected high-contrast bar fill ${scenario.highContrast.fill}, got ${result.firstBarFill}`);
        assert(result.firstBarStroke.toLowerCase() === scenario.highContrast.stroke, `${scenario.name}: expected high-contrast bar stroke ${scenario.highContrast.stroke}, got ${result.firstBarStroke}`);
        assert(result.normalCurveStroke.toLowerCase() === scenario.highContrast.stroke, `${scenario.name}: expected high-contrast normal curve stroke ${scenario.highContrast.stroke}, got ${result.normalCurveStroke}`);
        assert(result.referenceStroke.toLowerCase() === scenario.highContrast.stroke, `${scenario.name}: expected high-contrast reference stroke ${scenario.highContrast.stroke}, got ${result.referenceStroke}`);
        assert(result.specStroke.toLowerCase() === scenario.highContrast.stroke, `${scenario.name}: expected high-contrast spec stroke ${scenario.highContrast.stroke}, got ${result.specStroke}`);
      }
      if (scenario.barStyle) {
        assert(result.firstBarFill.toLowerCase() === scenario.barStyle.fill, `${scenario.name}: expected bar fill ${scenario.barStyle.fill}, got ${result.firstBarFill}`);
        assert(result.firstBarStroke.toLowerCase() === scenario.barStyle.stroke, `${scenario.name}: expected bar stroke ${scenario.barStyle.stroke}, got ${result.firstBarStroke}`);
        assert(Math.abs(result.firstBarOpacity - scenario.barStyle.opacity) <= 0.001, `${scenario.name}: expected bar opacity ${scenario.barStyle.opacity}, got ${result.firstBarOpacity}`);
      }
      if (scenario.tooltip) {
        const tooltip = await page.evaluate(() => {
          const firstBar = document.querySelector('rect.bar');
          firstBar?.dispatchEvent(new PointerEvent('pointerover', { pointerId: 1, pointerType: 'mouse', clientX: 22, clientY: 33, bubbles: true, cancelable: true }));
          firstBar?.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 22, clientY: 33, bubbles: true, cancelable: true }));
          return window.__tooltipShows?.[0] || window.__tooltipMoves?.[0] || null;
        });
        const dataItems = tooltip?.dataItems || tooltip?.data || [];
        assert(Array.isArray(dataItems) && dataItems.some(item => item.displayName === 'Range'), `${scenario.name}: tooltip should include Range data item`);
        assert(dataItems.some(item => item.displayName === 'Count'), `${scenario.name}: tooltip should include Count data item`);
      }
      if (scenario.resize) {
        const resized = await page.evaluate(({ width, height }) => {
          window.__updateVisual(width, height);
          return new Promise(resolve => {
            const started = Date.now();
            const poll = () => {
              if (window.__rendered === true || Date.now() - started > 3000) {
                resolve({
                  rendered: window.__rendered === true,
                  svgWidth: Number(document.querySelector('svg.histogram-plus')?.getAttribute('width') || 0),
                  svgHeight: Number(document.querySelector('svg.histogram-plus')?.getAttribute('height') || 0),
                  bars: document.querySelectorAll('rect.bar').length,
                  bodyChildren: document.querySelector('svg.histogram-plus')?.children.length || 0
                });
                return;
              }
              setTimeout(poll, 20);
            };
            poll();
          });
        }, scenario.resize);
        assert(resized.rendered, `${scenario.name}: resize update did not finish`);
        assert(resized.svgWidth === scenario.resize.width && resized.svgHeight === scenario.resize.height, `${scenario.name}: resize dimensions not applied`);
        assert(resized.bars === result.bars, `${scenario.name}: resize changed bin count from ${result.bars} to ${resized.bars}`);
        assert(resized.bodyChildren > 0 && resized.bodyChildren <= result.bodyChildren + 2, `${scenario.name}: resize likely retained stale DOM nodes`);
      }
      assert(result.aria.includes('Histogram+'), `${scenario.name}: missing SVG aria label`);

      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`verified ${scenarios.length} harness scenarios`);
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
