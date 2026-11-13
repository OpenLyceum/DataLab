import { describe, expect, it } from "vitest";
import { includedRows, orderedRange } from "../../../src/common/model/includedRows.js";

describe("includedRows", () => {
  it("includes every valid row when there is no range", () => {
    const result = includedRows([1, 2, 3], [4, 5, 6], null);
    expect(result.indices).toEqual([0, 1, 2]);
    expect(result.flags).toEqual([true, true, true]);
    expect(result.skippedCount).toBe(0);
    expect(result.validCount).toBe(3);
  });

  it("treats both bounds as inclusive", () => {
    expect(includedRows([0, 1, 2, 3, 4], [0, 0, 0, 0, 0], { min: 1, max: 3 }).indices).toEqual([1, 2, 3]);
  });

  it("handles x that is not sorted", () => {
    const result = includedRows([5, 1, 4, 2, 3], [0, 0, 0, 0, 0], { min: 2, max: 4 });
    expect(result.indices).toEqual([2, 3, 4]);
    expect(result.flags).toEqual([false, false, true, true, true]);
  });

  it("keeps repeated x values as separate rows", () => {
    expect(includedRows([1, 1, 2, 2], [1, 2, 3, 4], { min: 1, max: 1 }).indices).toEqual([0, 1]);
  });

  it("skips rows with a missing x or y and counts them", () => {
    const result = includedRows([1, Number.NaN, 3, 4], [1, 2, Number.NaN, 4], null);
    expect(result.indices).toEqual([0, 3]);
    expect(result.skippedCount).toBe(2);
    expect(result.validCount).toBe(2);
  });

  it("orders a range dragged right to left", () => {
    expect(orderedRange(3, 1)).toEqual({ min: 1, max: 3 });
    expect(orderedRange(1, 3)).toEqual({ min: 1, max: 3 });
  });
});
