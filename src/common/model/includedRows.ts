/**
 * includedRows.ts
 *
 * Decides which rows a fit uses. Pure, no SceneryStack imports.
 *
 * A row is included when its x and y are both numbers and its x lies in the
 * selected range, bounds included, unless excluded manually. With no range every
 * valid, non-excluded row is included.
 * Rows need not be sorted by x, so the result is a list of row indices rather
 * than a first and last row.
 */

import { type FitModelValue, supportsFitX } from "./leastSquares.js";

/** A selected x interval in data units. `min` ≤ `max`. */
export type XRange = {
  readonly min: number;
  readonly max: number;
};

export type Inclusion = {
  /** Indices of the rows used, in table order. */
  readonly indices: readonly number[];
  /** One flag per row: true when the row is used. */
  readonly flags: readonly boolean[];
  /** Rows left out because x or y is blank or not a number. */
  readonly skippedCount: number;
  readonly unsupportedCount: number;
  /** Rows with a numeric x and y, whether or not they are in range. */
  readonly validCount: number;
};

/** Orders two bounds, so a selection dragged right-to-left still reads min ≤ max. */
export function orderedRange(a: number, b: number): XRange {
  return a <= b ? { min: a, max: b } : { min: b, max: a };
}

export function includedRows(
  xs: readonly number[],
  ys: readonly number[],
  range: XRange | null,
  excludedRows: readonly number[] = [],
  model?: FitModelValue,
): Inclusion {
  const excluded = new Set(excludedRows);
  const rowCount = Math.min(xs.length, ys.length);
  const indices: number[] = [];
  const flags: boolean[] = new Array<boolean>(rowCount).fill(false);
  let skippedCount = 0;
  let unsupportedCount = 0;
  for (let i = 0; i < rowCount; i++) {
    const x = xs[i] as number;
    const y = ys[i] as number;
    if (!(Number.isFinite(x) && Number.isFinite(y))) {
      skippedCount++;
    } else if (!excluded.has(i) && (range === null || (x >= range.min && x <= range.max))) {
      if (model && !supportsFitX(model, x)) {
        unsupportedCount++;
        continue;
      }
      indices.push(i);
      flags[i] = true;
    }
  }
  return { indices, flags, skippedCount, unsupportedCount, validCount: rowCount - skippedCount };
}
