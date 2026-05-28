/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { ITooltipServiceWrapper, createTooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import * as d3 from "d3";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel } from "./settings";

interface Bin {
    x0: number;
    x1: number;
    count: number;
    highlightCount: number;
    underflowCount: number;
    overflowCount: number;
    selectionIds: ISelectionId[];
}

interface HistogramStats {
    mean: number;
    median: number;
    sd: number;
}

interface LineLabel {
    x: number;
    text: string;
    color: string;
    outline: string;
    y: number;
    anchor: "start" | "middle" | "end";
}

interface HistogramData {
    values: number[];      // distinct (or raw) numeric values
    weights: number[];     // frequency per value (1 when no Frequency measure)
    highlightWeights: number[];
    selectionIds: ISelectionId[];
    total: number;         // sum of weights = total observations
    highlightTotal: number;
    hasFrequency: boolean; // whether a Frequency measure was supplied
    hasHighlights: boolean;
    hasCategory: boolean;  // whether the Values role is populated
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private localization: ILocalizationManager;
    private locale: string;
    private target: HTMLElement;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private allowInteractions: boolean;
    private lastData: HistogramData | null = null;
    private currentViewMode: powerbi.ViewMode = 0; // ViewMode.View
    private hasRenderedOnce: boolean = false;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = options.host.createSelectionManager();
        this.tooltipServiceWrapper = createTooltipServiceWrapper(options.host.tooltipService, options.element);
        this.localization = options.host.createLocalizationManager();
        this.formattingSettingsService = new FormattingSettingsService(this.localization);
        this.allowInteractions = options.host.hostCapabilities?.allowInteractions !== false;
        this.locale = options.host.locale || "en-US";
        this.target = options.element;

        this.svg = d3.select(this.target)
            .append("svg")
            .classed("histogram-plus", true)
            .attr("role", "img")
            .attr("tabindex", "0")
            .attr("aria-label", this.t("Visual_Aria"));

        this.svg.on("contextmenu", (event: MouseEvent) => {
            this.selectionManager.showContextMenu({}, { x: event.clientX, y: event.clientY });
            event.preventDefault();
        });

    }

    private t(key: string, ...params: (string | number)[]): string {
        let value = this.localization.getDisplayName(key) || key;
        params.forEach((p, i) => {
            value = value.replace(`{${i}}`, String(p));
        });
        return value;
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);

        const width = options.viewport?.width ?? 0;
        const height = options.viewport?.height ?? 0;
        this.locale = this.host.locale || this.locale;
        this.currentViewMode = options.viewMode ?? 0;

        const dataView = options.dataViews?.[0];

        // Always populate settings (format pane needs it), tolerating no data view.
        try {
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                dataView ?? ({ metadata: { columns: [] } } as DataView)
            );
        } catch { /* keep previous settings */ }

        const data = this.extractData(dataView);
        this.lastData = data;

        // Keep the SVG as the single, always-interactive surface (mirrors the
        // data state, which Power BI lets the user select/drag/delete normally).
        this.svg.attr("width", width).attr("height", height);
        this.svg.selectAll("*").remove();

        // No fields assigned: show the custom onboarding surface. Power BI
        // Desktop's different empty-surface interaction behavior is accepted
        // as normal for custom visuals in this project.
        if (!data.hasCategory) {
            this.renderLandingPage(width, height);
            this.events.renderingFinished(options);
            this.hasRenderedOnce = true;
            return;
        }

        try {
            if (data.values.length === 0) {
                this.renderEmptyMessage(width, height, this.t("Visual_Empty_NoNumeric"));
                this.events.renderingFinished(options);
            this.hasRenderedOnce = true;
                return;
            }
            if (dataView?.metadata?.segment) {
                this.host.fetchMoreData(true);
            }
            const bins = this.computeBins(data);
            this.renderHistogram(bins, data, dataView, width, height);
            this.events.renderingFinished(options);
            this.hasRenderedOnce = true;
        }
        catch (error) {
            this.svg.selectAll("*").remove();
            this.events.renderingFailed(options, String(error));
        }
    }

    private extractData(dataView: DataView | undefined): HistogramData {
        const category = dataView?.categorical?.categories?.[0];
        if (!category?.values) {
            return { values: [], weights: [], highlightWeights: [], selectionIds: [], total: 0, highlightTotal: 0, hasFrequency: false, hasHighlights: false, hasCategory: false };
        }
        // Power BI groups the category to distinct values; the optional Frequency
        // measure carries the count per value so repeated data bins correctly.
        const freqColumn = dataView?.categorical?.values?.[0];
        const values: number[] = [];
        const weights: number[] = [];
        const highlightWeights: number[] = [];
        const selectionIds: ISelectionId[] = [];
        let hasHighlights = false;
        for (let i = 0; i < category.values.length; i++) {
            const raw = category.values[i];
            const n = typeof raw === "number" ? raw : Number(raw);
            if (raw === null || raw === undefined || !Number.isFinite(n)) {
                continue;
            }
            let w = 1;
            if (freqColumn) {
                const f = Number(freqColumn.values[i]);
                w = Number.isFinite(f) && f > 0 ? f : 0;
            }
            if (w > 0) {
                let hw = w;
                if (freqColumn?.highlights) {
                    const h = Number(freqColumn.highlights[i]);
                    hw = Number.isFinite(h) && h > 0 ? Math.min(h, w) : 0;
                    hasHighlights = hasHighlights || hw < w;
                }
                values.push(n);
                weights.push(w);
                highlightWeights.push(hw);
                selectionIds.push(this.host.createSelectionIdBuilder()
                    .withCategory(category, i)
                    .createSelectionId());
            }
        }
        const total = weights.reduce((a, b) => a + b, 0);
        const highlightTotal = highlightWeights.reduce((a, b) => a + b, 0);
        return { values, weights, highlightWeights, selectionIds, total, highlightTotal, hasFrequency: !!freqColumn, hasHighlights, hasCategory: true };
    }

    private computeBins(data: HistogramData): Bin[] {
        const { values, weights, highlightWeights, selectionIds } = data;
        const range = this.getXAxisRange(data);
        const min = range.min;
        const max = range.max;
        const customRange = this.hasCustomXAxisRange();
        if (values.length === 0 || data.total <= 0) {
            return [{ x0: min, x1: max, count: 0, highlightCount: 0, underflowCount: 0, overflowCount: 0, selectionIds: [] }];
        }

        // All values equal → single centered bin with a display width so it renders
        if (min === max) {
            const halfWidth = min !== 0 ? Math.abs(min) * 0.05 : 0.5;
            const highlightCount = highlightWeights.reduce((a, b) => a + b, 0);
            return [{ x0: min - halfWidth, x1: min + halfWidth, count: data.total, highlightCount, underflowCount: 0, overflowCount: 0, selectionIds }];
        }

        const binsCard = this.formattingSettings.bins;
        const mode = binsCard.mode.value.value as string;

        let edges: number[];
        if (mode === "count") {
            const n = Math.max(1, Math.round(binsCard.count.value));
            const step = (max - min) / n;
            edges = d3.range(0, n + 1).map(i => min + i * step);
        } else if (mode === "width") {
            const w = binsCard.width.value > 0 ? binsCard.width.value : (max - min);
            const nBins = Math.ceil((max - min) / w);
            edges = d3.range(0, nBins + 1).map(i => min + i * w);
            if (customRange) {
                edges = edges.filter(edge => edge < max);
                edges.push(max);
            }
        } else {
            // auto — adaptive: Sturges for small N, Freedman-Diaconis for large/skewed N, and
            // an integer-friendly path when all values are integers within a small range.
            const allInteger = values.every(v => Number.isInteger(v));
            const range = max - min;
            const sturges = Math.max(1, Math.ceil(Math.log2(data.total)) + 1);
            let target = sturges;
            if (allInteger && range <= 60) {
                target = Math.min(range + 1, 30);
            } else if (data.total >= 200) {
                const iqr = this.iqr(values, weights, data.total);
                if (iqr > 0) {
                    const fd = (2 * iqr) / Math.cbrt(data.total);
                    const fdCount = Math.max(1, Math.ceil(range / fd));
                    target = Math.min(60, Math.max(sturges, fdCount));
                }
            }
            if (customRange) {
                const step = (max - min) / target;
                edges = d3.range(0, target + 1).map(i => min + i * step);
            } else {
                const niceScale = d3.scaleLinear().domain([min, max]).nice(target);
                edges = niceScale.ticks(target);
                if (edges.length < 2 || edges[0] > min) edges.unshift(niceScale.domain()[0]);
                if (edges[edges.length - 1] < max) edges.push(niceScale.domain()[1]);
            }
        }

        // Manual weighted binning: [x0, x1) left-inclusive, last bin closed on the right
        const counts = new Array(edges.length - 1).fill(0);
        const highlightCounts = new Array(edges.length - 1).fill(0);
        const underflowCounts = new Array(edges.length - 1).fill(0);
        const overflowCounts = new Array(edges.length - 1).fill(0);
        const binSelectionIds: ISelectionId[][] = edges.slice(0, -1).map(() => []);
        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            if (customRange && value < min) {
                underflowCounts[0] += weights[i];
                continue;
            }
            if (customRange && value > max) {
                overflowCounts[overflowCounts.length - 1] += weights[i];
                continue;
            }
            let idx = d3.bisectRight(edges, value) - 1;
            if (idx < 0) idx = 0;
            if (idx >= counts.length) idx = counts.length - 1;
            counts[idx] += weights[i];
            highlightCounts[idx] += highlightWeights[i];
            binSelectionIds[idx].push(selectionIds[i]);
        }
        return counts.map((count, i) => ({
            x0: edges[i],
            x1: edges[i + 1],
            count,
            highlightCount: highlightCounts[i],
            underflowCount: underflowCounts[i],
            overflowCount: overflowCounts[i],
            selectionIds: binSelectionIds[i].filter(Boolean)
        }));
    }

    private getXAxisRange(data: HistogramData): { min: number; max: number } {
        let min = d3.min(data.values)!;
        let max = d3.max(data.values)!;
        const xAxis = this.formattingSettings.xAxis;

        if (xAxis.customRange.value) {
            const customMin = Number(xAxis.min.value);
            const customMax = Number(xAxis.max.value);
            if (Number.isFinite(customMin) && Number.isFinite(customMax) && customMin < customMax) {
                min = customMin;
                max = customMax;
            }
        }

        return { min, max };
    }

    private hasCustomXAxisRange(): boolean {
        const xAxis = this.formattingSettings.xAxis;
        const customMin = Number(xAxis.min.value);
        const customMax = Number(xAxis.max.value);
        return xAxis.customRange.value
            && Number.isFinite(customMin)
            && Number.isFinite(customMax)
            && customMin < customMax;
    }

    private renderHistogram(bins: Bin[], data: HistogramData, dataView: DataView | undefined, width: number, height: number): void {
        const colors = this.getHighContrastColors();
        const isHC = this.host.colorPalette.isHighContrast;
        const bars = this.formattingSettings.bars;
        const xAxisCard = this.formattingSettings.xAxis;
        const yAxisCard = this.formattingSettings.yAxis;
        // Mobile / focus-mode breakpoints: shrink margins and drop axis titles when there's no room.
        const compact = width < 300 || height < 200;
        const xTitle = compact ? "" : xAxisCard.title.value.trim();
        const yTitle = compact ? "" : yAxisCard.title.value.trim();
        const boxPlotCard = this.formattingSettings.boxPlot;
        const qqPlotCard = this.formattingSettings.qqPlot;
        const boxPlotHeight = boxPlotCard.show.value ? (compact ? 14 : 22) : 0;
        const margin = {
            top: compact ? 6 : 14,
            right: compact ? 6 : 16,
            bottom: (xAxisCard.show.value && xTitle ? 54 : 36) + boxPlotHeight,
            left: compact ? (yAxisCard.show.value && yTitle ? 40 : 28) : (yAxisCard.show.value && yTitle ? 60 : 44)
        };
        const innerW = Math.max(0, width - margin.left - margin.right);
        const innerH = Math.max(0, height - margin.top - margin.bottom);

        const stats = this.computeStats(data);
        const showCurve = this.formattingSettings.normalCurve.show.value && stats.sd > 0;

        const x0 = bins[0].x0;
        const x1 = bins[bins.length - 1].x1;
        const xScale = d3.scaleLinear().domain([x0, x1]).range([0, innerW]);

        const binCountMax = d3.max(bins, b => b.count) || 0;
        // Extend y-domain to fit the normal-curve peak so it isn't clipped
        const binWidth = bins[0].x1 - bins[0].x0;
        const curvePeak = showCurve
            ? (1 / (stats.sd * Math.sqrt(2 * Math.PI))) * data.total * binWidth
            : 0;
        const yMax = Math.max(binCountMax, curvePeak);
        const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

        const g = this.svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        if (binCountMax === 0) {
            this.drawMessage(g, innerW, innerH, this.t("Visual_Empty_NoValuesInRange"), isHC ? colors.foreground : "#666666");
            return;
        }

        // Bars
        const barFill = isHC ? colors.background : bars.fill.value.value;
        const barStroke = isHC ? colors.foreground : bars.stroke.value.value;
        const barOpacity = isHC ? 1 : bars.fillOpacity.value / 100;
        const barStrokeWidth = isHC ? 2 : 1;
        const gapRatio = Math.max(0, Math.min(80, bars.gap.value)) / 100;
        const hasHighlights = data.hasHighlights && bins.some(bin => bin.highlightCount < bin.count);
        const barGeometry = (d: Bin) => {
            const rawWidth = Math.max(0, xScale(d.x1) - xScale(d.x0));
            const gap = Math.min(rawWidth * gapRatio, Math.max(0, rawWidth - 1));
            return {
                x: xScale(d.x0) + gap / 2,
                width: Math.max(0, rawWidth - gap)
            };
        };

        const animate = this.animationsEnabled();
        const barSelection = g.selectAll("rect.bar")
            .data(bins)
            .enter()
            .append("rect")
            .classed("bar", true)
            .attr("x", d => barGeometry(d).x)
            .attr("y", animate ? innerH : d => yScale(d.count))
            .attr("width", d => barGeometry(d).width)
            .attr("height", animate ? 0 : d => innerH - yScale(d.count))
            .attr("data-count", d => d.count)
            .attr("data-highlight-count", d => d.highlightCount)
            .attr("fill", barFill)
            .attr("fill-opacity", hasHighlights ? Math.max(0.18, barOpacity * 0.3) : barOpacity)
            .attr("stroke", barStroke)
            .attr("stroke-width", barStrokeWidth)
            .attr("tabindex", (_d, i) => i === 0 ? "0" : "-1")
            .attr("role", "graphics-symbol")
            .attr("aria-label", d => this.t(
                "Visual_Bar_AriaLabel",
                this.formatNumber(d.x0, xAxisCard.numberFormat.value),
                this.formatNumber(d.x1, xAxisCard.numberFormat.value),
                this.formatNumber(d.count, yAxisCard.numberFormat.value)
            ))
            .on("click", (_event: MouseEvent, d: Bin) => {
                if (this.allowInteractions && d.selectionIds.length > 0) {
                    this.selectionManager.select(d.selectionIds, _event.ctrlKey || _event.metaKey || _event.shiftKey);
                }
            })
            .on("keydown", (event: KeyboardEvent, d: Bin) => {
                if (!this.allowInteractions) {
                    return;
                }
                if ((event.key === "Enter" || event.key === " ") && d.selectionIds.length > 0) {
                    this.selectionManager.select(d.selectionIds, event.ctrlKey || event.metaKey || event.shiftKey);
                    event.preventDefault();
                    return;
                }
                if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
                    this.handleArrowNav(event, bins);
                }
                if (event.key === "Escape") {
                    this.selectionManager.clear();
                    event.preventDefault();
                }
            })
            .on("contextmenu", (event: MouseEvent, d: Bin) => {
                const selectionId = d.selectionIds.length === 1 ? d.selectionIds[0] : {};
                this.selectionManager.showContextMenu(selectionId, { x: event.clientX, y: event.clientY });
                event.preventDefault();
                event.stopPropagation();
            })
            .on("mouseenter", (_event: MouseEvent, d: Bin) => {
                this.drawCrosshair(g, d, xScale, yScale, innerW, innerH, isHC ? colors.foreground : "#999999");
            })
            .on("mouseleave", () => {
                g.selectAll(".crosshair").remove();
            })
            .on("focus", (_event: FocusEvent, d: Bin) => {
                this.drawCrosshair(g, d, xScale, yScale, innerW, innerH, isHC ? colors.foreground : "#999999");
            })
            .on("blur", () => {
                g.selectAll(".crosshair").remove();
            });

        if (animate) {
            barSelection
                .transition()
                .duration(300)
                .ease(d3.easeCubicOut)
                .attr("y", d => yScale(d.count))
                .attr("height", d => innerH - yScale(d.count));
        }

        const tooltipCard = this.formattingSettings.tooltip;
        const includeMiniChart = tooltipCard.miniChart.value;
        const miniChartLine = () => {
            if (!includeMiniChart) return [];
            const counts = bins.map(b => b.count);
            const maxCount = Math.max(...counts, 1);
            const sketch = counts.map(c => c === 0 ? " " : "▁▂▃▄▅▆▇█".charAt(Math.min(7, Math.floor((c / maxCount) * 7))));
            return [{ displayName: " ", value: sketch.join("") }];
        };
        this.tooltipServiceWrapper.addTooltip<Bin>(
            barSelection,
            (bin: Bin) => [
                { displayName: this.t("Tooltip_Range"), value: `[${this.formatNumber(bin.x0, xAxisCard.numberFormat.value)}, ${this.formatNumber(bin.x1, xAxisCard.numberFormat.value)})` },
                { displayName: this.t("Tooltip_Count"), value: this.formatNumber(bin.count, yAxisCard.numberFormat.value) },
                ...(bin.underflowCount > 0 ? [{ displayName: this.t("Tooltip_Underflow"), value: this.formatNumber(bin.underflowCount, yAxisCard.numberFormat.value) }] : []),
                ...(bin.overflowCount > 0 ? [{ displayName: this.t("Tooltip_Overflow"), value: this.formatNumber(bin.overflowCount, yAxisCard.numberFormat.value) }] : []),
                ...(hasHighlights ? [{ displayName: this.t("Tooltip_Highlighted"), value: this.formatNumber(bin.highlightCount, yAxisCard.numberFormat.value) }] : []),
                ...miniChartLine(),
            ]
        );

        if (hasHighlights) {
            g.selectAll("rect.bar-highlight")
                .data(bins)
                .enter()
                .append("rect")
                .classed("bar-highlight", true)
                .attr("x", d => barGeometry(d).x)
                .attr("y", d => yScale(d.highlightCount))
                .attr("width", d => barGeometry(d).width)
                .attr("height", d => innerH - yScale(d.highlightCount))
                .attr("fill", barFill)
                .attr("fill-opacity", barOpacity)
                .attr("pointer-events", "none");
        }

        // X axis
        if (xAxisCard.show.value) {
            const xFormatter = this.createFormatter(xAxisCard.numberFormat.value);
            const xAxis = d3.axisBottom(xScale)
                .ticks(Math.min(bins.length, 10))
                .tickFormat(d => this.formatNumber(Number(d), xAxisCard.numberFormat.value, xFormatter));
            const xAxisG = g.append("g")
                .classed("x-axis", true)
                .attr("transform", `translate(0,${innerH})`)
                .call(xAxis);
            const xColor = isHC ? colors.foreground : xAxisCard.labelColor.value.value;
            const tickTexts = xAxisG.selectAll<SVGTextElement, unknown>("text")
                .attr("fill", xColor)
                .attr("font-size", `${xAxisCard.fontSize.value}px`);
            // Adaptive label rotation: when labels would overlap, rotate 45°.
            const tickNodes = tickTexts.nodes();
            if (tickNodes.length >= 2) {
                const maxLabelWidth = Math.max(...tickNodes.map(node => node.getComputedTextLength?.() ?? 0));
                const slotWidth = innerW / tickNodes.length;
                if (maxLabelWidth + 6 > slotWidth) {
                    tickTexts
                        .attr("text-anchor", "end")
                        .attr("transform", "rotate(-45)")
                        .attr("dx", "-0.4em")
                        .attr("dy", "0.4em");
                }
            }
            xAxisG.selectAll("path, line").attr("stroke", xColor);
            if (xTitle) {
                g.append("text")
                    .classed("axis-title x-axis-title", true)
                    .attr("x", innerW / 2)
                    .attr("y", innerH + 42)
                    .attr("text-anchor", "middle")
                    .attr("fill", xColor)
                    .attr("font-size", `${Math.max(10, xAxisCard.fontSize.value)}px`)
                    .text(xTitle);
            }
        }

        // Y axis
        if (yAxisCard.show.value) {
            const yFormatter = this.createFormatter(yAxisCard.numberFormat.value);
            const yAxis = d3.axisLeft(yScale)
                .ticks(Math.max(2, Math.min(Math.ceil(binCountMax), 8)))
                .tickFormat(d => this.formatNumber(Number(d), yAxisCard.numberFormat.value, yFormatter));
            const yAxisG = g.append("g").classed("y-axis", true).call(yAxis);
            const yColor = isHC ? colors.foreground : yAxisCard.labelColor.value.value;
            yAxisG.selectAll("text")
                .attr("fill", yColor)
                .attr("font-size", `${yAxisCard.fontSize.value}px`);
            yAxisG.selectAll("path, line").attr("stroke", yColor);
            if (yTitle) {
                g.append("text")
                    .classed("axis-title y-axis-title", true)
                    .attr("transform", "rotate(-90)")
                    .attr("x", -innerH / 2)
                    .attr("y", -44)
                    .attr("text-anchor", "middle")
                    .attr("fill", yColor)
                    .attr("font-size", `${Math.max(10, yAxisCard.fontSize.value)}px`)
                    .text(yTitle);
            }
        }

        // Help icon top-right (only when there's room and the host allows it).
        if (innerW > 120) {
            this.drawHelpIcon(g, innerW, isHC ? colors.foreground : "#5b5fc7");
        }

        // Normal curve overlay
        if (showCurve) {
            this.drawNormalCurve(g, stats, data.total, bins, xScale, yScale, innerH, isHC, colors.foreground);
        }

        const lineLabels: LineLabel[] = [];
        this.drawReferenceLines(g, stats, xScale, innerH, isHC, colors.foreground, lineLabels);

        // Spec limits + Cp/Cpk
        if (this.formattingSettings.specLimits.show.value) {
            this.drawSpecLimits(g, stats, dataView, xScale, innerW, innerH, isHC, colors.foreground, lineLabels);
        }

        if (lineLabels.length > 0) {
            this.drawLineLabels(g, lineLabels, innerW);
        }

        // Q-Q plot overlay
        if (qqPlotCard.show.value && stats.sd > 0 && data.total >= 4) {
            this.drawQQPlot(g, stats, data, xScale, innerH, isHC, colors.foreground, qqPlotCard.color.value.value);
        }

        // Box plot strip below the x-axis (and below the title if present)
        if (boxPlotCard.show.value && data.total >= 4) {
            const axisBaseline = (xAxisCard.show.value && xTitle) ? 52 : 32;
            this.drawBoxPlot(g, data, xScale, innerH + axisBaseline, boxPlotHeight, isHC, colors.foreground, boxPlotCard.color.value.value);
        }

        // First-time onboarding overlay (dismissable, persisted via formatting object)
        if (innerW > 240 && innerH > 160 && !this.formattingSettings.tour.dismissed.value && !this.hasRenderedOnce) {
            this.drawTour(g, innerW, innerH, isHC ? colors.foreground : "#5b5fc7");
        }

        // Smart hint: discrete integer data without a Frequency measure is likely
        // pre-grouped by Power BI (counts lost). Nudge the user toward Frequency = Count.
        const looksPreGrouped = !data.hasFrequency
            && data.values.length >= 2
            && data.values.length <= 30
            && data.values.every(v => Number.isInteger(v));
        if (looksPreGrouped) {
            g.append("text")
                .attr("x", 0)
                .attr("y", -2)
                .attr("fill", isHC ? colors.foreground : "#999999")
                .attr("font-size", "10px")
                .text(this.t("Visual_Hint_Frequency"));
        }
    }

    private computeStats(data: HistogramData): HistogramStats {
        const { values, weights, total } = data;
        if (total <= 0) {
            return { mean: 0, median: 0, sd: 0 };
        }
        let weightedSum = 0;
        for (let i = 0; i < values.length; i++) {
            weightedSum += values[i] * weights[i];
        }
        const mean = weightedSum / total;
        let sumSqDev = 0;
        for (let i = 0; i < values.length; i++) {
            sumSqDev += weights[i] * (values[i] - mean) ** 2;
        }
        const variance = total > 1 ? sumSqDev / (total - 1) : 0;
        return { mean, median: this.computeWeightedMedian(values, weights, total), sd: Math.sqrt(variance) };
    }

    private computeWeightedMedian(values: number[], weights: number[], total: number): number {
        const pairs = values
            .map((value, i) => ({ value, weight: weights[i] }))
            .sort((a, b) => a.value - b.value);

        const allIntegerWeights = weights.every(weight => Number.isInteger(weight));
        if (Number.isInteger(total) && allIntegerWeights) {
            const lowerIndex = Math.floor((total - 1) / 2);
            const upperIndex = Math.floor(total / 2);
            const valueAtExpandedIndex = (targetIndex: number): number => {
                let cumulative = 0;
                for (const pair of pairs) {
                    cumulative += pair.weight;
                    if (targetIndex < cumulative) {
                        return pair.value;
                    }
                }
                return pairs[pairs.length - 1]?.value ?? 0;
            };
            return (valueAtExpandedIndex(lowerIndex) + valueAtExpandedIndex(upperIndex)) / 2;
        }

        const midpoint = total / 2;
        let cumulative = 0;

        for (const pair of pairs) {
            cumulative += pair.weight;
            if (cumulative >= midpoint) {
                return pair.value;
            }
        }

        return pairs[pairs.length - 1]?.value ?? 0;
    }

    private drawNormalCurve(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        stats: HistogramStats,
        n: number,
        bins: Bin[],
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>,
        innerH: number,
        isHC: boolean,
        hcColor: string
    ): void {
        const card = this.formattingSettings.normalCurve;
        const binWidth = bins[0].x1 - bins[0].x0;
        const [d0, d1] = xScale.domain();
        const steps = 100;
        const pdf = (x: number) =>
            (1 / (stats.sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - stats.mean) / stats.sd) ** 2);

        const points: [number, number][] = d3.range(steps + 1).map(i => {
            const x = d0 + (d1 - d0) * (i / steps);
            const expectedCount = pdf(x) * n * binWidth;
            return [xScale(x), yScale(expectedCount)];
        });

        const line = d3.line<[number, number]>().x(p => p[0]).y(p => p[1]).curve(d3.curveMonotoneX);

        g.append("path")
            .classed("normal-curve", true)
            .datum(points)
            .attr("fill", "none")
            .attr("stroke", isHC ? hcColor : card.color.value.value)
            .attr("stroke-width", card.strokeWidth.value)
            .attr("d", line);
    }

    private drawReferenceLines(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        stats: HistogramStats,
        xScale: d3.ScaleLinear<number, number>,
        innerH: number,
        isHC: boolean,
        hcColor: string,
        labels: LineLabel[]
    ): void {
        const card = this.formattingSettings.referenceLines;
        const color = isHC ? hcColor : card.color.value.value;
        const width = isHC ? Math.max(2, card.strokeWidth.value) : card.strokeWidth.value;
        const [d0, d1] = xScale.domain();

        const drawLine = (value: number, label: string, dash = "2,3") => {
            if (!Number.isFinite(value) || value < d0 || value > d1) {
                return;
            }
            const x = xScale(value);
            g.append("line")
                .classed("reference-line", true)
                .attr("x1", x).attr("x2", x)
                .attr("y1", 0).attr("y2", innerH)
                .attr("stroke", color)
                .attr("stroke-width", width)
                .attr("stroke-dasharray", dash);
            labels.push({ x, text: label, color, outline: isHC ? this.getHighContrastColors().background : "#ffffff", y: 10, anchor: "middle" });
        };

        if (card.showMean.value) {
            drawLine(stats.mean, this.t("Reference_Mean"), "3,2");
        }
        if (card.showMedian.value) {
            drawLine(stats.median, this.t("Reference_Median"), "1,2");
        }
        if (card.showSd.value && stats.sd > 0) {
            const sdCount = Math.max(1, Math.min(3, Math.round(card.sdCount.value)));
            for (let i = 1; i <= sdCount; i++) {
                drawLine(stats.mean - stats.sd * i, this.t("Reference_SdMinus", i));
                drawLine(stats.mean + stats.sd * i, this.t("Reference_SdPlus", i));
            }
        }
    }

    private drawSpecLimits(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        stats: HistogramStats,
        dataView: DataView | undefined,
        xScale: d3.ScaleLinear<number, number>,
        innerW: number,
        innerH: number,
        isHC: boolean,
        hcColor: string,
        labels: LineLabel[]
    ): void {
        const card = this.formattingSettings.specLimits;
        const color = isHC ? hcColor : card.color.value.value;
        const [d0, d1] = xScale.domain();
        const hasLsl = this.hasFormatProperty(dataView, "specLimits", "lsl");
        const hasUsl = this.hasFormatProperty(dataView, "specLimits", "usl");
        const hasTarget = this.hasFormatProperty(dataView, "specLimits", "target");
        const decimals = Math.max(0, Math.min(6, Math.round(card.decimals.value)));

        const drawLine = (value: number, label: string, dashed = "4,3") => {
            if (value < d0 || value > d1) {
                return;
            }
            const x = xScale(value);
            g.append("line")
                .classed("spec-limit", true)
                .attr("x1", x).attr("x2", x)
                .attr("y1", 0).attr("y2", innerH)
                .attr("stroke", color)
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", dashed);
            if (card.showLabels.value) {
                labels.push({ x, text: label, color, outline: isHC ? this.getHighContrastColors().background : "#ffffff", y: 10, anchor: "middle" });
            }
        };

        if (hasLsl) {
            drawLine(card.lsl.value, this.t("Spec_LSL"));
        }
        if (hasUsl) {
            drawLine(card.usl.value, this.t("Spec_USL"));
        }
        if (card.showTarget.value && hasTarget) {
            drawLine(card.target.value, this.t("Spec_Target"), "2,2");
        }

        // Cp / Cpk readout + optional sigma level/DPMO + Anderson-Darling p-value
        if (card.showCpk.value && hasLsl && hasUsl && card.lsl.value < card.usl.value && stats.sd > 0) {
            const lsl = card.lsl.value;
            const usl = card.usl.value;
            const cp = (usl - lsl) / (6 * stats.sd);
            const cpu = (usl - stats.mean) / (3 * stats.sd);
            const cpl = (stats.mean - lsl) / (3 * stats.sd);
            const cpk = Math.min(cpu, cpl);

            const lines: string[] = [
                this.t("Capability_Label", cp.toFixed(decimals), cpk.toFixed(decimals))
            ];
            if (card.showSigma.value) {
                const sigmaLevel = 3 * cpk;
                const dpmo = this.cpkToDPMO(cpk);
                lines.push(this.t("Capability_SigmaLevel", sigmaLevel.toFixed(2)) +
                    "  " + this.t("Capability_DPMO", this.formatDPMO(dpmo)));
            }
            if (card.showAD.value) {
                const p = this.andersonDarlingP(this.formattingSettings, stats, dataView);
                if (Number.isFinite(p)) {
                    lines.push(this.t("Capability_AndersonDarling", p.toFixed(3)));
                }
            }

            const labelGroup = g.append("g").classed("capability-label-group", true);
            lines.forEach((text, i) => {
                labelGroup.append("text")
                    .classed(i === 0 ? "capability-label" : "capability-extra", true)
                    .attr("x", innerW - 4)
                    .attr("y", innerH - 6 - (lines.length - 1 - i) * 14)
                    .attr("text-anchor", "end")
                    .attr("fill", color)
                    .attr("font-size", i === 0 ? "12px" : "11px")
                    .attr("font-weight", i === 0 ? "bold" : "normal")
                    .text(text);
            });
        }
    }

    private cpkToDPMO(cpk: number): number {
        // P(defect) = 1 - P(LSL ≤ X ≤ USL). With one-sided Cpk and assuming normal:
        // defect probability ≈ 2 * (1 - Φ(3·Cpk)). Multiply by 1e6 to get DPMO.
        if (!Number.isFinite(cpk) || cpk <= 0) return 1_000_000;
        const z = 3 * cpk;
        const p = 1 - this.normalCdf(z);
        return Math.min(1_000_000, Math.max(0, 2 * p * 1_000_000));
    }

    private formatDPMO(dpmo: number): string {
        if (dpmo >= 1000) return this.formatNumber(Math.round(dpmo), ",d");
        return dpmo.toFixed(1);
    }

    private iqr(values: number[], weights: number[], total: number): number {
        const pairs = values.map((value, i) => ({ value, weight: weights[i] }))
            .sort((a, b) => a.value - b.value);
        const quantile = (q: number): number => {
            const target = total * q;
            let cumulative = 0;
            for (const pair of pairs) {
                cumulative += pair.weight;
                if (cumulative >= target) return pair.value;
            }
            return pairs[pairs.length - 1]?.value ?? 0;
        };
        return quantile(0.75) - quantile(0.25);
    }

    private normalCdf(z: number): number {
        // Abramowitz & Stegun 26.2.17 approximation, |error| < 7.5e-8
        const sign = z < 0 ? -1 : 1;
        const x = Math.abs(z) / Math.SQRT2;
        const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
        const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return 0.5 * (1.0 + sign * y);
    }

    private andersonDarlingP(
        _settings: VisualFormattingSettingsModel,
        stats: HistogramStats,
        _dataView: DataView | undefined
    ): number {
        // Anderson-Darling test on the expanded sample: weights are integer counts.
        const data = this.lastData;
        if (!data || data.total < 8 || stats.sd <= 0) return NaN;
        const sample: number[] = [];
        for (let i = 0; i < data.values.length; i++) {
            const w = Math.round(data.weights[i]);
            for (let k = 0; k < w; k++) sample.push(data.values[i]);
        }
        if (sample.length < 8) return NaN;
        sample.sort((a, b) => a - b);
        const n = sample.length;
        let sum = 0;
        for (let i = 0; i < n; i++) {
            const z = (sample[i] - stats.mean) / stats.sd;
            const Fi = this.normalCdf(z);
            const zR = (sample[n - 1 - i] - stats.mean) / stats.sd;
            const Frev = this.normalCdf(zR);
            const a = Math.max(1e-12, Fi);
            const b = Math.max(1e-12, 1 - Frev);
            sum += (2 * i + 1) * (Math.log(a) + Math.log(b));
        }
        const A2 = -n - sum / n;
        // adjust for sample mean+sd being estimated (D'Agostino 1986)
        const A2star = A2 * (1 + 0.75 / n + 2.25 / (n * n));
        // p-value approximation per Stephens (1986)
        let p: number;
        if (A2star < 0.2) p = 1 - Math.exp(-13.436 + 101.14 * A2star - 223.73 * A2star * A2star);
        else if (A2star < 0.34) p = 1 - Math.exp(-8.318 + 42.796 * A2star - 59.938 * A2star * A2star);
        else if (A2star < 0.6) p = Math.exp(0.9177 - 4.279 * A2star - 1.38 * A2star * A2star);
        else if (A2star < 13) p = Math.exp(1.2937 - 5.709 * A2star + 0.0186 * A2star * A2star);
        else p = 0;
        return Math.max(0, Math.min(1, p));
    }

    private drawLineLabels(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        labels: LineLabel[],
        innerW: number
    ): void {
        const rows: LineLabel[][] = [];
        const sorted = [...labels].sort((a, b) => a.x - b.x);
        const approximateWidth = (label: LineLabel) => label.text.length * 6 + 8;
        const bounds = (label: LineLabel) => {
            const width = approximateWidth(label);
            if (label.anchor === "middle") {
                return { start: label.x - width / 2, end: label.x + width / 2 };
            }
            if (label.anchor === "end") {
                return { start: label.x - width, end: label.x };
            }
            return { start: label.x, end: label.x + width };
        };

        for (const label of sorted) {
            let placed = false;
            for (const row of rows) {
                const previous = row[row.length - 1];
                if (bounds(label).start > bounds(previous).end + 4) {
                    row.push(label);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                rows.push([label]);
            }
        }

        rows.forEach((row, rowIndex) => {
            row.forEach(label => {
                const width = approximateWidth(label);
                let anchor = label.anchor;
                let x = Math.max(0, Math.min(innerW, label.x));
                if (anchor === "start" && x + width > innerW) {
                    anchor = "end";
                }
                if (anchor === "middle" && x - width / 2 < 0) {
                    anchor = "start";
                } else if (anchor === "middle" && x + width / 2 > innerW) {
                    anchor = "end";
                }
                g.append("text")
                    .classed("line-label", true)
                    .attr("x", x)
                    .attr("y", 12 + rowIndex * 14)
                    .attr("text-anchor", anchor)
                    .attr("fill", label.color)
                    .attr("stroke", label.outline)
                    .attr("stroke-width", 3)
                    .attr("paint-order", "stroke")
                    .attr("font-size", "10px")
                    .text(label.text);
            });
        });
    }

    private renderEmptyMessage(width: number, height: number, message: string): void {
        const margin = { top: 12, right: 16, bottom: 36, left: 44 };
        const innerW = Math.max(0, width - margin.left - margin.right);
        const innerH = Math.max(0, height - margin.top - margin.bottom);
        const colors = this.getHighContrastColors();
        const g = this.svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        this.drawMessage(g, innerW, innerH, message, this.host.colorPalette.isHighContrast ? colors.foreground : "#666666");
    }

    private renderLandingPage(width: number, height: number): void {
        const isHC = this.host.colorPalette.isHighContrast;
        const colors = this.getHighContrastColors();
        const fg = isHC ? colors.foreground : "#1f2937";
        const muted = isHC ? colors.foreground : "#6b7280";
        const teal = isHC ? colors.foreground : "#01B8AA";
        const red = isHC ? colors.foreground : "#e8392a";
        const blue = isHC ? colors.foreground : "#5b5fc7";
        const panelFill = isHC ? colors.background : "#f8fafc";
        const border = isHC ? colors.foreground : "#d7dee8";

        const g = this.svg.append("g")
            .classed("landing-page", true)
            .attr("aria-label", this.t("Visual_Landing_Aria"));

        if (width <= 430 || height <= 260) {
            const panelX = 10;
            const panelY = 10;
            const panelW = Math.max(0, width - 20);
            const panelH = Math.max(0, height - 20);

            g.append("rect")
                .classed("landing-panel", true)
                .attr("x", panelX)
                .attr("y", panelY)
                .attr("width", panelW)
                .attr("height", panelH)
                .attr("rx", 6)
                .attr("fill", panelFill)
                .attr("stroke", border)
                .attr("stroke-width", 1);

            const chartX = panelX + 18;
            const chartBase = panelY + panelH - 44;
            const barW = Math.max(7, Math.min(13, panelW / 28));
            const gap = 3;
            const barHeights = [24, 38, 56, 72, 62, 44, 28].map(v => Math.min(v, panelH * 0.38));

            barHeights.forEach((barH, i) => {
                g.append("rect")
                    .classed("landing-mini-bar", true)
                    .attr("x", chartX + i * (barW + gap))
                    .attr("y", chartBase - barH)
                    .attr("width", barW)
                    .attr("height", barH)
                    .attr("rx", 2)
                    .attr("fill", teal)
                    .attr("fill-opacity", isHC ? 1 : 0.9);
            });

            const curvePoints: [number, number][] = barHeights.map((barH, i) => [
                chartX + i * (barW + gap) + barW / 2,
                chartBase - barH - 7
            ]);
            const landingCurve = d3.line<[number, number]>()
                .x(d => d[0])
                .y(d => d[1])
                .curve(d3.curveBasis);
            g.append("path")
                .classed("landing-curve", true)
                .datum(curvePoints)
                .attr("fill", "none")
                .attr("stroke", red)
                .attr("stroke-width", 2)
                .attr("d", landingCurve);

            const textX = panelX + Math.min(panelW * 0.44, 150);
            const titleY = panelY + 34;

            g.append("text")
                .classed("landing-title", true)
                .attr("x", textX)
                .attr("y", titleY)
                .attr("fill", fg)
                .attr("font-size", "17px")
                .attr("font-weight", "700")
                .text(this.t("Landing_Title"));

            g.append("text")
                .classed("landing-subtitle", true)
                .attr("x", textX)
                .attr("y", titleY + 18)
                .attr("fill", muted)
                .attr("font-size", "9px")
                .text(this.t("Landing_Subtitle_Compact"));

            const compactSteps = [
                { badge: "1", text: this.t("Landing_Step1_Compact") },
                { badge: "2", text: this.t("Landing_Step2_Compact") }
            ];

            compactSteps.forEach((step, i) => {
                const y = titleY + 48 + i * 28;
                g.append("circle")
                    .classed("landing-step-badge", true)
                    .attr("cx", textX + 8)
                    .attr("cy", y - 4)
                    .attr("r", 8)
                    .attr("fill", i === 0 ? teal : blue);
                g.append("text")
                    .attr("x", textX + 8)
                    .attr("y", y)
                    .attr("text-anchor", "middle")
                    .attr("fill", isHC ? colors.background : "#ffffff")
                    .attr("font-size", "8px")
                    .attr("font-weight", "700")
                    .text(step.badge);
                g.append("text")
                    .classed("landing-step-text", true)
                    .attr("x", textX + 22)
                    .attr("y", y)
                    .attr("fill", fg)
                    .attr("font-size", "10px")
                    .text(step.text);
            });

            if (panelH >= 185) {
                g.append("text")
                    .classed("landing-note", true)
                    .attr("x", textX)
                    .attr("y", panelY + panelH - 18)
                    .attr("fill", muted)
                    .attr("font-size", "9px")
                    .text(this.t("Landing_Note_Compact"));
            }
            return;
        }

        const designW = 560;
        const designH = 300;
        const scale = Math.max(0.2, Math.min(1, (width - 12) / designW, (height - 12) / designH));
        const originX = (width - designW * scale) / 2;
        const originY = (height - designH * scale) / 2;
        const content = g.append("g")
            .classed("landing-content", true)
            .attr("transform", `translate(${originX},${originY}) scale(${scale})`);

        const panelW = 520;
        const panelH = 270;
        const panelX = 20;
        const panelY = 15;

        content.append("rect")
            .classed("landing-panel", true)
            .attr("x", panelX)
            .attr("y", panelY)
            .attr("width", panelW)
            .attr("height", panelH)
            .attr("rx", 8)
            .attr("fill", panelFill)
            .attr("stroke", border)
            .attr("stroke-width", 1);

        const chartX = panelX + 28;
        const chartBase = panelY + panelH - 42;
        const barW = Math.max(10, Math.min(22, panelW / 18));
        const gap = Math.max(4, barW * 0.35);
        const barHeights = [34, 58, 88, 112, 96, 68, 42];

        barHeights.forEach((barH, i) => {
            content.append("rect")
                .classed("landing-mini-bar", true)
                .attr("x", chartX + i * (barW + gap))
                .attr("y", chartBase - barH)
                .attr("width", barW)
                .attr("height", barH)
                .attr("rx", 3)
                .attr("fill", teal)
                .attr("fill-opacity", isHC ? 1 : 0.9);
        });

        const curvePoints: [number, number][] = barHeights.map((barH, i) => [
            chartX + i * (barW + gap) + barW / 2,
            chartBase - barH - 10
        ]);
        const landingCurve = d3.line<[number, number]>()
            .x(d => d[0])
            .y(d => d[1])
            .curve(d3.curveBasis);
        content.append("path")
            .classed("landing-curve", true)
            .datum(curvePoints)
            .attr("fill", "none")
            .attr("stroke", red)
            .attr("stroke-width", 2)
            .attr("d", landingCurve);

        const textX = panelX + Math.min(panelW * 0.44, 240);
        const titleY = panelY + 52;

        content.append("text")
            .classed("landing-title", true)
            .attr("x", textX)
            .attr("y", titleY)
            .attr("fill", fg)
            .attr("font-size", "22px")
            .attr("font-weight", "700")
            .text(this.t("Landing_Title"));

        content.append("text")
            .classed("landing-subtitle", true)
            .attr("x", textX)
            .attr("y", titleY + 24)
            .attr("fill", muted)
            .attr("font-size", "12px")
            .text(this.t("Landing_Subtitle_Full"));

        const steps = [
            { badge: "1", text: this.t("Landing_Step1_Full") },
            { badge: "2", text: this.t("Landing_Step2_Full") }
        ];

        steps.forEach((step, i) => {
            const y = titleY + 62 + i * 36;
            content.append("circle")
                .classed("landing-step-badge", true)
                .attr("cx", textX + 10)
                .attr("cy", y - 5)
                .attr("r", 10)
                .attr("fill", i === 0 ? teal : blue);
            content.append("text")
                .attr("x", textX + 10)
                .attr("y", y - 1)
                .attr("text-anchor", "middle")
                .attr("fill", isHC ? colors.background : "#ffffff")
                .attr("font-size", "10px")
                .attr("font-weight", "700")
                .text(step.badge);
            content.append("text")
                .classed("landing-step-text", true)
                .attr("x", textX + 30)
                .attr("y", y)
                .attr("fill", fg)
                .attr("font-size", "12px")
                .text(step.text);
        });

        content.append("text")
            .classed("landing-note", true)
            .attr("x", textX)
            .attr("y", panelY + panelH - 28)
            .attr("fill", muted)
            .attr("font-size", "11px")
            .text(this.t("Landing_Note_Full"));
    }

    private drawMessage(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        innerW: number,
        innerH: number,
        message: string,
        color: string
    ): void {
        g.append("text")
            .classed("empty-message", true)
            .attr("x", innerW / 2)
            .attr("y", innerH / 2)
            .attr("text-anchor", "middle")
            .attr("fill", color)
            .attr("font-size", "12px")
            .text(message);
    }

    private hasFormatProperty(dataView: DataView | undefined, objectName: string, propertyName: string): boolean {
        const object = dataView?.metadata?.objects?.[objectName] as Record<string, unknown> | undefined;
        return !!object && Object.prototype.hasOwnProperty.call(object, propertyName);
    }

    // d3 format spec ends in a single type letter preceded by precision/comma/dot;
    // PBI .NET-style specs use `#` or `0` placeholders. We route to d3 when the
    // string looks like a d3 format, otherwise to the locale-aware valueFormatter.
    private static D3_FORMAT_PATTERN = /^[+\-,$#~]*[0-9]*(\.[0-9]+)?[bcdefgnoprsxX%]?$/;
    private static D3_FORMAT_HAS_TYPE = /[bcdefgnoprsxX%]$/;

    private looksLikeD3Format(spec: string): boolean {
        return Visual.D3_FORMAT_PATTERN.test(spec) && Visual.D3_FORMAT_HAS_TYPE.test(spec);
    }

    private createFormatter(formatString: string): ((value: number) => string) | undefined {
        const trimmed = formatString.trim();
        if (!trimmed) {
            return undefined;
        }
        if (this.looksLikeD3Format(trimmed)) {
            try {
                return d3.format(trimmed);
            } catch {
                // fall through to valueFormatter
            }
        }
        try {
            const formatter = valueFormatter.create({
                format: trimmed,
                cultureSelector: this.locale
            });
            return (value: number) => formatter.format(value);
        } catch {
            try {
                return d3.format(trimmed);
            } catch {
                return undefined;
            }
        }
    }

    private formatNumber(value: number, formatString = "", formatter?: (value: number) => string): string {
        const activeFormatter = formatter ?? this.createFormatter(formatString);
        if (activeFormatter) {
            return activeFormatter(value);
        }
        try {
            const fallback = valueFormatter.create({
                format: Number.isInteger(value) ? "#,0" : "#,0.##",
                cultureSelector: this.locale
            });
            return fallback.format(value);
        } catch {
            return d3.format(Number.isInteger(value) ? ",d" : ",.2~f")(value);
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private drawQQPlot(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        stats: HistogramStats,
        data: HistogramData,
        xScale: d3.ScaleLinear<number, number>,
        innerH: number,
        isHC: boolean,
        hcColor: string,
        color: string
    ): void {
        // Plot sample quantiles against theoretical normal quantiles, scaled to fit
        // inside the histogram canvas: x is the data value, y is normalized to a
        // dedicated band in the top-right corner so it overlays without occluding bars.
        const expanded: number[] = [];
        for (let i = 0; i < data.values.length; i++) {
            const w = Math.round(data.weights[i]);
            for (let k = 0; k < w; k++) expanded.push(data.values[i]);
        }
        if (expanded.length < 4) return;
        expanded.sort((a, b) => a - b);
        const n = expanded.length;
        const pts: [number, number][] = expanded.map((v, i) => {
            const p = (i + 0.5) / n;
            const theoreticalZ = this.normalInverseCdf(p);
            const expectedValue = stats.mean + stats.sd * theoreticalZ;
            return [xScale(v), expectedValue];
        });
        const ys = pts.map(p => p[1]);
        const yMin = Math.min(...ys);
        const yMax = Math.max(...ys);
        const panelH = Math.min(80, innerH * 0.35);
        const panelTop = 6;
        const yPanel = d3.scaleLinear().domain([yMin, yMax]).range([panelTop + panelH, panelTop]);
        const stroke = isHC ? hcColor : color;
        const qq = g.append("g").classed("qq-plot", true).attr("pointer-events", "none");
        // 45-degree reference line: from (sampleMin, yMin) to (sampleMax, yMax)
        qq.append("line")
            .attr("x1", xScale(expanded[0]))
            .attr("y1", yPanel(yMin))
            .attr("x2", xScale(expanded[n - 1]))
            .attr("y2", yPanel(yMax))
            .attr("stroke", stroke)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2")
            .attr("opacity", 0.6);
        qq.selectAll("circle.qq-point")
            .data(pts)
            .enter()
            .append("circle")
            .classed("qq-point", true)
            .attr("cx", p => p[0])
            .attr("cy", p => yPanel(p[1]))
            .attr("r", 2)
            .attr("fill", stroke)
            .attr("opacity", 0.8);
    }

    private drawBoxPlot(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        data: HistogramData,
        xScale: d3.ScaleLinear<number, number>,
        baselineY: number,
        boxHeight: number,
        isHC: boolean,
        hcColor: string,
        color: string
    ): void {
        const pairs = data.values.map((value, i) => ({ value, weight: data.weights[i] }))
            .sort((a, b) => a.value - b.value);
        const q = (target: number): number => {
            let cumulative = 0;
            for (const pair of pairs) {
                cumulative += pair.weight;
                if (cumulative >= target) return pair.value;
            }
            return pairs[pairs.length - 1]?.value ?? 0;
        };
        const total = data.total;
        const q1 = q(total * 0.25);
        const median = q(total * 0.5);
        const q3 = q(total * 0.75);
        const iqr = q3 - q1;
        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;
        const min = pairs.find(p => p.value >= lowerFence)?.value ?? pairs[0].value;
        const max = [...pairs].reverse().find(p => p.value <= upperFence)?.value ?? pairs[pairs.length - 1].value;
        const cy = baselineY + boxHeight / 2;
        const halfH = boxHeight / 2;
        const fill = isHC ? "transparent" : color;
        const stroke = isHC ? hcColor : "#444444";
        const box = g.append("g").classed("box-plot", true).attr("pointer-events", "none");
        // whiskers
        box.append("line")
            .attr("x1", xScale(min)).attr("x2", xScale(max))
            .attr("y1", cy).attr("y2", cy)
            .attr("stroke", stroke).attr("stroke-width", 1);
        // whisker caps
        [min, max].forEach(v => {
            box.append("line")
                .attr("x1", xScale(v)).attr("x2", xScale(v))
                .attr("y1", cy - halfH * 0.6).attr("y2", cy + halfH * 0.6)
                .attr("stroke", stroke).attr("stroke-width", 1);
        });
        // box
        box.append("rect")
            .attr("x", xScale(q1))
            .attr("y", cy - halfH)
            .attr("width", Math.max(1, xScale(q3) - xScale(q1)))
            .attr("height", boxHeight)
            .attr("fill", fill)
            .attr("fill-opacity", 0.45)
            .attr("stroke", stroke)
            .attr("stroke-width", 1);
        // median
        box.append("line")
            .attr("x1", xScale(median)).attr("x2", xScale(median))
            .attr("y1", cy - halfH).attr("y2", cy + halfH)
            .attr("stroke", stroke).attr("stroke-width", 2);
    }

    private drawTour(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        innerW: number,
        innerH: number,
        accent: string
    ): void {
        const panelW = Math.min(260, innerW - 40);
        const panelH = 110;
        const x = innerW - panelW - 12;
        const y = innerH - panelH - 18;
        const tour = g.append("g").classed("tour", true).attr("transform", `translate(${x},${y})`);
        tour.append("rect")
            .attr("width", panelW)
            .attr("height", panelH)
            .attr("rx", 6)
            .attr("fill", "#ffffff")
            .attr("fill-opacity", 0.94)
            .attr("stroke", accent)
            .attr("stroke-width", 1);
        const steps = [this.t("Tour_Step1"), this.t("Tour_Step2"), this.t("Tour_Step3")];
        steps.forEach((text, i) => {
            const yLine = 22 + i * 22;
            tour.append("circle")
                .attr("cx", 14).attr("cy", yLine - 4).attr("r", 7)
                .attr("fill", accent);
            tour.append("text")
                .attr("x", 14).attr("y", yLine)
                .attr("text-anchor", "middle")
                .attr("fill", "#ffffff")
                .attr("font-size", "9px")
                .attr("font-weight", "700")
                .text(String(i + 1));
            tour.append("text")
                .attr("x", 28).attr("y", yLine)
                .attr("fill", "#1f2937")
                .attr("font-size", "10px")
                .text(text);
        });
        const dismiss = tour.append("g")
            .attr("transform", `translate(${panelW - 14},10)`)
            .attr("cursor", "pointer")
            .attr("role", "button")
            .attr("aria-label", this.t("Tour_Dismiss"))
            .attr("tabindex", "0");
        dismiss.append("circle").attr("r", 8).attr("fill", "transparent").attr("stroke", accent);
        dismiss.append("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", "10px")
            .attr("fill", accent)
            .text("×");
        const persistDismiss = () => {
            try {
                this.host.persistProperties({
                    merge: [{
                        objectName: "tour",
                        selector: undefined,
                        properties: { dismissed: true }
                    }]
                });
            } catch { /* host may disallow persist in some embed contexts */ }
        };
        dismiss.on("click", persistDismiss);
        dismiss.on("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
                persistDismiss();
                event.preventDefault();
            }
        });
    }

    private normalInverseCdf(p: number): number {
        // Beasley-Springer-Moro approximation of Φ⁻¹.
        if (p <= 0) return -Infinity;
        if (p >= 1) return Infinity;
        const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
            1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
        const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
            6.680131188771972e+01, -1.328068155288572e+01];
        const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
            -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
        const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
            3.754408661907416e+00];
        const pLow = 0.02425, pHigh = 1 - pLow;
        let q: number, r: number;
        if (p < pLow) {
            q = Math.sqrt(-2 * Math.log(p));
            return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
                   ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
        }
        if (p <= pHigh) {
            q = p - 0.5;
            r = q * q;
            return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
                   (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
        }
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
                ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
    }

    private drawHelpIcon(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        innerW: number,
        color: string
    ): void {
        const icon = g.append("g")
            .classed("help-icon", true)
            .attr("transform", `translate(${innerW - 14},2)`)
            .attr("cursor", "pointer")
            .attr("tabindex", "0")
            .attr("role", "button")
            .attr("aria-label", "Help");
        icon.append("circle")
            .attr("r", 8)
            .attr("fill", "transparent")
            .attr("stroke", color)
            .attr("stroke-width", 1.2)
            .attr("opacity", 0.6);
        icon.append("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", "10px")
            .attr("font-weight", "700")
            .attr("fill", color)
            .text("?");
        const open = () => {
            try {
                this.host.launchUrl("https://github.com/mkocontracting/histogram-plus#readme");
            } catch { /* host may disallow launchUrl in some embed contexts */ }
        };
        icon.on("click", open);
        icon.on("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
                open();
                event.preventDefault();
            }
        });
    }

    private drawCrosshair(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        bin: Bin,
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>,
        innerW: number,
        innerH: number,
        color: string
    ): void {
        g.selectAll(".crosshair").remove();
        const xMid = (xScale(bin.x0) + xScale(bin.x1)) / 2;
        const yTop = yScale(bin.count);
        const ch = g.append("g").classed("crosshair", true)
            .attr("pointer-events", "none");
        ch.append("line")
            .attr("x1", xMid).attr("x2", xMid)
            .attr("y1", yTop).attr("y2", innerH)
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,3")
            .attr("opacity", 0.7);
        ch.append("line")
            .attr("x1", 0).attr("x2", innerW)
            .attr("y1", yTop).attr("y2", yTop)
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,3")
            .attr("opacity", 0.7);
    }

    private animationsEnabled(): boolean {
        try {
            if (typeof window !== "undefined") {
                if ((window as unknown as { __skipAnimations?: boolean }).__skipAnimations) return false;
                if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                    return false;
                }
            }
        } catch { /* ignore matchMedia errors in sandboxed hosts */ }
        if (this.host.colorPalette.isHighContrast) return false;
        // Skip animations after the first render — keeps subsequent slicer/filter
        // updates snappy and avoids capturing mid-tween frames during PDF/PNG export.
        if (this.hasRenderedOnce) return false;
        return true;
    }

    private handleArrowNav(event: KeyboardEvent, bins: Bin[]): void {
        const bars = this.svg.selectAll<SVGRectElement, Bin>("rect.bar").nodes();
        if (bars.length === 0) return;
        const current = bars.indexOf(document.activeElement as SVGRectElement);
        let next = current;
        switch (event.key) {
            case "ArrowLeft": next = Math.max(0, current - 1); break;
            case "ArrowRight": next = Math.min(bars.length - 1, current + 1); break;
            case "Home": next = 0; break;
            case "End": next = bars.length - 1; break;
        }
        if (next !== current && next >= 0) {
            bars.forEach((b, i) => b.setAttribute("tabindex", i === next ? "0" : "-1"));
            bars[next].focus();
            event.preventDefault();
            void bins;
        }
    }

    protected getHighContrastColors(): { foreground: string; background: string; selected: string } {
        const p = this.host.colorPalette;
        if (p.isHighContrast) {
            return {
                foreground: (p.foreground as powerbi.IColorInfo).value,
                background: (p.background as powerbi.IColorInfo).value,
                selected:   (p.foregroundSelected as powerbi.IColorInfo).value,
            };
        }
        const s = this.formattingSettings?.bars;
        return {
            foreground: s?.fill?.value?.value ?? "#01B8AA",
            background: "#ffffff",
            selected:   "#000000",
        };
    }
}
