/**
 * GraphView.ts
 *
 * What the graphs are showing: the visible x and y intervals. This is view state,
 * separate from the model on purpose — zooming and panning change what is drawn
 * and never which rows a fit uses.
 *
 * Each axis is either automatic (`null`) or set by hand. An automatic x axis shows
 * every valid point; an automatic y axis shows the valid points inside the visible
 * x interval, so zooming in x alone keeps the data filling the graph.
 */

import { DerivedProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import type { Range } from "scenerystack/dot";
import type { XRange } from "../../common/model/includedRows.js";
import { validUncertainty } from "../../common/model/leastSquares.js";
import { axisCoordinate, limitLogRange, paddedRange, panBy, zoomAbout } from "../../common/view/axisRange.js";
import { X_AXIS_PADDING, Y_AXIS_PADDING, ZOOM_PADDING } from "../../DataLabConstants.js";
import type { DataLabModel } from "../model/DataLabModel.js";

function errorBound(value: number, coordinate: number, error: number, log: boolean): number {
  const bound = error === 0 ? coordinate : axisCoordinate(value + error, log);
  return Number.isFinite(bound) ? bound : coordinate;
}

function displayedRange(min: number, max: number, padding: number, log: boolean): Range {
  if (!log) {
    return paddedRange(min, max, padding);
  }
  const singlePoint = min === max;
  return limitLogRange(paddedRange(singlePoint ? min - 0.5 : min, singlePoint ? max + 0.5 : max, padding));
}

export class GraphView {
  public readonly rectangleSelectionProperty = new Property(false);
  public readonly logXProperty = new Property(false);
  public readonly logYProperty = new Property(false);
  public readonly hiddenCountProperty: TReadOnlyProperty<number>;

  /** The x interval set by zooming or panning, or null to show all the data. */
  public readonly xViewRangeProperty = new Property<Range | null>(null);
  /** The y interval set by zooming or panning, or null to fit the visible points. */
  public readonly yViewRangeProperty = new Property<Range | null>(null);

  /** The x and y intervals actually drawn. */
  public readonly xAxisRangeProperty: TReadOnlyProperty<Range>;
  public readonly yAxisRangeProperty: TReadOnlyProperty<Range>;

  /** True while both axes are automatic. */
  public readonly isAutoScaledProperty: TReadOnlyProperty<boolean>;

  public constructor(model: DataLabModel) {
    /** Plot and gesture ranges are measured in axis coordinates. */
    const extent = (pick: "x" | "y", within: Range | null): Range => {
      const xs = model.xColumnProperty.value?.values ?? [];
      const ys = model.yColumnProperty.value?.values ?? [];
      const log = pick === "x" ? this.logXProperty.value : this.logYProperty.value;
      const uncertainties = pick === "y" ? model.uncertaintyColumnProperty.value?.values : undefined;
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
        const x = axisCoordinate(xs[i] as number, this.logXProperty.value);
        const y = axisCoordinate(ys[i] as number, this.logYProperty.value);
        if (!(Number.isFinite(x) && Number.isFinite(y)) || (within && !within.contains(x))) {
          continue;
        }
        const sigma = uncertainties?.[i];
        const error = validUncertainty(sigma) ? sigma : 0;
        const value = pick === "x" ? x : y;
        min = Math.min(min, errorBound(ys[i] as number, value, -error, log));
        max = Math.max(max, errorBound(ys[i] as number, value, error, log));
      }
      return displayedRange(min, max, pick === "x" ? X_AXIS_PADDING : Y_AXIS_PADDING, log);
    };

    const columnsAndScales = [
      model.xColumnProperty,
      model.yColumnProperty,
      this.logXProperty,
      this.logYProperty,
    ] as const;
    this.xAxisRangeProperty = new DerivedProperty(
      [this.xViewRangeProperty, ...columnsAndScales],
      (viewRange) => viewRange ?? extent("x", null),
    );
    this.yAxisRangeProperty = new DerivedProperty(
      [this.yViewRangeProperty, this.xAxisRangeProperty, ...columnsAndScales, model.uncertaintyColumnProperty],
      (viewRange, xRange) => viewRange ?? extent("y", xRange),
    );
    this.hiddenCountProperty = new DerivedProperty(
      columnsAndScales,
      (xColumn, yColumn, logX, logY) =>
        xColumn?.values.reduce((count, x, i) => {
          const y = yColumn?.values[i] ?? Number.NaN;
          return count + Number(Number.isFinite(x) && Number.isFinite(y) && ((logX && x <= 0) || (logY && y <= 0)));
        }, 0) ?? 0,
    );
    this.isAutoScaledProperty = new DerivedProperty(
      [this.xViewRangeProperty, this.yViewRangeProperty],
      (xRange, yRange) => xRange === null && yRange === null,
    );

    this.logXProperty.lazyLink(() => this.autoScale());
    this.logYProperty.lazyLink(() => this.autoScale());

    // A view set for one column means nothing for another.
    model.xColumnIndexProperty.lazyLink(() => this.autoScale());
    model.yColumnIndexProperty.lazyLink(() => {
      this.yViewRangeProperty.value = null;
    });
  }

  public setLogAxes(logX: boolean, logY: boolean): void {
    this.logXProperty.value = logX;
    this.logYProperty.value = logY;
  }

  /** Zooms the x axis by `factor` (below 1 zooms in), keeping `anchor` in place. */
  public zoomX(factor: number, anchor: number): void {
    const next = zoomAbout(this.xAxisRangeProperty.value, factor, anchor);
    this.xViewRangeProperty.value = this.logXProperty.value ? limitLogRange(next) : next;
  }

  public zoomY(factor: number, anchor: number): void {
    const next = zoomAbout(this.yAxisRangeProperty.value, factor, anchor);
    this.yViewRangeProperty.value = this.logYProperty.value ? limitLogRange(next) : next;
  }

  /** Shows `range` shifted by `delta` data units on the x axis. */
  public panX(range: Range, delta: number): void {
    const next = panBy(range, delta);
    this.xViewRangeProperty.value = this.logXProperty.value ? limitLogRange(next) : next;
  }

  public panY(range: Range, delta: number): void {
    const next = panBy(range, delta);
    this.yViewRangeProperty.value = this.logYProperty.value ? limitLogRange(next) : next;
  }

  /** Frames the selected range, with the y axis fitted to the points inside it. */
  public zoomToRange(range: XRange): void {
    const log = this.logXProperty.value;
    const min = log && range.min <= 0 ? this.xAxisRangeProperty.value.min : axisCoordinate(range.min, log);
    const max = axisCoordinate(range.max, log);
    if (!Number.isFinite(max) || min > max) {
      return;
    }
    const next = paddedRange(min, max, ZOOM_PADDING);
    this.xViewRangeProperty.value = log ? limitLogRange(next) : next;
    this.yViewRangeProperty.value = null;
  }

  /** Returns both axes to automatic. */
  public autoScale(): void {
    this.xViewRangeProperty.value = null;
    this.yViewRangeProperty.value = null;
  }
}
