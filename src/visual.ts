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

export class Visual implements IVisual {
    private host: IVisualHost;
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private target: HTMLElement;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = options.host.createSelectionManager();
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

        try {
            const dataView = options.dataViews?.[0];

            if (dataView?.metadata?.segment) {
                this.host.fetchMoreData(true);
            }

            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dataView);

            const width = options.viewport.width;
            const height = options.viewport.height;
            this.svg.attr("width", width).attr("height", height);
            this.svg.selectAll("*").remove();

            const values = this.extractValues(dataView);
            if (values.length === 0) {
                this.renderEmptyState(width, height);
                this.events.renderingFinished(options);
                return;
            }

            const bins = this.computeBins(values);
            this.renderHistogram(bins, values, width, height);

            this.events.renderingFinished(options);
        }
        catch (error) {
            this.events.renderingFailed(options, String(error));
        }
    }

    private extractValues(dataView: DataView | undefined): number[] {
        const category = dataView?.categorical?.categories?.[0];
        if (!category?.values) {
            return [];
        }
        const result: number[] = [];
        for (const v of category.values) {
            const n = typeof v === "number" ? v : Number(v);
            if (v !== null && v !== undefined && Number.isFinite(n)) {
                result.push(n);
            }
        }
        return result;
    }

    private computeBins(values: number[]): Bin[] {
        const min = d3.min(values)!;
        const max = d3.max(values)!;

        // All values equal → single centered bin with a display width so it renders
        if (min === max) {
            const halfWidth = min !== 0 ? Math.abs(min) * 0.05 : 0.5;
            return [{ x0: min - halfWidth, x1: min + halfWidth, count: values.length }];
        }

        const binsCard = this.formattingSettings.bins;
        const mode = binsCard.mode.value.value as string;

        let thresholds: number[];
        let domainMax = max;
        if (mode === "count") {
            const n = Math.max(1, Math.round(binsCard.count.value));
            const step = (max - min) / n;
            thresholds = d3.range(1, n).map(i => min + i * step);
        } else if (mode === "width") {
            const w = binsCard.width.value > 0 ? binsCard.width.value : (max - min);
            // Extend domain so the final bin is full-width (no misleading skinny remainder bar)
            const nBins = Math.ceil((max - min) / w);
            domainMax = min + nBins * w;
            thresholds = d3.range(1, nBins).map(i => min + i * w);
        } else {
            // auto — Sturges
            const n = Math.max(1, Math.ceil(Math.log2(values.length)) + 1);
            const step = (max - min) / n;
            thresholds = d3.range(1, n).map(i => min + i * step);
        }

        const binner = d3.bin<number, number>()
            .domain([min, domainMax])
            .thresholds(thresholds);

        // d3 bins are left-inclusive [x0, x1); last bin is [x0, x1] (closed) — matches SPEC [x) logic
        return binner(values).map(b => ({
            x0: b.x0!,
            x1: b.x1!,
            count: b.length,
        }));
    }

    private renderHistogram(bins: Bin[], values: number[], width: number, height: number): void {
        const margin = { top: 12, right: 16, bottom: 36, left: 44 };
        const innerW = Math.max(0, width - margin.left - margin.right);
        const innerH = Math.max(0, height - margin.top - margin.bottom);

        const colors = this.getHighContrastColors();
        const isHC = this.host.colorPalette.isHighContrast;
        const bars = this.formattingSettings.bars;
        const xAxisCard = this.formattingSettings.xAxis;
        const yAxisCard = this.formattingSettings.yAxis;

        const stats = this.computeStats(values);
        const showCurve = this.formattingSettings.normalCurve.show.value && stats.sd > 0;

        const x0 = bins[0].x0;
        const x1 = bins[bins.length - 1].x1;
        const xScale = d3.scaleLinear().domain([x0, x1]).range([0, innerW]);

        const binCountMax = d3.max(bins, b => b.count) || 0;
        // Extend y-domain to fit the normal-curve peak so it isn't clipped
        const binWidth = bins[0].x1 - bins[0].x0;
        const curvePeak = showCurve
            ? (1 / (stats.sd * Math.sqrt(2 * Math.PI))) * values.length * binWidth
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

        g.selectAll("rect.bar")
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
            this.drawNormalCurve(g, stats, values.length, bins, xScale, yScale, innerH, isHC, colors.foreground);
        }

        // Spec limits + Cp/Cpk (paid)
        if (this.formattingSettings.specLimits.show.value) {
            this.drawSpecLimits(g, stats, xScale, innerW, innerH, isHC, colors.foreground);
        }
    }

    private computeStats(values: number[]): { mean: number; sd: number } {
        const mean = d3.mean(values) ?? 0;
        const variance = values.length > 1
            ? d3.sum(values, v => (v - mean) ** 2) / (values.length - 1)
            : 0;
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

    private renderEmptyState(width: number, height: number): void {
        const colors = this.getHighContrastColors();
        this.svg.append("text")
            .attr("x", width / 2)
            .attr("y", height / 2)
            .attr("text-anchor", "middle")
            .attr("fill", this.host.colorPalette.isHighContrast ? colors.foreground : "#999999")
            .attr("font-size", "13px")
            .text("Add a numeric column to the Values field");
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
