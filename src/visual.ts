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
import * as d3 from "d3";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel } from "./settings";

interface Bin {
    x0: number;
    x1: number;
    count: number;
}

interface HistogramData {
    values: number[];      // distinct (or raw) numeric values
    weights: number[];     // frequency per value (1 when no Frequency measure)
    total: number;         // sum of weights = total observations
    hasFrequency: boolean; // whether a Frequency measure was supplied
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private target: HTMLElement;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private landingPage: HTMLElement | null = null;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = options.host.createSelectionManager();
        this.tooltipServiceWrapper = createTooltipServiceWrapper(options.host.tooltipService, options.element);
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;

        this.svg = d3.select(this.target)
            .append("svg")
            .classed("histogram-plus", true);

        this.svg.on("contextmenu", (event: MouseEvent) => {
            this.selectionManager.showContextMenu({}, { x: event.clientX, y: event.clientY });
            event.preventDefault();
        });
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);

        const width = options.viewport?.width ?? 0;
        const height = options.viewport?.height ?? 0;

        const dataView = options.dataViews?.[0];

        // Always populate settings (format pane needs it), tolerating no data view.
        try {
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                dataView ?? ({ metadata: { columns: [] } } as DataView)
            );
        } catch { /* keep previous settings */ }

        const data = this.extractData(dataView);

        // Empty → show landing page (created once), keep the chart SVG hidden.
        if (data.values.length === 0) {
            this.showLandingPage();
            this.svg.style("display", "none");
            this.events.renderingFinished(options);
            return;
        }

        this.removeLandingPage();
        this.svg.style("display", null);
        this.svg.attr("width", width).attr("height", height);
        this.svg.selectAll("*").remove();

        try {
            if (dataView?.metadata?.segment) {
                this.host.fetchMoreData(true);
            }
            const bins = this.computeBins(data);
            this.renderHistogram(bins, data, width, height);
            this.events.renderingFinished(options);
        }
        catch (error) {
            this.svg.selectAll("*").remove();
            this.events.renderingFailed(options, String(error));
        }
    }

    private extractData(dataView: DataView | undefined): HistogramData {
        const category = dataView?.categorical?.categories?.[0];
        if (!category?.values) {
            return { values: [], weights: [], total: 0, hasFrequency: false };
        }
        // Power BI groups the category to distinct values; the optional Frequency
        // measure carries the count per value so repeated data bins correctly.
        const freqColumn = dataView?.categorical?.values?.[0];
        const values: number[] = [];
        const weights: number[] = [];
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
                values.push(n);
                weights.push(w);
            }
        }
        const total = weights.reduce((a, b) => a + b, 0);
        return { values, weights, total, hasFrequency: !!freqColumn };
    }

    private computeBins(data: HistogramData): Bin[] {
        const { values, weights, total } = data;
        const min = d3.min(values)!;
        const max = d3.max(values)!;

        // All values equal → single centered bin with a display width so it renders
        if (min === max) {
            const halfWidth = min !== 0 ? Math.abs(min) * 0.05 : 0.5;
            return [{ x0: min - halfWidth, x1: min + halfWidth, count: total }];
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
            // Extend domain so the final bin is full-width (no misleading skinny remainder bar)
            const nBins = Math.ceil((max - min) / w);
            edges = d3.range(0, nBins + 1).map(i => min + i * w);
        } else {
            // auto — Sturges count, with "nice" round boundaries that align to the data grid
            const target = Math.max(1, Math.ceil(Math.log2(total)) + 1);
            const niceScale = d3.scaleLinear().domain([min, max]).nice(target);
            edges = niceScale.ticks(target);
            // Guard: ensure edges fully span the data range
            if (edges.length < 2 || edges[0] > min) edges.unshift(niceScale.domain()[0]);
            if (edges[edges.length - 1] < max) edges.push(niceScale.domain()[1]);
        }

        // Manual weighted binning: [x0, x1) left-inclusive, last bin closed on the right
        const counts = new Array(edges.length - 1).fill(0);
        for (let i = 0; i < values.length; i++) {
            let idx = d3.bisectRight(edges, values[i]) - 1;
            if (idx < 0) idx = 0;
            if (idx >= counts.length) idx = counts.length - 1;
            counts[idx] += weights[i];
        }
        return counts.map((count, i) => ({ x0: edges[i], x1: edges[i + 1], count }));
    }

    private renderHistogram(bins: Bin[], data: HistogramData, width: number, height: number): void {
        const margin = { top: 12, right: 16, bottom: 36, left: 44 };
        const innerW = Math.max(0, width - margin.left - margin.right);
        const innerH = Math.max(0, height - margin.top - margin.bottom);

        const colors = this.getHighContrastColors();
        const isHC = this.host.colorPalette.isHighContrast;
        const bars = this.formattingSettings.bars;
        const xAxisCard = this.formattingSettings.xAxis;
        const yAxisCard = this.formattingSettings.yAxis;

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

        // Bars
        const barFill = isHC ? colors.background : bars.fill.value.value;
        const barStroke = isHC ? colors.foreground : bars.stroke.value.value;
        const barOpacity = isHC ? 1 : bars.fillOpacity.value / 100;
        const barStrokeWidth = isHC ? 2 : 1;

        const barSelection = g.selectAll("rect.bar")
            .data(bins)
            .enter()
            .append("rect")
            .classed("bar", true)
            .attr("x", d => xScale(d.x0) + 1)
            .attr("y", d => yScale(d.count))
            .attr("width", d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
            .attr("height", d => innerH - yScale(d.count))
            .attr("fill", barFill)
            .attr("fill-opacity", barOpacity)
            .attr("stroke", barStroke)
            .attr("stroke-width", barStrokeWidth);

        this.tooltipServiceWrapper.addTooltip<Bin>(
            barSelection,
            (bin: Bin) => [
                { displayName: "Range", value: `[${bin.x0.toFixed(2)}, ${bin.x1.toFixed(2)})` },
                { displayName: "Count", value: bin.count.toString() },
            ]
        );

        // X axis
        if (xAxisCard.show.value) {
            const xAxis = d3.axisBottom(xScale).ticks(Math.min(bins.length, 10));
            const xAxisG = g.append("g")
                .attr("transform", `translate(0,${innerH})`)
                .call(xAxis);
            const xColor = isHC ? colors.foreground : xAxisCard.labelColor.value.value;
            xAxisG.selectAll("text")
                .attr("fill", xColor)
                .attr("font-size", `${xAxisCard.fontSize.value}px`);
            xAxisG.selectAll("path, line").attr("stroke", xColor);
        }

        // Y axis
        if (yAxisCard.show.value) {
            const yAxis = d3.axisLeft(yScale).ticks(Math.min(binCountMax, 8));
            const yAxisG = g.append("g").call(yAxis);
            const yColor = isHC ? colors.foreground : yAxisCard.labelColor.value.value;
            yAxisG.selectAll("text")
                .attr("fill", yColor)
                .attr("font-size", `${yAxisCard.fontSize.value}px`);
            yAxisG.selectAll("path, line").attr("stroke", yColor);
        }

        // Normal curve overlay (paid)
        if (showCurve) {
            this.drawNormalCurve(g, stats, data.total, bins, xScale, yScale, innerH, isHC, colors.foreground);
        }

        // Spec limits + Cp/Cpk (paid)
        if (this.formattingSettings.specLimits.show.value) {
            this.drawSpecLimits(g, stats, xScale, innerW, innerH, isHC, colors.foreground);
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
                .text("Tip: repeated values? Add the column to Frequency → Count");
        }
    }

    private computeStats(data: HistogramData): { mean: number; sd: number } {
        const { values, weights, total } = data;
        if (total <= 0) {
            return { mean: 0, sd: 0 };
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
        return { mean, sd: Math.sqrt(variance) };
    }

    private drawNormalCurve(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        stats: { mean: number; sd: number },
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

        const line = d3.line<[number, number]>().x(p => p[0]).y(p => p[1]).curve(d3.curveBasis);

        g.append("path")
            .datum(points)
            .attr("fill", "none")
            .attr("stroke", isHC ? hcColor : card.color.value.value)
            .attr("stroke-width", card.strokeWidth.value)
            .attr("d", line);
    }

    private drawSpecLimits(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        stats: { mean: number; sd: number },
        xScale: d3.ScaleLinear<number, number>,
        innerW: number,
        innerH: number,
        isHC: boolean,
        hcColor: string
    ): void {
        const card = this.formattingSettings.specLimits;
        const color = isHC ? hcColor : card.color.value.value;
        const [d0, d1] = xScale.domain();

        const drawLine = (value: number, label: string) => {
            if (value < d0 || value > d1) {
                return;
            }
            const x = xScale(value);
            g.append("line")
                .attr("x1", x).attr("x2", x)
                .attr("y1", 0).attr("y2", innerH)
                .attr("stroke", color)
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "4,3");
            g.append("text")
                .attr("x", x).attr("y", 10)
                .attr("text-anchor", "middle")
                .attr("fill", color)
                .attr("font-size", "11px")
                .text(label);
        };

        drawLine(card.lsl.value, "LSL");
        drawLine(card.usl.value, "USL");

        // Cp / Cpk readout
        if (card.showCpk.value && stats.sd > 0) {
            const lsl = card.lsl.value;
            const usl = card.usl.value;
            const cp = (usl - lsl) / (6 * stats.sd);
            const cpu = (usl - stats.mean) / (3 * stats.sd);
            const cpl = (stats.mean - lsl) / (3 * stats.sd);
            const cpk = Math.min(cpu, cpl);

            g.append("text")
                .attr("x", innerW - 4)
                .attr("y", innerH - 6)
                .attr("text-anchor", "end")
                .attr("fill", color)
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .text(`Cp ${cp.toFixed(2)}  Cpk ${cpk.toFixed(2)}`);
        }
    }

    // Landing page is created once (per MS supportsLandingPage pattern) and
    // removed when data arrives — never re-rendered on every update.
    private showLandingPage(): void {
        if (this.landingPage) {
            return;
        }
        const isHC = this.host.colorPalette.isHighContrast;
        const fg = isHC ? this.getHighContrastColors().foreground : "#666666";
        const body = isHC ? this.getHighContrastColors().foreground : "#999999";

        const page = document.createElement("div");
        page.className = "landing-page";

        const title = document.createElement("div");
        title.className = "landing-title";
        title.style.color = fg;
        title.textContent = "Histogram+";
        page.appendChild(title);

        const lines = [
            "1. Drag a numeric column to the Values field.",
            "2. For data with repeated values, drag the same column to Frequency and set it to Count.",
            "Continuous data needs only the Values field.",
        ];
        for (const text of lines) {
            const p = document.createElement("div");
            p.className = "landing-line";
            p.style.color = body;
            p.textContent = text;
            page.appendChild(p);
        }

        const build = document.createElement("div");
        build.className = "landing-build";
        build.style.color = body;
        build.textContent = "build 1.0.0.2";
        page.appendChild(build);

        this.target.appendChild(page);
        this.landingPage = page;
    }

    private removeLandingPage(): void {
        if (this.landingPage) {
            this.landingPage.remove();
            this.landingPage = null;
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
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
