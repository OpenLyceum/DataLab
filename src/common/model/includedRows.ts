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

import { type FitModelValue, supportsFitX, validUncertainty } from "./leastSquares.js";

/** A selected x interval in data units. `min` ≤ `max`. */
export type XRange = {
  readonly min: number;
  readonly max: number;
  readonly y?: XRange;
};

export type Inclusion = {
  /** Indices of the rows used, in table order. */
  readonly indices: readonly number[];
  /** One flag per row: true when the row is used. */
  readonly flags: readonly boolean[];
  /** Rows left out because x or y is blank or not a number. */
  readonly skippedCount: number;
  readonly unsupportedCount: number;
  readonly invalidUncertaintyCount: number;
  /** Rows with a numeric x and y, whether or not they are in range. */
  readonly validCount: number;
};

/** Orders two bounds, so a selection dragged right-to-left still reads min ≤ max. */
export function orderedRange(a: number, b: number): XRange {
  return a <= b ? { min: a, max: b } : { min: b, max: a };
}

function withinSelection(x: number, y: number, range: XRange | null): boolean {
  return (
    range === null ||
    (x >= range.min && x <= range.max && (range.y === undefined || (y >= range.y.min && y <= range.y.max)))
  );
}

export function includedRows(
  xs: readonly number[],
  ys: readonly number[],
  range: XRange | null,
  excludedRows: readonly number[] = [],
  model?: FitModelValue,
  uncertainties?: readonly number[],
): Inclusion {
  const excluded = new Set(excludedRows);
  const rowCount = Math.min(xs.length, ys.length);
  const indices: number[] = [];
  const flags: boolean[] = new Array<boolean>(rowCount).fill(false);
  let skippedCount = 0;
  let unsupportedCount = 0;
  let invalidUncertaintyCount = 0;
  for (let i = 0; i < rowCount; i++) {
    const x = xs[i] as number;
    const y = ys[i] as number;
    if (!(Number.isFinite(x) && Number.isFinite(y))) {
      skippedCount++;
    } else if (!excluded.has(i) && withinSelection(x, y, range)) {
      if (model && !supportsFitX(model, x)) {
        unsupportedCount++;
        continue;
      }
      if (uncertainties && !validUncertainty(uncertainties[i])) {
        invalidUncertaintyCount++;
        continue;
      }
      indices.push(i);
      flags[i] = true;
    }
  }
  return {
    indices,
    flags,
    skippedCount,
    unsupportedCount,
    invalidUncertaintyCount,
    validCount: rowCount - skippedCount,
  };
}
