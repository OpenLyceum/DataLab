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
import { paddedRange, panBy, zoomAbout } from "../../common/view/axisRange.js";
import { X_AXIS_PADDING, Y_AXIS_PADDING, ZOOM_PADDING } from "../../DataLabConstants.js";
import type { DataLabModel } from "../model/DataLabModel.js";

export class GraphView {
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
    /** Extent of `pick` over the rows with a numeric x and y, optionally only those with x in `within`. */
    const extent = (pick: "x" | "y", within: Range | null): Range => {
      const xs = model.xColumnProperty.value?.values ?? [];
      const ys = model.yColumnProperty.value?.values ?? [];
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      const count = Math.min(xs.length, ys.length);
      for (let i = 0; i < count; i++) {
        const x = xs[i] as number;
        const y = ys[i] as number;
        if (Number.isFinite(x) && Number.isFinite(y) && (within === null || (x >= within.min && x <= within.max))) {
          const value = pick === "x" ? x : y;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
      return paddedRange(min, max, pick === "x" ? X_AXIS_PADDING : Y_AXIS_PADDING);
    };

    this.xAxisRangeProperty = new DerivedProperty(
      [this.xViewRangeProperty, model.xColumnProperty, model.yColumnProperty],
      (viewRange) => viewRange ?? extent("x", null),
    );
    this.yAxisRangeProperty = new DerivedProperty(
      [this.yViewRangeProperty, this.xAxisRangeProperty, model.xColumnProperty, model.yColumnProperty],
      (viewRange, xRange) => viewRange ?? extent("y", xRange),
    );
    this.isAutoScaledProperty = new DerivedProperty(
      [this.xViewRangeProperty, this.yViewRangeProperty],
      (xRange, yRange) => xRange === null && yRange === null,
    );

    // A view set for one column means nothing for another.
    model.xColumnIndexProperty.lazyLink(() => this.autoScale());
    model.yColumnIndexProperty.lazyLink(() => {
      this.yViewRangeProperty.value = null;
    });
  }

  /** Zooms the x axis by `factor` (below 1 zooms in), keeping `anchor` in place. */
  public zoomX(factor: number, anchor: number): void {
    this.xViewRangeProperty.value = zoomAbout(this.xAxisRangeProperty.value, factor, anchor);
  }

  public zoomY(factor: number, anchor: number): void {
    this.yViewRangeProperty.value = zoomAbout(this.yAxisRangeProperty.value, factor, anchor);
  }

  /** Shows `range` shifted by `delta` data units on the x axis. */
  public panX(range: Range, delta: number): void {
    this.xViewRangeProperty.value = panBy(range, delta);
  }

  public panY(range: Range, delta: number): void {
    this.yViewRangeProperty.value = panBy(range, delta);
  }

  /** Frames the selected range, with the y axis fitted to the points inside it. */
  public zoomToRange(range: XRange): void {
    this.xViewRangeProperty.value = paddedRange(range.min, range.max, ZOOM_PADDING);
    this.yViewRangeProperty.value = null;
  }

  /** Returns both axes to automatic. */
  public autoScale(): void {
    this.xViewRangeProperty.value = null;
    this.yViewRangeProperty.value = null;
  }
}
