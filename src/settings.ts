"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import Card  = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;
import Model = formattingSettings.Model;

// ── Bins ──────────────────────────────────────────────────────────────────────
class BinsCard extends Card {
    mode = new formattingSettings.ItemDropdown({
        name: "mode",
        displayName: "Bin mode",
        value: { value: "auto", displayName: "Auto (Sturges)" },
        items: [
            { value: "auto",  displayName: "Auto (Sturges)" },
            { value: "count", displayName: "Number of bins" },
            { value: "width", displayName: "Bin width" }
        ]
    });

    count = new formattingSettings.NumUpDown({
        name: "count", displayName: "Number of bins",
        value: 10, options: { minValue: { value: 1, type: powerbi.visuals.ValidatorType.Min },
                               maxValue: { value: 200, type: powerbi.visuals.ValidatorType.Max } }
    });

    width = new formattingSettings.NumUpDown({
        name: "width", displayName: "Bin width",
        value: 5, options: { minValue: { value: 0.001, type: powerbi.visuals.ValidatorType.Min } }
    });

    name: string = "bins";
    displayName: string = "Bins";
    slices: Slice[] = [this.mode, this.count, this.width];
}

// ── Bars ──────────────────────────────────────────────────────────────────────
class BarsCard extends Card {
    fill = new formattingSettings.ColorPicker({
        name: "fill", displayName: "Bar color",
        value: { value: "#01B8AA" }
    });

    fillOpacity = new formattingSettings.NumUpDown({
        name: "fillOpacity", displayName: "Opacity (%)",
        value: 80, options: { minValue: { value: 0,   type: powerbi.visuals.ValidatorType.Min },
                               maxValue: { value: 100, type: powerbi.visuals.ValidatorType.Max } }
    });

    stroke = new formattingSettings.ColorPicker({
        name: "stroke", displayName: "Border color",
        value: { value: "#ffffff" }
    });

    gap = new formattingSettings.NumUpDown({
        name: "gap", displayName: "Gap (%)",
        value: 8, options: { minValue: { value: 0, type: powerbi.visuals.ValidatorType.Min },
                              maxValue: { value: 80, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "bars";
    displayName: string = "Bars";
    slices: Slice[] = [this.fill, this.fillOpacity, this.stroke, this.gap];
}

// ── Normal curve ──────────────────────────────────────────────────────────────
class NormalCurveCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayName: undefined, value: false
    });
    topLevelSlice = this.show;

    color = new formattingSettings.ColorPicker({
        name: "color", displayName: "Curve color",
        value: { value: "#e8392a" }
    });

    strokeWidth = new formattingSettings.NumUpDown({
        name: "strokeWidth", displayName: "Stroke width",
        value: 2, options: { minValue: { value: 1, type: powerbi.visuals.ValidatorType.Min },
                              maxValue: { value: 10, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "normalCurve";
    displayName: string = "Normal curve";
    slices: Slice[] = [this.color, this.strokeWidth];
}

// ── Spec limits ───────────────────────────────────────────────────────────────
class SpecLimitsCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayName: undefined, value: false
    });
    topLevelSlice = this.show;

    lsl = new formattingSettings.NumUpDown({
        name: "lsl", displayName: "LSL (lower spec limit)", value: 0
    });

    usl = new formattingSettings.NumUpDown({
        name: "usl", displayName: "USL (upper spec limit)", value: 100
    });

    color = new formattingSettings.ColorPicker({
        name: "color", displayName: "Line color",
        value: { value: "#d64550" }
    });

    showLabels = new formattingSettings.ToggleSwitch({
        name: "showLabels", displayName: "Show labels", value: true
    });

    showTarget = new formattingSettings.ToggleSwitch({
        name: "showTarget", displayName: "Show target", value: false
    });

    target = new formattingSettings.NumUpDown({
        name: "target", displayName: "Target", value: 50
    });

    showCpk = new formattingSettings.ToggleSwitch({
        name: "showCpk", displayName: "Show Cp / Cpk", value: true
    });

    decimals = new formattingSettings.NumUpDown({
        name: "decimals", displayName: "Decimals",
        value: 2, options: { minValue: { value: 0, type: powerbi.visuals.ValidatorType.Min },
                              maxValue: { value: 6, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "specLimits";
    displayName: string = "Spec limits";
    slices: Slice[] = [this.lsl, this.usl, this.color, this.showLabels, this.showTarget, this.target, this.showCpk, this.decimals];
}

// ── Reference lines ──────────────────────────────────────────────────────────
class ReferenceLinesCard extends Card {
    showMean = new formattingSettings.ToggleSwitch({
        name: "showMean", displayName: "Mean", value: false
    });

    showMedian = new formattingSettings.ToggleSwitch({
        name: "showMedian", displayName: "Median", value: false
    });

    showSd = new formattingSettings.ToggleSwitch({
        name: "showSd", displayName: "Mean ±1 SD", value: false
    });

    sdCount = new formattingSettings.NumUpDown({
        name: "sdCount", displayName: "SD bands",
        value: 1, options: { minValue: { value: 1, type: powerbi.visuals.ValidatorType.Min },
                              maxValue: { value: 3, type: powerbi.visuals.ValidatorType.Max } }
    });

    color = new formattingSettings.ColorPicker({
        name: "color", displayName: "Line color",
        value: { value: "#5b5fc7" }
    });

    strokeWidth = new formattingSettings.NumUpDown({
        name: "strokeWidth", displayName: "Stroke width",
        value: 1, options: { minValue: { value: 1, type: powerbi.visuals.ValidatorType.Min },
                              maxValue: { value: 10, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "referenceLines";
    displayName: string = "Reference lines";
    slices: Slice[] = [this.showMean, this.showMedian, this.showSd, this.sdCount, this.color, this.strokeWidth];
}

// ── X Axis ────────────────────────────────────────────────────────────────────
class XAxisCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayName: undefined, value: true
    });
    topLevelSlice = this.show;

    customRange = new formattingSettings.ToggleSwitch({
        name: "customRange", displayName: "Custom range", value: false
    });

    min = new formattingSettings.NumUpDown({
        name: "min", displayName: "Minimum", value: 0
    });

    max = new formattingSettings.NumUpDown({
        name: "max", displayName: "Maximum", value: 100
    });

    title = new formattingSettings.TextInput({
        name: "title", displayName: "Title", value: "", placeholder: "Values"
    });

    numberFormat = new formattingSettings.TextInput({
        name: "numberFormat", displayName: "Number format", value: "", placeholder: ".2f"
    });

    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor", displayName: "Label color",
        value: { value: "#666666" }
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayName: "Font size",
        value: 11, options: { minValue: { value: 8,  type: powerbi.visuals.ValidatorType.Min },
                               maxValue: { value: 24, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "xAxis";
    displayName: string = "X axis";
    slices: Slice[] = [this.customRange, this.min, this.max, this.title, this.numberFormat, this.labelColor, this.fontSize];
}

// ── Y Axis ────────────────────────────────────────────────────────────────────
class YAxisCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayName: undefined, value: true
    });
    topLevelSlice = this.show;

    title = new formattingSettings.TextInput({
        name: "title", displayName: "Title", value: "Count", placeholder: "Count"
    });

    numberFormat = new formattingSettings.TextInput({
        name: "numberFormat", displayName: "Number format", value: ",.0f", placeholder: ",.0f"
    });

    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor", displayName: "Label color",
        value: { value: "#666666" }
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayName: "Font size",
        value: 11, options: { minValue: { value: 8,  type: powerbi.visuals.ValidatorType.Min },
                               maxValue: { value: 24, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "yAxis";
    displayName: string = "Y axis";
    slices: Slice[] = [this.title, this.numberFormat, this.labelColor, this.fontSize];
}

// ── Model ─────────────────────────────────────────────────────────────────────
export class VisualFormattingSettingsModel extends Model {
    bins        = new BinsCard();
    bars        = new BarsCard();
    normalCurve = new NormalCurveCard();
    specLimits  = new SpecLimitsCard();
    referenceLines = new ReferenceLinesCard();
    xAxis       = new XAxisCard();
    yAxis       = new YAxisCard();

    cards: Card[] = [this.bins, this.bars, this.normalCurve, this.specLimits, this.referenceLines, this.xAxis, this.yAxis];
}
