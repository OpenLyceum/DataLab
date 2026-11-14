import { includedRows, type XRange } from "./includedRows.js";
import { FitModel, fitModel } from "./leastSquares.js";

export function analyzeRange(
  xs: readonly number[],
  ys: readonly number[],
  range: XRange | null,
  excludedRows: readonly number[],
) {
  const { indices } = includedRows(xs, ys, range, excludedRows);
  const count = indices.length;
  if (!count) {
    return null;
  }

  const points = indices.map((i) => ({ x: xs[i] as number, y: ys[i] as number })).sort((a, b) => a.x - b.x);
  let mean = 0;
  let sumSquares = 0;
  let minimum = Infinity;
  let maximum = -Infinity;
  let area = 0;
  let previous: (typeof points)[number] | undefined;
  let hasWidth = false;
  // Average repeated x measurements before integrating so ordering within a tie has no effect.
  let group: (typeof points)[number] | undefined;
  let groupCount = 0;
  for (const [i, point] of points.entries()) {
    const delta = point.y - mean;
    mean += delta / (i + 1);
    sumSquares += delta * (point.y - mean);
    minimum = Math.min(minimum, point.y);
    maximum = Math.max(maximum, point.y);
    if (group && group.x !== point.x) {
      if (previous) {
        area += (group.x - previous.x) * (previous.y / 2 + group.y / 2);
      }
      previous = group;
      group = undefined;
    }
    if (group) {
      groupCount++;
      group.y += (point.y - group.y) / groupCount;
    } else {
      group = { ...point };
      groupCount = 1;
    }
  }
  if (previous && group) {
    area += (group.x - previous.x) * (previous.y / 2 + group.y / 2);
    hasWidth = true;
  }
  const linear = fitModel(
    FitModel.LINEAR,
    points.map((point) => point.x),
    points.map((point) => point.y),
  );
  return {
    count,
    minimum,
    maximum,
    mean,
    standardDeviation: count > 1 ? Math.sqrt(Math.max(0, sumSquares) / (count - 1)) : null,
    slope: linear.ok ? (linear.parameters[0] ?? null) : null,
    area: hasWidth ? area : null,
  };
}
