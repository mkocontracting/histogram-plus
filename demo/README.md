# Histogram+ demo

Three worked examples for the AppSource listing and the project portfolio.

## Datasets

| File | Scenario | Rows | Story |
|---|---|---|---|
| `data/process-capability.csv` | Six Sigma — machined diameters | 200 | Mean ≈ 50.5 mm, σ ≈ 3.2. Spec LSL=45, USL=55, Target=50. Shows Cp/Cpk readout. |
| `data/lab-measurement.csv` | Laboratory pH measurement | 500 | Bimodal distribution around 6.4 and 7.6. Shows the visual catches non-Gaussian shape; the normal curve overlay is intentionally misleading and the user sees why. |
| `data/marketing-audience.csv` | Marketing audience age | 1000 | Right-skewed, ages 18–78. Shows histograms for non-process data. |

## Build the demo `.pbix`

### One-time setup
1. Open Power BI Desktop.
2. `File → Options → Preview features`. Enable both:
   - `Power BI Project (.pbip) save format`
   - `Store semantic model using TMDL format`
3. Restart Desktop after enabling.
4. Confirm `pbi-tools.exe` is on PATH:
   ```pwsh
   pbi-tools info
   ```
   Should report Desktop edition, version 1.2.0+, and detect your Power BI Desktop install.

### First-time demo build (manual, Desktop)
1. `Get Data → Text/CSV` → import all three files in `demo/data/`.
2. Add Histogram+ visual to the report (Import a Custom Visual from file: `HistogramPlus.pbiviz`).
3. Configure three report pages, one per dataset:
   - **Process capability**: Values = `Diameter_mm`. Enable Spec limits LSL=45, USL=55, Target=50, Show Cp/Cpk. Enable Reference lines (mean, sd 2-band). Normal curve on.
   - **Lab measurement**: Values = `pH`. Normal curve on. Reference lines: mean + median. Note in the title: "Bimodal distribution — normal curve does not fit".
   - **Marketing audience**: Values = `Age`. Bin mode = width 5. Reference lines: mean + median. Normal curve off.
4. `File → Save As → Power BI Project (.pbip)` to `demo/histogramPlus-demo/`.

### Subsequent visual updates (scripted, no Desktop needed)
After Marek has built the demo `.pbix` once and saved it to `visuals/histogram-plus/demo.pbix`, every following visual version bump can replace the embedded Histogram+ visual binary without re-opening Power BI Desktop:

```bash
npm run build              # produce a new .pbiviz in dist/
npm run demo:update        # swap the visual inside demo.pbix in place
```

`demo/update-pbix-visual.py` reads the newest `.pbiviz` from `dist/`, parses its embedded `package.json` + `resources/<guid>.pbiviz.json`, and rewrites the same two files inside the `.pbix` zip. The data model, report pages, settings, and bindings stay untouched.

### Rebuilding the demo from PBIP source
If the report pages themselves need to change (new page, new data binding, layout edits), Marek must re-open Desktop and re-save. The current PBIP source extracted by `pbi-tools extract` lives in `demo/extracted/` and is git-tracked so changes are diffable.
