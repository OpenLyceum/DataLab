import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { exportCsv } from "../../../src/common/model/exportCsv.js";
import { includedRows } from "../../../src/common/model/includedRows.js";
import { FitModel, type FitSuccess, fitModel } from "../../../src/common/model/leastSquares.js";
import { parseTable } from "../../../src/common/model/parseTable.js";

const sampleCsv = readFileSync(resolve(process.cwd(), "src/data-lab/model/samples/cart-ramp-then-level.csv"), "utf8");

function fitSample(model: (typeof FitModel)[keyof typeof FitModel], min: number, max: number) {
  const { dataset } = parseTable(sampleCsv);
  const xs = dataset.columns[0]?.values ?? [];
  const ys = dataset.columns[1]?.values ?? [];
  const inclusion = includedRows(xs, ys, { min, max });
  const fit = fitModel(
    model,
    inclusion.indices.map((i) => xs[i] as number),
    inclusion.indices.map((i) => ys[i] as number),
  ) as FitSuccess;
  return { dataset, inclusion, fit };
}

describe("the bundled sample dataset", () => {
  it("has 61 rows of time and position", () => {
    const { dataset } = parseTable(sampleCsv);
    expect(dataset.rowCount).toBe(61);
    expect(dataset.columns.map((c) => [c.name, c.unit])).toEqual([
      ["Time", "s"],
      ["Position", "m"],
    ]);
  });

  it("gives the ramp's acceleration from a quadratic over 0–1.5 s", () => {
    const { fit, inclusion } = fitSample(FitModel.QUADRATIC, 0, 1.5);
    expect(inclusion.indices).toHaveLength(31);
    // x = ½·a·t² with a = 0.60 m/s², so A = 0.30 m/s².
    expect(Math.abs((fit.parameters[0] as number) - 0.3)).toBeLessThan(3 * (fit.standardErrors?.[0] as number));
    expect(fit.rmse as number).toBeLessThan(0.004);
  });

  it("gives the level-track speed from a line over 1.5–3 s", () => {
    const { fit, inclusion } = fitSample(FitModel.LINEAR, 1.5, 3);
    expect(inclusion.indices).toHaveLength(31);
    expect(Math.abs((fit.parameters[0] as number) - 0.9)).toBeLessThan(3 * (fit.standardErrors?.[0] as number));
    expect(fit.rmse as number).toBeLessThan(0.004);
  });

  it("fits badly with one line over both regimes", () => {
    const { fit } = fitSample(FitModel.LINEAR, 0, 3);
    // The residual scatter is far above the 2 mm measurement noise: the model is wrong.
    expect(fit.rmse as number).toBeGreaterThan(0.05);
  });
});

describe("exportCsv", () => {
  it("adds in_fit, fit_value and residual columns", () => {
    const { dataset, inclusion, fit } = fitSample(FitModel.LINEAR, 1.5, 3);
    const lines = exportCsv(dataset, { xColumnIndex: 0, inclusion, fit }).trim().split("\n");
    expect(lines[0]).toBe("Time (s),Position (m),in_fit,fit_value,residual");
    expect(lines).toHaveLength(62);
    // Row 1 (t = 0) is outside the range: flagged 0, fit value given, no residual.
    expect(lines[1]).toMatch(/^0,-0\.0027,0,-?[\d.e-]+,$/);
    // The last row is inside: its residual is y − fit_value.
    const cells = (lines[61] as string).split(",").map(Number);
    expect(cells[2]).toBe(1);
    expect(cells[4]).toBeCloseTo((cells[1] as number) - (cells[3] as number), 12);
  });

  it("re-imports to the same data", () => {
    const { dataset } = parseTable('"Mass, hanging (kg)";Note\n0,05;ok\n0,10;"a;b"\n;\n');
    const reimported = parseTable(exportCsv(dataset, null)).dataset;
    expect(reimported.columns.map((c) => [c.name, c.unit])).toEqual(dataset.columns.map((c) => [c.name, c.unit]));
    expect(reimported.columns[0]?.values).toEqual(dataset.columns[0]?.values);
    expect(reimported.columns[1]?.texts).toEqual(dataset.columns[1]?.texts);
  });
});
