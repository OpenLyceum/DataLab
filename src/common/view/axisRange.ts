/**
 * axisRange.ts
 *
 * Arithmetic for zooming and panning one axis of a graph. Each function returns a
 * new Range and leaves its argument alone.
 */

import { Range } from "scenerystack/dot";

/** Zoom per wheel notch: the visible span shrinks or grows by this factor. */
export const WHEEL_ZOOM_FACTOR = 1.1;

/**
 * Narrowest span worth showing, relative to the size of the numbers on the axis.
 * Below it, neighbouring tick values are no longer distinct doubles.
 */
const MIN_RELATIVE_SPAN = 1e-9;

/**
 * Scales a range by `factor` (below 1 zooms in) keeping the value `anchor` at the
 * same place on screen. A zoom that would make the range degenerate is refused and
 * the range comes back unchanged.
 */
export function zoomAbout(range: Range, factor: number, anchor: number): Range {
  const min = anchor - (anchor - range.min) * factor;
  const max = anchor + (range.max - anchor) * factor;
  const span = max - min;
  const magnitude = Math.max(Math.abs(min), Math.abs(max));
  if (!(Number.isFinite(min) && Number.isFinite(max)) || span <= magnitude * MIN_RELATIVE_SPAN || span <= 0) {
    return range;
  }
  return new Range(min, max);
}

/** Shifts a range by `delta` in data units. */
export function panBy(range: Range, delta: number): Range {
  const min = range.min + delta;
  const max = range.max + delta;
  return Number.isFinite(min) && Number.isFinite(max) ? new Range(min, max) : range;
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
