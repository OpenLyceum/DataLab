/**
 * axisRange.ts
 *
 * Arithmetic for zooming and panning one axis of a graph. Each function returns a
 * new Range and leaves its argument alone.
 */

import { Range } from "scenerystack/dot";
import { AXIS } from "../../DataLabConstants.js";

/** Zoom per wheel notch: the visible span shrinks or grows by this factor. */
export const WHEEL_ZOOM_FACTOR = AXIS.WHEEL_ZOOM_FACTOR;

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
  if (!(Number.isFinite(min) && Number.isFinite(max)) || span <= magnitude * AXIS.MIN_RELATIVE_SPAN || span <= 0) {
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
    const halfWidth = min === 0 ? 1 : Math.abs(min) * AXIS.ZERO_SPAN_HALF_FRACTION;
    return new Range(min - halfWidth, max + halfWidth);
  }
  const padding = (max - min) * fraction;
  return new Range(min - padding, max + padding);
}

/** Graph coordinates for a base-10 axis. Nonpositive measurements cannot be drawn. */
export function axisCoordinate(value: number, logarithmic: boolean): number {
  return logarithmic && value <= 0 ? Number.NaN : logarithmic ? Math.log10(value) : value;
}

const LOG_MIN = Math.log10(Number.MIN_VALUE);
const LOG_MAX = Math.log10(Number.MAX_VALUE);

export function axisValue(coordinate: number, logarithmic: boolean): number {
  if (!logarithmic) {
    return coordinate;
  }
  return coordinate >= LOG_MAX ? Number.MAX_VALUE : 10 ** Math.max(LOG_MIN, coordinate);
}

export function limitLogRange(range: Range): Range {
  const min = Math.max(LOG_MIN, range.min);
  const max = Math.min(LOG_MAX, range.max);
  return min < max ? new Range(min, max) : new Range(0, 1);
}
