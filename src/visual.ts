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
            this.renderHistogram(bins, width, height);

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

        // All values equal → single bin
        if (min === max) {
            return [{ x0: min, x1: min, count: values.length }];
        }

        const binsCard = this.formattingSettings.bins;
        const mode = binsCard.mode.value.value as string;

        let thresholds: number[];
        if (mode === "count") {
            const n = Math.max(1, Math.round(binsCard.count.value));
            const step = (max - min) / n;
            thresholds = d3.range(1, n).map(i => min + i * step);
        } else if (mode === "width") {
            const w = binsCard.width.value > 0 ? binsCard.width.value : (max - min);
            thresholds = [];
            for (let t = min + w; t < max; t += w) {
                thresholds.push(t);
            }
        } else {
            // auto — Sturges
            const n = Math.max(1, Math.ceil(Math.log2(values.length)) + 1);
            const step = (max - min) / n;
            thresholds = d3.range(1, n).map(i => min + i * step);
        }

        const binner = d3.bin<number, number>()
            .domain([min, max])
            .thresholds(thresholds);

        // d3 bins are left-inclusive [x0, x1); last bin is [x0, x1] (closed) — matches SPEC [x) logic
        return binner(values).map(b => ({
            x0: b.x0!,
            x1: b.x1!,
            count: b.length,
        }));
    }

    private renderHistogram(bins: Bin[], width: number, height: number): void {
        const margin = { top: 12, right: 16, bottom: 36, left: 44 };
        const innerW = Math.max(0, width - margin.left - margin.right);
        const innerH = Math.max(0, height - margin.top - margin.bottom);

        const colors = this.getHighContrastColors();
        const isHC = this.host.colorPalette.isHighContrast;
        const bars = this.formattingSettings.bars;
        const xAxisCard = this.formattingSettings.xAxis;
        const yAxisCard = this.formattingSettings.yAxis;

        const x0 = bins[0].x0;
        const x1 = bins[bins.length - 1].x1;
        const xScale = d3.scaleLinear().domain([x0, x1]).range([0, innerW]);
        const yMax = d3.max(bins, b => b.count) || 0;
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
            const yAxis = d3.axisLeft(yScale).ticks(Math.min(yMax, 8));
            const yAxisG = g.append("g").call(yAxis);
            const yColor = isHC ? colors.foreground : yAxisCard.labelColor.value.value;
            yAxisG.selectAll("text")
                .attr("fill", yColor)
                .attr("font-size", `${yAxisCard.fontSize.value}px`);
            yAxisG.selectAll("path, line").attr("stroke", yColor);
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
