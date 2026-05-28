# Changelog

All notable changes to Histogram+ are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0.22] — 2026-05-28

### Added — design principles polish
- Localization: full `nl-NL` resjson + harness mock support; every user-facing string moves to `host.createLocalizationManager().getDisplayName(key)`.
- Locale-aware number formatting via `valueFormatter.create({ cultureSelector: host.locale })`; d3-format strings continue to work via auto-detection fallback.
- `description` + `descriptionKey` on every settings card and slice so the format pane shows hover tooltips.
- Themed focus ring + tabular-nums + reduced-motion CSS in `style/visual.less`.
- New SpecLimits readouts:
  - `Show sigma level + DPMO` — process sigma (3·Cpk) and Defects Per Million Opportunities derived via a normal-CDF approximation (Abramowitz-Stegun 26.2.17).
  - `Show Anderson-Darling p-value` — full A² normality test with D'Agostino/Stephens p-value approximation; reads the expanded weighted sample via `lastData`.
- Enter animation: bars grow from baseline (300 ms, easeCubicOut). Skipped under `prefers-reduced-motion: reduce` or the harness skip flag.
- Roving tabindex: only one bar holds `tabindex="0"` at a time; arrow / Home / End move focus; `Esc` clears selection.
- Adaptive x-axis label rotation (45°) when ticks would overlap, measured via `getComputedTextLength()`.
- Hover and focus crosshair guides (dashed) from the focused bar to both axes.
- Help icon (`?`) top-right that opens the GitHub README via `host.launchUrl`, keyboard-activatable.
- Sixth AppSource screenshot `06-capability.png` showcasing sigma/DPMO/AD readout.

### Changed
- Harness mock now resolves localization via the project resjson files instead of returning keys, allowing realistic locale assertions.
- Roving tabindex assertion replaces the previous "every bar focusable" check in the verify harness.

## [1.0.0.21] — 2026-05-28

### Added
- New branded histogram icon (replaces default scaffold icon).
- High-resolution marketplace icon (300×300) for AppSource listing.
- `CHANGELOG.md`, privacy section in `README.md`, support section in `README.md`.
- GitHub issue templates for bug reports and feature requests.
- Playwright AppSource screenshot pipeline (`npm run shots:appsource`) producing 5 listing-ready PNGs (default, advanced, dark theme, high-contrast, large dataset).

## [1.0.0.20] — 2026-05-28

### Added
- Certification metadata: `gitHubUrl`, `repository.url`, `supportUrl` (GitHub Issues), `author.email`.
- Custom Histogram+ landing page restored for the no-fields state, with `supportsLandingPage` and `supportsEmptyDataView` capabilities.
- `stringResources/en-US/resources.resjson` scaffold for localized data-role display names.
- Privacy and support sections in `README.md`.
- This changelog.

### Changed
- Normal curve uses `curveMonotoneX` for a statistically cleaner fitted-line shape.
- Custom x-axis range now excludes values outside the visible range from bar counts rather than clamping them into the first or last bin.
- Median reference line uses an expanded-count median for integer frequency weights, so even unweighted counts use the midpoint of the two middle values.

### Tests
- Playwright harness expanded to 20 scenarios covering boundary counts, out-of-range exclusion, even median, normal-curve symmetry, high contrast, tooltip payload, formatting, resize, `nl-NL` locale smoke, invalid config/values, highlight ratio geometry, and the restored custom landing page.

## [1.0.0.17] — 2026-05-28

### Changed
- Converted Histogram+ v1 to free-only: removed commercial prompts, feature gates, and license labels. All v1 features are available without restriction.

## [1.0.0.16] — 2026-05-28

### Verified
- Power BI Desktop smoke-test passed for core histogram behavior.

## [1.0.0.3] — 2026-05-27

### Added
- Initial scaffold with manual bin control, `[x)` intervals, exact custom x-axis range, frequency-weighted binning, normal curve overlay, LSL/USL spec limits, target line, Cp/Cpk, and mean/median/SD reference lines.
- Custom Histogram+ landing page rendered inside the single interactive SVG surface.
- Playwright harness for normal, empty, null, single, negative, custom-range, and no-data scenarios.
