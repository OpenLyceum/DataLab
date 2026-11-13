/**
 * PlotNode.ts
 *
 * The main graph: the chosen y column against the chosen x column, the fitted
 * curve, and the selected x range drawn as a band with a handle on each edge.
 *
 * Gestures: drag across the plot to mark a new range; drag an edge to resize it;
 * drag the band to move it. From the keyboard, Tab to an edge: ←/→ move it to the
 * neighbouring data point, Shift+←/→ move it a hundredth of the axis, Page Up/Down
 * move ten points, Home/End go to the ends of the data.
 *
 * The range lives in data units in the model, so zooming never changes which rows
 * are used.
 */

import { Multilink, type TReadOnlyProperty } from "scenerystack/axon";
import { clamp, Matrix3, type Range } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { DragListener, KeyboardListener, Line, Node, Path, Rectangle } from "scenerystack/scenery";
import { columnLabel } from "../../common/model/Dataset.js";
import { evaluateFit } from "../../common/model/leastSquares.js";
import { ChartFrameNode, paddedRange } from "../../common/view/ChartFrameNode.js";
import { PointsCanvasNode } from "../../common/view/PointsCanvasNode.js";
import DataLabColors from "../../DataLabColors.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";

/** Samples along the fitted curve; plenty for a parabola across a few hundred pixels. */
const CURVE_SAMPLES = 120;

/** Fraction of the y extent left empty above and below the points. */
const Y_PADDING = 0.08;

/** Half-width of the invisible strip that makes an edge easy to grab, mouse or finger. */
const HANDLE_HALF_WIDTH = 11;
const HANDLE_GRIP_RADIUS = 6;

/** Keyboard steps. */
const FINE_STEP_FRACTION = 0.01;
const PAGE_POINTS = 10;

export type PlotNodeOptions = {
  readonly viewWidth: number;
  readonly viewHeight: number;
};

export class PlotNode extends Node {
  public readonly frame: ChartFrameNode;
  public readonly rangeStartHandle: Node;
  public readonly rangeEndHandle: Node;

  public constructor(model: DataLabModel, xAxisRangeProperty: TReadOnlyProperty<Range>, options: PlotNodeOptions) {
    super();
    const { viewWidth, viewHeight } = options;
    const a11y = StringManager.getInstance().getDataLabA11yStrings();

    const frame = new ChartFrameNode({ viewWidth, viewHeight, showXTickLabels: false });
    this.frame = frame;
    frame.chartRectangle.cursor = "crosshair";
    const chartTransform = frame.chartTransform;

    const points = new PointsCanvasNode(chartTransform, viewWidth, viewHeight);
    const fitCurve = new Path(null, {
      stroke: DataLabColors.fitLineColorProperty,
      lineWidth: 2,
      pickable: false,
    });
    const band = new Rectangle(0, 0, 1, viewHeight, {
      fill: DataLabColors.rangeBandColorProperty,
      cursor: "grab",
    });
    frame.plotLayer.addChild(band);
    frame.plotLayer.addChild(points);
    frame.plotLayer.addChild(fitCurve);

    const xFromPointer = (globalPoint: { x: number; y: number }): number => {
      const viewX = clamp(frame.plotLayer.globalToLocalPoint(globalPoint as never).x, 0, viewWidth);
      return chartTransform.viewToModelX(viewX);
    };

    // ── Edge handles ─────────────────────────────────────────────────────────
    const createHandle = (accessibleName: TReadOnlyProperty<string>, isStart: boolean) => {
      const handle = new Node({
        cursor: "ew-resize",
        tagName: "div",
        focusable: true,
        accessibleName,
        accessibleHelpText: a11y.controls.rangeHelpStringProperty,
        children: [
          new Rectangle(-HANDLE_HALF_WIDTH, 0, 2 * HANDLE_HALF_WIDTH, viewHeight, { fill: "transparent" }),
          new Line(0, 0, 0, viewHeight, { stroke: DataLabColors.fitLineColorProperty, lineWidth: 2 }),
          new Path(Shape.regularPolygon(3, HANDLE_GRIP_RADIUS).transformed(Matrix3.rotation2(Math.PI / 2)), {
            fill: DataLabColors.fitLineColorProperty,
            y: HANDLE_GRIP_RADIUS - 2,
          }),
        ],
      });

      // The bound this handle does not own stays put for the whole gesture, so the
      // two edges can cross without the drag jumping to the other one.
      let anchor = 0;
      handle.addInputListener(
        new DragListener({
          start: () => {
            const range = model.rangeProperty.value;
            anchor = range ? (isStart ? range.max : range.min) : 0;
          },
          drag: (event) => model.setRange(anchor, xFromPointer(event.pointer.point)),
        }),
      );

      const moveTo = (x: number) => {
        const range = model.rangeProperty.value;
        if (range) {
          model.setRange(isStart ? range.max : range.min, x);
        }
      };
      handle.addInputListener(
        new KeyboardListener({
          keys: ["arrowLeft", "arrowRight", "shift+arrowLeft", "shift+arrowRight", "pageUp", "pageDown", "home", "end"],
          fireOnHold: true,
          fire: (_event, keysPressed) => {
            const range = model.rangeProperty.value;
            const values = model.distinctXValues();
            if (!range || values.length === 0) {
              return;
            }
            const current = isStart ? range.min : range.max;
            const first = values[0] as number;
            const last = values[values.length - 1] as number;
            // Index of the data point `count` places to the right (or left) of the edge.
            const stepPoints = (count: number): number => {
              if (count > 0) {
                const next = values.findIndex((value) => value > current);
                return next === -1 ? last : (values[Math.min(next + count - 1, values.length - 1)] as number);
              }
              const previous = values.findLastIndex((value) => value < current);
              return previous === -1 ? first : (values[Math.max(previous + count + 1, 0)] as number);
            };
            const fineStep = xAxisRangeProperty.value.getLength() * FINE_STEP_FRACTION;
            switch (keysPressed) {
              case "arrowLeft":
                moveTo(stepPoints(-1));
                break;
              case "arrowRight":
                moveTo(stepPoints(1));
                break;
              case "shift+arrowLeft":
                moveTo(current - fineStep);
                break;
              case "shift+arrowRight":
                moveTo(current + fineStep);
                break;
              case "pageDown":
                moveTo(stepPoints(-PAGE_POINTS));
                break;
              case "pageUp":
                moveTo(stepPoints(PAGE_POINTS));
                break;
              case "home":
                moveTo(first);
                break;
              case "end":
                moveTo(last);
                break;
              default:
                break;
            }
          },
        }),
      );
      return handle;
    };
    const rangeStartHandle = createHandle(a11y.controls.rangeStartStringProperty, true);
    const rangeEndHandle = createHandle(a11y.controls.rangeEndStringProperty, false);
    this.rangeStartHandle = rangeStartHandle;
    this.rangeEndHandle = rangeEndHandle;

    // ── Sweep a new range across empty plot area ──────────────────────────────
    let sweepStart = 0;
    frame.chartRectangle.addInputListener(
      new DragListener({
        start: (event) => {
          sweepStart = xFromPointer(event.pointer.point);
        },
        drag: (event) => model.setRange(sweepStart, xFromPointer(event.pointer.point)),
      }),
    );

    // ── Drag the band to move the whole range ─────────────────────────────────
    let grabOffset = 0;
    let grabWidth = 0;
    band.addInputListener(
      new DragListener({
        start: (event) => {
          const range = model.rangeProperty.value;
          if (range) {
            grabOffset = xFromPointer(event.pointer.point) - range.min;
            grabWidth = range.max - range.min;
          }
        },
        drag: (event) => {
          const min = xFromPointer(event.pointer.point) - grabOffset;
          model.setRange(min, min + grabWidth);
        },
      }),
    );

    this.children = [frame, rangeStartHandle, rangeEndHandle];

    // ── Updates ───────────────────────────────────────────────────────────────
    const updateRange = () => {
      const range = model.rangeProperty.value;
      band.visible = range !== null;
      // An edge scrolled out of view is not offered as a handle. Visibility is set
      // once per edge: hiding and re-showing a focused handle would drop its focus.
      const inView = (x: number) => x >= -1 && x <= viewWidth + 1;
      const x0 = range ? chartTransform.modelToViewX(range.min) : 0;
      const x1 = range ? chartTransform.modelToViewX(range.max) : 0;
      if (range) {
        band.setRect(x0, 0, Math.max(x1 - x0, 1), viewHeight);
        rangeStartHandle.x = x0;
        rangeEndHandle.x = x1;
      }
      rangeStartHandle.visible = range !== null && inView(x0);
      rangeEndHandle.visible = range !== null && inView(x1);
    };

    const updateCurve = () => {
      const fit = model.fitProperty.value;
      const xColumn = model.xColumnProperty.value;
      const indices = model.inclusionProperty.value.indices;
      if (!(fit.ok && xColumn) || indices.length === 0) {
        fitCurve.shape = null;
        return;
      }
      // The curve spans the points it was fitted to, and no further.
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const i of indices) {
        const x = xColumn.values[i] as number;
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
      const shape = new Shape();
      for (let k = 0; k <= CURVE_SAMPLES; k++) {
        const x = min + ((max - min) * k) / CURVE_SAMPLES;
        const viewX = chartTransform.modelToViewX(x);
        const viewY = chartTransform.modelToViewY(evaluateFit(fit.model, fit.parameters, x));
        if (k === 0) {
          shape.moveTo(viewX, viewY);
        } else {
          shape.lineTo(viewX, viewY);
        }
      }
      fitCurve.shape = shape;
    };

    const updateAxes = () => {
      const xColumn = model.xColumnProperty.value;
      const yColumn = model.yColumnProperty.value;
      const xRange = xAxisRangeProperty.value;
      const xs = xColumn?.values ?? [];
      const ys = yColumn?.values ?? [];

      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      const count = Math.min(xs.length, ys.length);
      for (let i = 0; i < count; i++) {
        const x = xs[i] as number;
        const y = ys[i] as number;
        if (Number.isFinite(x) && Number.isFinite(y) && x >= xRange.min && x <= xRange.max) {
          min = Math.min(min, y);
          max = Math.max(max, y);
        }
      }
      frame.setRanges(xRange, paddedRange(min, max, Y_PADDING));
      frame.yAxisLabel.string = yColumn ? columnLabel(yColumn) : "";
      points.setPoints(xs, ys, model.inclusionProperty.value.flags);
    };

    Multilink.multilink(
      [model.xColumnProperty, model.yColumnProperty, model.inclusionProperty, xAxisRangeProperty],
      () => {
        updateAxes();
        updateRange();
        updateCurve();
      },
    );
    model.rangeProperty.lazyLink(updateRange);
    model.fitProperty.lazyLink(updateCurve);
  }
}
