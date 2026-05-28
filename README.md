# Histogram+

Histogram+ is a Power BI custom visual for numeric distributions with manual bin control, standard `[x)` intervals, exact x-axis bounds, normal curve overlay, LSL/USL spec limits, target line, Cp/Cpk, and reference lines.

## Features

- Histogram rendering.
- Auto, bin-count, and bin-width modes.
- Standard `[x)` interval binning.
- Exact custom x-axis range.
- Axes, labels, bar formatting, tooltips, and context menu.
- Power BI highlight/cross-highlight rendering when highlight values are provided by the host.
- Normal curve.
- LSL/USL spec limits and target line.
- Cp/Cpk readout.
- Mean, median, and SD reference lines.

## Data Roles

- `Values (numeric)`: required numeric column.
- `Frequency (Count)`: optional count/weight measure.

Power BI sends grouped category values to custom visuals. For continuous measurements with near-unique decimals, use only `Values (numeric)`. For repeated discrete or integer values, add the same field to `Frequency (Count)` and set aggregation to Count.

## Local Checks

```bash
npm run lint
npm run verify
npm run build
npm run cert
npm audit --audit-level=moderate
```

`npm run verify` runs the Playwright harness against normal render, frequency weighting, highlight rendering, custom range, empty/null/single/negative data, keyboard selection, advanced feature rendering, and no-data native placeholder behavior.

The no-data state uses a custom Histogram+ landing page with setup instructions. In Power BI Desktop this means the visual body behaves like an interactive custom-visual surface; drag from the frame when repositioning an empty visual.

## Certification Constraints

- `privileges` must remain `[]`.
- No network calls, `innerHTML`, dynamic code execution, or minified source files.
- Package from the Linux project directory, not the OneDrive handoff folder.
- Replace only the rolling handoff artifact: `visuals/histogram-plus/HistogramPlus.pbiviz`.
