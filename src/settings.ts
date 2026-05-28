"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import Card  = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;
import Model = formattingSettings.Model;

// ── Bins ──────────────────────────────────────────────────────────────────────
class BinsCard extends Card {
    mode = new formattingSettings.ItemDropdown({
        name: "mode",
        displayName: "Bin mode", displayNameKey: "Bins_Mode_DisplayName",
        description: "Choose between automatic, fixed number of bins, or fixed bin width.", descriptionKey: "Bins_Mode_Description",
        value: { value: "auto", displayName: "Auto (Sturges)" },
        items: [
            { value: "auto",  displayName: "Auto (Sturges)" },
            { value: "count", displayName: "Number of bins" },
            { value: "width", displayName: "Bin width" }
        ]
    });

    count = new formattingSettings.NumUpDown({
        name: "count",
        displayName: "Number of bins", displayNameKey: "Bins_Count_DisplayName",
        description: "Used when Bin mode is set to Number of bins.", descriptionKey: "Bins_Count_Description",
        value: 10, options: { minValue: { value: 1, type: powerbi.visuals.ValidatorType.Min },
                               maxValue: { value: 200, type: powerbi.visuals.ValidatorType.Max } }
    });

    width = new formattingSettings.NumUpDown({
        name: "width",
        displayName: "Bin width", displayNameKey: "Bins_Width_DisplayName",
        description: "Used when Bin mode is set to Bin width.", descriptionKey: "Bins_Width_Description",
        value: 5, options: { minValue: { value: 0.001, type: powerbi.visuals.ValidatorType.Min } }
    });

    name: string = "bins";
    displayName: string = "Bins";
    displayNameKey: string = "Bins_DisplayName";
    description: string = "Controls how the data is grouped into bars.";
    descriptionKey: string = "Bins_Description";
    slices: Slice[] = [this.mode, this.count, this.width];
}

// ── Bars ──────────────────────────────────────────────────────────────────────
class BarsCard extends Card {
    fill = new formattingSettings.ColorPicker({
        name: "fill",
        displayName: "Bar color", displayNameKey: "Bars_Fill_DisplayName",
        description: "Main fill color of the bars.", descriptionKey: "Bars_Fill_Description",
        value: { value: "#01B8AA" }
    });

    fillOpacity = new formattingSettings.NumUpDown({
        name: "fillOpacity",
        displayName: "Opacity (%)", displayNameKey: "Bars_FillOpacity_DisplayName",
        description: "Bar fill opacity in percent.", descriptionKey: "Bars_FillOpacity_Description",
        value: 80, options: { minValue: { value: 0,   type: powerbi.visuals.ValidatorType.Min },
                               maxValue: { value: 100, type: powerbi.visuals.ValidatorType.Max } }
    });

    stroke = new formattingSettings.ColorPicker({
        name: "stroke",
        displayName: "Border color", displayNameKey: "Bars_Stroke_DisplayName",
        description: "Color of the thin border between bars.", descriptionKey: "Bars_Stroke_Description",
        value: { value: "#ffffff" }
    });

    gap = new formattingSettings.NumUpDown({
        name: "gap",
        displayName: "Gap (%)", displayNameKey: "Bars_Gap_DisplayName",
        description: "Gap between adjacent bars.", descriptionKey: "Bars_Gap_Description",
        value: 8, options: { minValue: { value: 0, type: powerbi.visuals.ValidatorType.Min },
                              maxValue: { value: 80, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "bars";
    displayName: string = "Bars";
    displayNameKey: string = "Bars_DisplayName";
    description: string = "Bar color, opacity, border, and gap.";
    descriptionKey: string = "Bars_Description";
    slices: Slice[] = [this.fill, this.fillOpacity, this.stroke, this.gap];
}

// ── Normal curve ──────────────────────────────────────────────────────────────
class NormalCurveCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayName: undefined, value: false
    });
    topLevelSlice = this.show;

    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Curve color", displayNameKey: "NormalCurve_Color_DisplayName",
        description: "Color of the normal-curve overlay.", descriptionKey: "NormalCurve_Color_Description",
        value: { value: "#e8392a" }
    });

    strokeWidth = new formattingSettings.NumUpDown({
        name: "strokeWidth",
        displayName: "Stroke width", displayNameKey: "NormalCurve_StrokeWidth_DisplayName",
        description: "Thickness of the normal-curve line.", descriptionKey: "NormalCurve_StrokeWidth_Description",
        value: 2, options: { minValue: { value: 1, type: powerbi.visuals.ValidatorType.Min },
                              maxValue: { value: 10, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "normalCurve";
    displayName: string = "Normal curve";
    displayNameKey: string = "NormalCurve_DisplayName";
    description: string = "Optional Gaussian curve overlay.";
    descriptionKey: string = "NormalCurve_Description";
    slices: Slice[] = [this.color, this.strokeWidth];
}

// ── Spec limits ───────────────────────────────────────────────────────────────
class SpecLimitsCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayName: undefined, value: false
    });
    topLevelSlice = this.show;

    lsl = new formattingSettings.NumUpDown({
        name: "lsl",
        displayName: "LSL (lower spec limit)", displayNameKey: "SpecLimits_LSL_DisplayName",
        description: "Lower specification limit.", descriptionKey: "SpecLimits_LSL_Description",
        value: 0
    });

    usl = new formattingSettings.NumUpDown({
        name: "usl",
        displayName: "USL (upper spec limit)", displayNameKey: "SpecLimits_USL_DisplayName",
        description: "Upper specification limit.", descriptionKey: "SpecLimits_USL_Description",
        value: 100
    });

    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Line color", displayNameKey: "SpecLimits_Color_DisplayName",
        description: "Color of LSL/USL/Target and capability lines.", descriptionKey: "SpecLimits_Color_Description",
        value: { value: "#d64550" }
    });

    showLabels = new formattingSettings.ToggleSwitch({
        name: "showLabels",
        displayName: "Show labels", displayNameKey: "SpecLimits_ShowLabels_DisplayName",
        description: "Display LSL/USL/Target labels.", descriptionKey: "SpecLimits_ShowLabels_Description",
        value: true
    });

    showTarget = new formattingSettings.ToggleSwitch({
        name: "showTarget",
        displayName: "Show target", displayNameKey: "SpecLimits_ShowTarget_DisplayName",
        description: "Draw a target line.", descriptionKey: "SpecLimits_ShowTarget_Description",
        value: false
    });

    target = new formattingSettings.NumUpDown({
        name: "target",
        displayName: "Target", displayNameKey: "SpecLimits_Target_DisplayName",
        description: "Target value.", descriptionKey: "SpecLimits_Target_Description",
        value: 50
    });

    showCpk = new formattingSettings.ToggleSwitch({
        name: "showCpk",
        displayName: "Show Cp / Cpk", displayNameKey: "SpecLimits_ShowCpk_DisplayName",
        description: "Show the process capability readout (Cp and Cpk).", descriptionKey: "SpecLimits_ShowCpk_Description",
        value: true
    });

    showSigma = new formattingSettings.ToggleSwitch({
        name: "showSigma",
        displayName: "Show sigma level + DPMO", displayNameKey: "SpecLimits_ShowSigma_DisplayName",
        description: "Show the process sigma level and DPMO.", descriptionKey: "SpecLimits_ShowSigma_Description",
        value: false
    });

    showAD = new formattingSettings.ToggleSwitch({
        name: "showAD",
        displayName: "Show Anderson-Darling p-value", displayNameKey: "SpecLimits_ShowAD_DisplayName",
        description: "Run Anderson-Darling normality test and show p-value.", descriptionKey: "SpecLimits_ShowAD_Description",
        value: false
    });

    decimals = new formattingSettings.NumUpDown({
        name: "decimals",
        displayName: "Decimals", displayNameKey: "SpecLimits_Decimals_DisplayName",
        description: "Decimal places for the Cp/Cpk readout.", descriptionKey: "SpecLimits_Decimals_Description",
        value: 2, options: { minValue: { value: 0, type: powerbi.visuals.ValidatorType.Min },
                              maxValue: { value: 6, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "specLimits";
    displayName: string = "Spec limits";
    displayNameKey: string = "SpecLimits_DisplayName";
    description: string = "LSL/USL, target, Cp/Cpk capability.";
    descriptionKey: string = "SpecLimits_Description";
    slices: Slice[] = [this.lsl, this.usl, this.color, this.showLabels, this.showTarget, this.target, this.showCpk, this.showSigma, this.showAD, this.decimals];
}

// ── Reference lines ──────────────────────────────────────────────────────────
class ReferenceLinesCard extends Card {
    showMean = new formattingSettings.ToggleSwitch({
        name: "showMean",
        displayName: "Mean", displayNameKey: "ReferenceLines_ShowMean_DisplayName",
        description: "Draw a vertical line at the mean.", descriptionKey: "ReferenceLines_ShowMean_Description",
        value: false
    });

    showMedian = new formattingSettings.ToggleSwitch({
        name: "showMedian",
        displayName: "Median", displayNameKey: "ReferenceLines_ShowMedian_DisplayName",
        description: "Draw a vertical line at the median.", descriptionKey: "ReferenceLines_ShowMedian_Description",
        value: false
    });

    showSd = new formattingSettings.ToggleSwitch({
        name: "showSd",
        displayName: "Mean ±1 SD", displayNameKey: "ReferenceLines_ShowSd_DisplayName",
        description: "Draw vertical lines at ±N standard deviations.", descriptionKey: "ReferenceLines_ShowSd_Description",
        value: false
    });

    sdCount = new formattingSettings.NumUpDown({
        name: "sdCount",
        displayName: "SD bands", displayNameKey: "ReferenceLines_SdCount_DisplayName",
        description: "Number of SD bands per side (1-3).", descriptionKey: "ReferenceLines_SdCount_Description",
        value: 1, options: { minValue: { value: 1, type: powerbi.visuals.ValidatorType.Min },
                              maxValue: { value: 3, type: powerbi.visuals.ValidatorType.Max } }
    });

    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Line color", displayNameKey: "ReferenceLines_Color_DisplayName",
        description: "Color of reference lines.", descriptionKey: "ReferenceLines_Color_Description",
        value: { value: "#5b5fc7" }
    });

    strokeWidth = new formattingSettings.NumUpDown({
        name: "strokeWidth",
        displayName: "Stroke width", displayNameKey: "ReferenceLines_StrokeWidth_DisplayName",
        description: "Thickness of reference lines.", descriptionKey: "ReferenceLines_StrokeWidth_Description",
        value: 1, options: { minValue: { value: 1, type: powerbi.visuals.ValidatorType.Min },
                              maxValue: { value: 10, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "referenceLines";
    displayName: string = "Reference lines";
    displayNameKey: string = "ReferenceLines_DisplayName";
    description: string = "Statistical reference lines.";
    descriptionKey: string = "ReferenceLines_Description";
    slices: Slice[] = [this.showMean, this.showMedian, this.showSd, this.sdCount, this.color, this.strokeWidth];
}

// ── X Axis ────────────────────────────────────────────────────────────────────
class XAxisCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayName: undefined, value: true
    });
    topLevelSlice = this.show;

    customRange = new formattingSettings.ToggleSwitch({
        name: "customRange",
        displayName: "Custom range", displayNameKey: "XAxis_CustomRange_DisplayName",
        description: "Override automatic min/max.", descriptionKey: "XAxis_CustomRange_Description",
        value: false
    });

    min = new formattingSettings.NumUpDown({
        name: "min",
        displayName: "Minimum", displayNameKey: "XAxis_Min_DisplayName",
        description: "Minimum x value when Custom range is on.", descriptionKey: "XAxis_Min_Description",
        value: 0
    });

    max = new formattingSettings.NumUpDown({
        name: "max",
        displayName: "Maximum", displayNameKey: "XAxis_Max_DisplayName",
        description: "Maximum x value when Custom range is on.", descriptionKey: "XAxis_Max_Description",
        value: 100
    });

    title = new formattingSettings.TextInput({
        name: "title",
        displayName: "Title", displayNameKey: "XAxis_Title_DisplayName",
        description: "Axis title text.", descriptionKey: "XAxis_Title_Description",
        value: "", placeholder: "Values"
    });

    numberFormat = new formattingSettings.TextInput({
        name: "numberFormat",
        displayName: "Number format", displayNameKey: "XAxis_NumberFormat_DisplayName",
        description: "d3-format string for tick labels.", descriptionKey: "XAxis_NumberFormat_Description",
        value: "", placeholder: ".2f"
    });

    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor",
        displayName: "Label color", displayNameKey: "XAxis_LabelColor_DisplayName",
        description: "Color of tick labels.", descriptionKey: "XAxis_LabelColor_Description",
        value: { value: "#666666" }
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font size", displayNameKey: "XAxis_FontSize_DisplayName",
        description: "Tick label font size in pixels.", descriptionKey: "XAxis_FontSize_Description",
        value: 11, options: { minValue: { value: 8,  type: powerbi.visuals.ValidatorType.Min },
                               maxValue: { value: 24, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "xAxis";
    displayName: string = "X axis";
    displayNameKey: string = "XAxis_DisplayName";
    description: string = "Horizontal value axis.";
    descriptionKey: string = "XAxis_Description";
    slices: Slice[] = [this.customRange, this.min, this.max, this.title, this.numberFormat, this.labelColor, this.fontSize];
}

// ── Y Axis ────────────────────────────────────────────────────────────────────
class YAxisCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayName: undefined, value: true
    });
    topLevelSlice = this.show;

    title = new formattingSettings.TextInput({
        name: "title",
        displayName: "Title", displayNameKey: "YAxis_Title_DisplayName",
        description: "Axis title text.", descriptionKey: "YAxis_Title_Description",
        value: "Count", placeholder: "Count"
    });

    numberFormat = new formattingSettings.TextInput({
        name: "numberFormat",
        displayName: "Number format", displayNameKey: "YAxis_NumberFormat_DisplayName",
        description: "d3-format string for tick labels.", descriptionKey: "YAxis_NumberFormat_Description",
        value: ",.0f", placeholder: ",.0f"
    });

    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor",
        displayName: "Label color", displayNameKey: "YAxis_LabelColor_DisplayName",
        description: "Color of tick labels.", descriptionKey: "YAxis_LabelColor_Description",
        value: { value: "#666666" }
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font size", displayNameKey: "YAxis_FontSize_DisplayName",
        description: "Tick label font size in pixels.", descriptionKey: "YAxis_FontSize_Description",
        value: 11, options: { minValue: { value: 8,  type: powerbi.visuals.ValidatorType.Min },
                               maxValue: { value: 24, type: powerbi.visuals.ValidatorType.Max } }
    });

    name: string = "yAxis";
    displayName: string = "Y axis";
    displayNameKey: string = "YAxis_DisplayName";
    description: string = "Vertical count axis.";
    descriptionKey: string = "YAxis_Description";
    slices: Slice[] = [this.title, this.numberFormat, this.labelColor, this.fontSize];
}

// ── Q-Q plot ──────────────────────────────────────────────────────────────────
class QQPlotCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayName: undefined, value: false
    });
    topLevelSlice = this.show;

    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Point color", displayNameKey: "QQPlot_Color_DisplayName",
        description: "Color of Q-Q points and reference line.", descriptionKey: "QQPlot_Color_Description",
        value: { value: "#5b5fc7" }
    });

    name: string = "qqPlot";
    displayName: string = "Q-Q plot";
    displayNameKey: string = "QQPlot_DisplayName";
    description: string = "Quantile-quantile plot overlay.";
    descriptionKey: string = "QQPlot_Description";
    slices: Slice[] = [this.color];
}

// ── Box plot ──────────────────────────────────────────────────────────────────
class BoxPlotCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayName: undefined, value: false
    });
    topLevelSlice = this.show;

    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Box color", displayNameKey: "BoxPlot_Color_DisplayName",
        description: "Box fill color.", descriptionKey: "BoxPlot_Color_Description",
        value: { value: "#01B8AA" }
    });

    name: string = "boxPlot";
    displayName: string = "Box plot";
    displayNameKey: string = "BoxPlot_DisplayName";
    description: string = "Box-and-whisker strip below the histogram.";
    descriptionKey: string = "BoxPlot_Description";
    slices: Slice[] = [this.color];
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
class TooltipCard extends Card {
    miniChart = new formattingSettings.ToggleSwitch({
        name: "miniChart",
        displayName: "Mini chart in tooltip", displayNameKey: "Tooltip_MiniChart_DisplayName",
        description: "Show a small histogram sketch in report-page tooltips.", descriptionKey: "Tooltip_MiniChart_Description",
        value: false
    });

    name: string = "tooltip";
    displayName: string = "Tooltip";
    slices: Slice[] = [this.miniChart];
}

// ── Tour (persisted-state only, not user-facing in format pane) ───────────────
class TourCard extends Card {
    dismissed = new formattingSettings.ToggleSwitch({
        name: "dismissed", displayName: undefined, value: false
    });
    topLevelSlice = this.dismissed;

    name: string = "tour";
    displayName: string = "Tour";
    visible: boolean = false;
    slices: Slice[] = [];
}

// ── Model ─────────────────────────────────────────────────────────────────────
export class VisualFormattingSettingsModel extends Model {
    bins        = new BinsCard();
    bars        = new BarsCard();
    normalCurve = new NormalCurveCard();
    specLimits  = new SpecLimitsCard();
    referenceLines = new ReferenceLinesCard();
    qqPlot      = new QQPlotCard();
    boxPlot     = new BoxPlotCard();
    tooltip     = new TooltipCard();
    tour        = new TourCard();
    xAxis       = new XAxisCard();
    yAxis       = new YAxisCard();

    cards: Card[] = [this.bins, this.bars, this.normalCurve, this.specLimits, this.referenceLines, this.qqPlot, this.boxPlot, this.tooltip, this.xAxis, this.yAxis, this.tour];
}
