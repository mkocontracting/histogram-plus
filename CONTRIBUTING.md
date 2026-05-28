# Contributing to Histogram+

## Repository layout

```
src/                # TypeScript source for the visual + settings model
style/              # Less stylesheet
capabilities.json   # Power BI visual capabilities + format pane property bag
pbiviz.json         # Visual manifest, version, GUID, locale list, support URL
stringResources/    # Localized resjson files (en-US, nl-NL)
harness/            # Playwright harness for headless rendering + screenshots
demo/               # Demo PBIP source + sample CSV datasets + .pbix-update script
.github/            # Issue templates
assets/             # In-visual icon + AppSource marketplace icon
```

## Local checks

Run from the repo root (Linux home / WSL, not from the OneDrive mount):

```bash
npm run lint
npm run verify              # Playwright harness (~21 scenarios)
npm run build               # produces dist/<guid>.<version>.pbiviz
npm run cert                # certification audit (no external requests check)
npm audit --audit-level=moderate
```

### Harness coverage

`npm run verify` runs the Playwright harness against:

- default render, frequency weighting, highlight rendering, custom range
- empty / null / single / negative data
- keyboard selection, context menu
- toggle-off and toggle-on branches for every overlay
- high-contrast rendering
- nl-NL locale smoke
- invalid configuration values
- bin boundary counts, normal-curve symmetry, even-count median
- capability extras (sigma level, DPMO, Anderson-Darling p-value)
- adaptive label rotation, hover crosshair, roving tabindex
- the custom Histogram+ landing page

## Screenshots and demo `.pbix`

```bash
npm run shots:appsource     # six 1280×720 PNGs for AppSource listing
npm run demo:update         # swap the embedded visual binary inside demo.pbix
                            # using the freshly built .pbiviz — no Desktop needed
```

A first-time demo `.pbix` must be built once in Power BI Desktop (see `demo/README.md`); after that, every visual version bump can rebuild the demo via `npm run demo:update`.

## Certification constraints

Histogram+ targets Microsoft AppSource certification. Keep these invariants:

- `capabilities.json` must keep `privileges: []`. No `WebAccess` or other privilege that breaks the certified-visual track.
- No external network calls (`fetch`, `XMLHttpRequest`, WebSocket, remote fonts, telemetry).
- No `innerHTML`, `eval`, `new Function`, dynamic timers, or minified source.
- All user-facing strings come from `stringResources/<locale>/resources.resjson`; no hardcoded English in `src/`.
- Numbers go through `valueFormatter.create({ cultureSelector: host.locale })` so the host locale controls decimal/group separators.
- Every code path must call `eventService.renderingStarted` and either `renderingFinished` or `renderingFailed`.

The full release checklist lives in `../../PLAYBOOK.md`.

## Release flow

1. Bump version in `pbiviz.json` (top-level + `visual.version`), `package.json`, `package-lock.json`, `CHANGELOG.md`, and `visuals/histogram-plus/STATUS.md`.
2. `npm run lint && npm run verify && npm run build && npm run cert && npm audit --audit-level=moderate`.
3. `npm run shots:appsource` to refresh the marketplace screenshots.
4. `npm run demo:update` to refresh the demo `.pbix`.
5. Copy `dist/<guid>.<version>.pbiviz` to `visuals/histogram-plus/HistogramPlus.pbiviz` in OneDrive and record the new SHA256 in `STATUS.md`.
6. Commit, push `main`, then fast-forward the `certification` branch and force-push it.
