# Histogram+

**🌐 Other languages:** [Nederlands](docs/README.nl.md) · [Deutsch](docs/README.de.md) · [Français](docs/README.fr.md) · [Español](docs/README.es.md) · [简体中文](docs/README.zh.md)

A Power BI custom visual for numeric distributions, built for quality, process, and lab analysis. It gives you manual bin control, a normal curve overlay, LSL/USL spec limits with target line, Cp/Cpk plus optional sigma level + DPMO and an Anderson-Darling normality test, and a clean reference-line layer (mean, median, ±N SD).

![Histogram+ — advanced view](harness/appsource/02-advanced.png)

## Features

- Three binning modes: **Auto (Sturges)**, **Number of bins**, and **Bin width**, with standard `[x)` intervals and the last bin closed on the right.
- Optional **custom x-axis range** that excludes values outside the visible range from bar counts.
- **Frequency (Count)** measure for correct binning of repeated or pre-grouped data.
- **Normal curve** overlay fitted to the data's mean and standard deviation.
- **Spec limits**: LSL, USL, Target line, and a capability readout that can show:
  - **Cp / Cpk**
  - **Sigma level + DPMO** (process capability translated to Six Sigma terms)
  - **Anderson-Darling p-value** (normality test)
- **Reference lines** for mean, median, and ±1/±2/±3 SD bands.
- Power BI **highlight / cross-highlight** rendering when the report passes highlight values.
- Adaptive x-axis label rotation, hover and focus crosshair guides, smooth enter animation, themed focus ring, full keyboard navigation (Arrow / Home / End / Enter / Esc).
- High-contrast support and `prefers-reduced-motion` respect.

## How to use

1. Add Histogram+ to your report (Visualizations pane → **Import a visual → from a file**).
2. Drag a numeric column to the **Values (numeric)** field.
3. If your data contains **repeated or integer-grouped values** (for example, age, score, or any column where the same value appears many times), also drag the same column to **Frequency (Count)** and set its aggregation to **Count**. Power BI groups categorical values before passing them to a custom visual; the Frequency measure carries the per-value count so bars are sized correctly.
4. Open the **Format** pane to adjust bin mode, axis range, spec limits, reference lines, and the capability readout.

### Tips

- For continuous measurements with near-unique decimals, you usually only need **Values (numeric)**.
- For pre-grouped data or integer surveys, the **Frequency = Count** pattern is required.
- Cp / Cpk only appears when both LSL and USL are set and LSL < USL.
- The Anderson-Darling test needs at least 8 observations and a non-zero sample standard deviation.

## Languages

Histogram+ is localized in:

- English (`en-US`)
- Dutch (`nl-NL`)
- German (`de-DE`)
- French (`fr-FR`)
- Spanish (`es-ES`)
- Simplified Chinese (`zh-CN`)

Power BI Desktop uses the host language for the format pane, the on-canvas labels (Mean, Median, LSL, USL, Target, etc.), and the visual's empty-state and tooltip text.

## FAQ

**Does Power BI have a built-in histogram?**
No. Power BI Desktop has no native histogram visual. You can fake one with a clustered column chart and a bin-grouping DAX measure, but the result has no normal curve, no spec limits, no Cp/Cpk, and no normality testing. Histogram+ fills that gap.

**What's the difference between Histogram+ and the Microsoft "Histogram chart" Power BI visual?**
The Microsoft sample histogram visual is a rendering demo with auto-binning only. Histogram+ adds manual bin control (count or width), a custom x-axis range that excludes out-of-range values from counts, frequency-weighted binning for pre-grouped data, a normal curve overlay, LSL/USL spec limits, target line, Cp/Cpk, sigma level + DPMO, Anderson-Darling normality test, Q-Q plot, box plot, and mean/median/SD reference lines.

**How do I create a histogram in Power BI for quality / Six Sigma analysis?**
Install Histogram+ from AppSource, drag a numeric column (e.g. measured diameter, weight, lab pH) to **Values (numeric)**, and turn on **Spec limits** in the Format pane. Enter LSL and USL. Cp/Cpk appears automatically when both limits are set. Enable **Show sigma level + DPMO** to translate Cp/Cpk into the Six Sigma vocabulary that quality teams use.

**How do I handle repeated values like ages, scores, or integer measurements?**
Power BI groups categorical values before passing them to a custom visual. Drag the same column to **Frequency (Count)** in addition to **Values (numeric)** and set the aggregation to Count. Histogram+ then uses the count as the bar weight, so each bar is sized correctly.

**Is Histogram+ certified by Microsoft?**
The published version is built for the Microsoft certified track: `privileges: []`, no external network calls, source publicly mirrored to the GitHub `certification` branch.

**Is Histogram+ free?**
Version 1 is fully free with no feature gates. Source is MIT licensed.

**Does it work offline / in air-gapped environments?**
Yes. Histogram+ has zero external network dependencies. The visual runs entirely inside Power BI's sandbox.

## Privacy

Histogram+ stores no data, sends no telemetry, and makes no external network calls. The visual runs entirely inside the Power BI sandbox and only uses the data the report passes to it. `capabilities.json` declares `privileges: []`. The full source is published in this repository and is not minified.

## Support

Bugs, feature requests, and questions go to the [GitHub issue tracker](https://github.com/mkocontracting/histogram-plus/issues).

## License

MIT. See the `LICENSE` file (or the header in `src/visual.ts`).

## Development

If you want to build or modify Histogram+, see [CONTRIBUTING.md](CONTRIBUTING.md).
