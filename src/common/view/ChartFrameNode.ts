/**
 * ChartFrameNode.ts
 *
 * The frame both graphs share: plot rectangle, grid, ticks, tick labels, axis
 * labels and a clipped layer for the data. The plot's top-left corner is this
 * node's origin. Callers add their marks to `plotLayer` and call `setRanges()`.
 *
 * Built directly on bamboo, following CartCollisions' TimeGraphNode.
 */

import { ChartRectangle, ChartTransform, GridLineSet, TickLabelSet, TickMarkSet } from "scenerystack/bamboo";
import { Range } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { Node, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import DataLabColors from "../../DataLabColors.js";

const LABEL_FONT = new PhetFont(12);
const TICK_FONT = new PhetFont(10);
const GRID_LINE_WIDTH = 0.5;

/** Distance from the plot edge to the axis labels. */
const X_LABEL_OFFSET = 20;
const Y_LABEL_OFFSET = 46;

/** Largest number of decimals a tick label is printed with before falling back to general notation. */
const MAX_TICK_DECIMALS = 6;
const MAX_FIXED_TICK = 1e6;

/** A "nice" tick spacing (1, 2 or 5 × 10ⁿ) giving about `targetTicks` ticks across `span`. */
export function niceStep(span: number, targetTicks = 5): number {
  if (!(span > 0 && Number.isFinite(span))) {
    return 1;
  }
  const raw = span / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return nice * magnitude;
}

/** Decimals needed to print multiples of `step` exactly. */
export function decimalsFor(step: number): number {
  return Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
}

function formatTick(value: number, step: number): string {
  const decimals = decimalsFor(step);
  if (decimals <= MAX_TICK_DECIMALS && Math.abs(value) < MAX_FIXED_TICK) {
    return value.toFixed(decimals);
  }
  return String(Number(value.toPrecision(MAX_TICK_DECIMALS)));
}

export type ChartFrameNodeOptions = {
  readonly viewWidth: number;
  readonly viewHeight: number;
  /** Target number of ticks on the y axis; fewer for a short graph. */
  readonly yTickCount?: number;
  /** Whether numbers are printed under the x axis (off when another graph below shares it). */
  readonly showXTickLabels?: boolean;
};

export class ChartFrameNode extends Node {
  public readonly chartTransform: ChartTransform;
  public readonly chartRectangle: ChartRectangle;
  /** Clipped to the plot area; add data marks here. */
  public readonly plotLayer: Node;
  public readonly xAxisLabel: Text;
  public readonly yAxisLabel: Text;
  public readonly viewWidth: number;
  public readonly viewHeight: number;

  private readonly xSets: { setSpacing: (spacing: number) => void }[];
  private readonly ySets: { setSpacing: (spacing: number) => void }[];
  private readonly yTickCount: number;
  private xStep = 1;
  private yStep = 1;

  public constructor(options: ChartFrameNodeOptions) {
    super();
    const { viewWidth, viewHeight } = options;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.yTickCount = options.yTickCount ?? 5;

    const chartTransform = new ChartTransform({
      viewWidth,
      viewHeight,
      modelXRange: new Range(0, 1),
      modelYRange: new Range(0, 1),
    });
    this.chartTransform = chartTransform;

    this.chartRectangle = new ChartRectangle(chartTransform, {
      fill: DataLabColors.chartBackgroundColorProperty,
      stroke: DataLabColors.panelBorderColorProperty,
    });

    const gridOptions = { stroke: DataLabColors.chartGridColorProperty, lineWidth: GRID_LINE_WIDTH };
    const tickOptions = { edge: "min" as const, stroke: DataLabColors.textColorProperty };
    const createLabel = (step: () => number) => (value: number) =>
      new Text(formatTick(value, step()), { font: TICK_FONT, fill: DataLabColors.textColorProperty });

    const xGrid = new GridLineSet(chartTransform, Orientation.HORIZONTAL, 1, gridOptions);
    const yGrid = new GridLineSet(chartTransform, Orientation.VERTICAL, 1, gridOptions);
    const xTicks = new TickMarkSet(chartTransform, Orientation.HORIZONTAL, 1, tickOptions);
    const yTicks = new TickMarkSet(chartTransform, Orientation.VERTICAL, 1, tickOptions);
    const yTickLabels = new TickLabelSet(chartTransform, Orientation.VERTICAL, 1, {
      edge: "min",
      createLabel: createLabel(() => this.yStep),
    });
    this.xSets = [xGrid, xTicks];
    this.ySets = [yGrid, yTicks, yTickLabels];

    this.plotLayer = new Node({ clipArea: Shape.rect(0, 0, viewWidth, viewHeight) });
    this.plotLayer.addChild(xGrid);
    this.plotLayer.addChild(yGrid);

    this.children = [this.chartRectangle, this.plotLayer, xTicks, yTicks, yTickLabels];

    if (options.showXTickLabels ?? true) {
      const xTickLabels = new TickLabelSet(chartTransform, Orientation.HORIZONTAL, 1, {
        edge: "min",
        createLabel: createLabel(() => this.xStep),
      });
      this.xSets.push(xTickLabels);
      this.addChild(xTickLabels);
    }

    this.xAxisLabel = new Text("", { font: LABEL_FONT, fill: DataLabColors.textColorProperty, maxWidth: viewWidth });
    this.yAxisLabel = new Text("", {
      font: LABEL_FONT,
      fill: DataLabColors.textColorProperty,
      rotation: -Math.PI / 2,
      maxWidth: viewHeight,
    });
    this.addChild(this.xAxisLabel);
    this.addChild(this.yAxisLabel);

    const layout = () => {
      this.xAxisLabel.centerX = viewWidth / 2;
      this.xAxisLabel.top = viewHeight + X_LABEL_OFFSET;
      this.yAxisLabel.centerX = -Y_LABEL_OFFSET;
      this.yAxisLabel.centerY = viewHeight / 2;
    };
    layout();
    this.xAxisLabel.boundsProperty.lazyLink(layout);
    this.yAxisLabel.boundsProperty.lazyLink(layout);
  }

  /** Sets both axis ranges and picks tick spacings to suit them. */
  public setRanges(xRange: Range, yRange: Range): void {
    const xStep = niceStep(xRange.getLength(), 6);
    const yStep = niceStep(yRange.getLength(), this.yTickCount);

    // Widen the spacing before the range grows and narrow it after the range
    // shrinks, so the tick sets never try to lay out thousands of ticks.
    const applySpacing = (growing: boolean) => {
      if (xStep > this.xStep === growing) {
        this.xStep = xStep;
        for (const set of this.xSets) {
          set.setSpacing(xStep);
        }
      }
      if (yStep > this.yStep === growing) {
        this.yStep = yStep;
        for (const set of this.ySets) {
          set.setSpacing(yStep);
        }
      }
    };
    applySpacing(true);
    this.chartTransform.setModelXRange(xRange);
    this.chartTransform.setModelYRange(yRange);
    applySpacing(false);
  }
}

/** A range padded by `fraction` on each side; a zero-width range is opened up around its value. */
export function paddedRange(min: number, max: number, fraction: number): Range {
  if (!(Number.isFinite(min) && Number.isFinite(max))) {
    return new Range(0, 1);
  }
  if (min === max) {
    const halfWidth = min === 0 ? 1 : Math.abs(min) * 0.5;
    return new Range(min - halfWidth, max + halfWidth);
  }
  const padding = (max - min) * fraction;
  return new Range(min - padding, max + padding);
}
