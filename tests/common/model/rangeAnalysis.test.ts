import { expect, test } from "vitest";
import { analyzeRange } from "../../../src/common/model/rangeAnalysis.js";

test("range statistics omit excluded rows and integrate sorted, averaged samples", () => {
  const result = analyzeRange([3, 1, 2, 2, 0, 3], [7, 1, 2, 4, 99, 50], { min: 1, max: 3 }, [5]);
  expect(result).toMatchObject({ count: 4, minimum: 1, maximum: 7, mean: 3.5, area: 7 });
  expect(result?.slope).toBeCloseTo(3);
  expect(result?.standardDeviation).toBeCloseTo(Math.sqrt(7));
});

test("reports undefined statistics for zero or one observation", () => {
  expect(analyzeRange([1], [2], { min: 0, max: 0.5 }, [])).toBeNull();
  expect(analyzeRange([1], [2], null, [])).toMatchObject({
    count: 1,
    standardDeviation: null,
    slope: null,
    area: null,
  });
});
