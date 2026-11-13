/**
 * GraphGestures.ts
 *
 * Zoom and pan for a graph built on ChartFrameNode:
 *
 *   wheel over the plot          zoom about the cursor (both axes, or x alone)
 *   wheel over an axis strip     zoom that axis alone
 *   drag an axis strip           pan that axis
 *   two fingers on the plot      pinch to zoom, move both fingers to pan
 *
 * A plain one-finger or mouse drag on the plot is left to the caller — in Data Lab
 * it selects a range of x.
 */

import type { Range } from "scenerystack/dot";
import { DragListener, type Node, type Pointer, type TInputListener } from "scenerystack/scenery";
import { WHEEL_ZOOM_FACTOR } from "./axisRange.js";
import type { ChartFrameNode } from "./ChartFrameNode.js";

/** What the gestures act on; implemented by Data Lab's GraphView. */
export type ZoomPanTarget = {
  readonly xAxisRangeProperty: { readonly value: Range };
  readonly yAxisRangeProperty: { readonly value: Range };
  zoomX(factor: number, anchor: number): void;
  zoomY(factor: number, anchor: number): void;
  panX(range: Range, delta: number): void;
  panY(range: Range, delta: number): void;
};

export type GraphGesturesOptions = {
  /** False for a graph whose y axis is always automatic: wheel and pinch then act on x alone. */
  readonly zoomsY: boolean;
  /** Called when a second finger lands, so the caller can abandon a one-finger gesture. */
  readonly onPinchStart?: () => void;
};

type Point = { readonly x: number; readonly y: number };

/**
 * Installs the gestures. `eventNode` is the node whose subtree covers the graph —
 * wheel and touch events bubble up to it from whatever was hit.
 */
export function installGraphGestures(
  frame: ChartFrameNode,
  eventNode: Node,
  target: ZoomPanTarget,
  options: GraphGesturesOptions,
): void {
  const { viewWidth, viewHeight, chartTransform } = frame;
  const localPoint = (pointer: Pointer): Point => frame.globalToLocalPoint(pointer.point);

  // Data units per pixel, from a given range.
  const xPerPixel = (range: Range) => range.getLength() / viewWidth;
  const yPerPixel = (range: Range) => range.getLength() / viewHeight;

  // ── Wheel ───────────────────────────────────────────────────────────────────
  eventNode.addInputListener({
    wheel: (event) => {
      const deltaY = event.domEvent?.deltaY;
      if (!deltaY) {
        return;
      }
      event.handle();
      const factor = deltaY < 0 ? 1 / WHEEL_ZOOM_FACTOR : WHEEL_ZOOM_FACTOR;
      const point = localPoint(event.pointer);
      const overYAxis = point.x < 0;
      const overXAxis = point.y > viewHeight;
      if (!overYAxis) {
        target.zoomX(factor, chartTransform.viewToModelX(Math.min(Math.max(point.x, 0), viewWidth)));
      }
      if (options.zoomsY && !overXAxis) {
        target.zoomY(factor, chartTransform.viewToModelY(Math.min(Math.max(point.y, 0), viewHeight)));
      }
    },
  });

  // ── Drag an axis strip to pan ───────────────────────────────────────────────
  let dragStart: Point = { x: 0, y: 0 };
  let startXRange = target.xAxisRangeProperty.value;
  let startYRange = target.yAxisRangeProperty.value;
  frame.xAxisStrip.addInputListener(
    new DragListener({
      start: (event) => {
        dragStart = localPoint(event.pointer);
        startXRange = target.xAxisRangeProperty.value;
      },
      // Dragging right pulls the data right, so the axis shows smaller values.
      drag: (event) => target.panX(startXRange, -(localPoint(event.pointer).x - dragStart.x) * xPerPixel(startXRange)),
    }),
  );
  if (options.zoomsY) {
    frame.yAxisStrip.addInputListener(
      new DragListener({
        start: (event) => {
          dragStart = localPoint(event.pointer);
          startYRange = target.yAxisRangeProperty.value;
        },
        drag: (event) => target.panY(startYRange, (localPoint(event.pointer).y - dragStart.y) * yPerPixel(startYRange)),
      }),
    );
  } else {
    frame.yAxisStrip.pickable = false;
  }

  // ── Two fingers: pinch to zoom, move to pan ─────────────────────────────────
  // While a pinch is under way both pointers are *attached* to `pinchListener`.
  // That keeps every other listener off them (a DragListener would otherwise snag
  // a finger sliding over it, and the sim's own pan-zoom would join in), and it
  // delivers their moves and releases wherever on the page they happen.
  const touches = new Map<Pointer, Point>();
  let pinch: { distance: number; middle: Point; anchorX: number; anchorY: number } | null = null;

  const twoPoints = (): [Point, Point] | null => {
    const [a, b] = [...touches.values()];
    return a && b && touches.size === 2 ? [a, b] : null;
  };

  const endPinch = () => {
    if (pinch) {
      pinch = null;
      for (const pointer of touches.keys()) {
        if (pointer.attachedListener === pinchListener) {
          pointer.removeInputListener(pinchListener);
        }
      }
      touches.clear();
    }
  };

  const pinchListener: TInputListener = {
    move: (event) => {
      if (!touches.has(event.pointer)) {
        return;
      }
      touches.set(event.pointer, localPoint(event.pointer));
      const points = twoPoints();
      if (!(points && pinch && pinch.distance > 0)) {
        return;
      }
      const [a, b] = points;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance === 0) {
        return;
      }
      // Zoom about the point that was between the fingers, then slide it to where
      // the middle of the fingers is now.
      const factor = pinch.distance / distance;
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      target.panX(startXRange, 0);
      target.zoomX(factor, pinch.anchorX);
      const zoomedX = target.xAxisRangeProperty.value;
      target.panX(zoomedX, -(middle.x - pinch.middle.x) * xPerPixel(zoomedX));
      if (options.zoomsY) {
        target.panY(startYRange, 0);
        target.zoomY(factor, pinch.anchorY);
        const zoomedY = target.yAxisRangeProperty.value;
        target.panY(zoomedY, (middle.y - pinch.middle.y) * yPerPixel(zoomedY));
      }
    },
    up: endPinch,
    cancel: endPinch,
    interrupt: endPinch,
  };

  eventNode.addInputListener({
    down: (event) => {
      if (event.pointer.type !== "touch" || pinch) {
        return;
      }
      // Forget a first finger that has since lifted.
      for (const pointer of touches.keys()) {
        if (!pointer.isDown) {
          touches.delete(pointer);
        }
      }
      touches.set(event.pointer, localPoint(event.pointer));
      const points = twoPoints();
      if (!points) {
        return;
      }
      // Whatever the first finger was doing (sweeping a range, say) gives way.
      options.onPinchStart?.();
      for (const pointer of touches.keys()) {
        pointer.attachedListener?.interrupt?.();
        pointer.addInputListener(pinchListener, true);
      }
      const [a, b] = points;
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      startXRange = target.xAxisRangeProperty.value;
      startYRange = target.yAxisRangeProperty.value;
      pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        middle,
        anchorX: chartTransform.viewToModelX(middle.x),
        anchorY: chartTransform.viewToModelY(middle.y),
      };
    },
  });
}
