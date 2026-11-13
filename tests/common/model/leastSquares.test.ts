/**
 * leastSquares.test.ts
 *
 * Checks the fit engine against NIST's certified values (tests/fixtures/nist) and
 * exercises every way a fit can fail.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateFit,
  FitFailureReason,
  FitModel,
  type FitModelValue,
  type FitSuccess,
  fitModel,
} from "../../../src/common/model/leastSquares.js";

type NistDataset = {
  readonly xs: number[];
  readonly ys: number[];
  /** Certified estimates B0, B1, … in ascending power of x. */
  readonly estimates: number[];
  readonly standardDeviations: number[];
  readonly residualStandardDeviation: number;
  readonly rSquared: number;
};

function loadNist(name: string): NistDataset {
  const lines = readFileSync(resolve(process.cwd(), "tests/fixtures/nist", `${name}.dat`), "utf8").split(/\r?\n/);
  const estimates: number[] = [];
  const standardDeviations: number[] = [];
  let residualStandardDeviation = Number.NaN;
  let rSquared = Number.NaN;
  const xs: number[] = [];
  const ys: number[] = [];
  let inData = false;
  for (const line of lines) {
    const parameter = /^\s+B\d\s+(\S+)\s+(\S+)\s*$/.exec(line);
    const deviation = /^\s+Standard Deviation\s+(\S+)\s*$/.exec(line);
    const r2 = /^\s+R-Squared\s+(\S+)\s*$/.exec(line);
    if (parameter) {
      estimates.push(Number(parameter[1]));
      standardDeviations.push(Number(parameter[2]));
    } else if (deviation) {
      residualStandardDeviation = Number(deviation[1]);
    } else if (r2) {
      rSquared = Number(r2[1]);
    } else if (/^Data:\s+y\s+x\s*$/.test(line)) {
      inData = true;
    } else if (inData && line.trim() !== "") {
      const [y, x] = line.trim().split(/\s+/).map(Number);
      ys.push(y as number);
      xs.push(x as number);
    }
  }
  return { xs, ys, estimates, standardDeviations, residualStandardDeviation, rSquared };
}

/** Agreement to nine significant digits. */
function expectClose(actual: number, certified: number): void {
  expect(Math.abs(actual - certified)).toBeLessThanOrEqual(1e-9 * Math.abs(certified));
}

function fitNist(model: FitModelValue, data: NistDataset): FitSuccess {
  const fit = fitModel(model, data.xs, data.ys);
  if (!fit.ok) {
    throw new Error(`fit failed: ${fit.reason}`);
  }
  // NIST lists B0 first; the engine reports the highest power first.
  const estimates = [...data.estimates].reverse();
  const deviations = [...data.standardDeviations].reverse();
  expect(fit.parameters).toHaveLength(estimates.length);
  fit.parameters.forEach((value, j) => {
    expectClose(value, estimates[j] as number);
  });
  (fit.standardErrors as number[]).forEach((value, j) => {
    expectClose(value, deviations[j] as number);
  });
  expectClose(fit.rmse as number, data.residualStandardDeviation);
  return fit;
}

describe("fitModel against NIST StRD certified values", () => {
  it("linear: Norris", () => {
    const data = loadNist("Norris");
    expect(data.xs).toHaveLength(36);
    const fit = fitNist(FitModel.LINEAR, data);
    expectClose(fit.rSquared as number, data.rSquared);
  });

  it("quadratic: Pontius", () => {
    const data = loadNist("Pontius");
    expect(data.xs).toHaveLength(40);
    const fit = fitNist(FitModel.QUADRATIC, data);
    expectClose(fit.rSquared as number, data.rSquared);
  });

  it("proportional: NoInt1", () => {
    const data = loadNist("NoInt1");
    expect(data.xs).toHaveLength(11);
    const fit = fitNist(FitModel.PROPORTIONAL, data);
    expect(fit.rSquared).toBeNull();
  });

  it("proportional: NoInt2", () => {
    const data = loadNist("NoInt2");
    expect(data.xs).toHaveLength(3);
    fitNist(FitModel.PROPORTIONAL, data);
  });
});

describe("fitModel", () => {
  it("recovers an exact quadratic and reports zero residuals", () => {
    const xs = [-2, -1, 0, 1, 2, 3];
    const ys = xs.map((x) => 0.5 * x * x - 3 * x + 4);
    const fit = fitModel(FitModel.QUADRATIC, xs, ys) as FitSuccess;
    expect(fit.ok).toBe(true);
    expect(fit.parameters[0]).toBeCloseTo(0.5, 12);
    expect(fit.parameters[1]).toBeCloseTo(-3, 12);
    expect(fit.parameters[2]).toBeCloseTo(4, 12);
    expect(fit.sumSquaredResiduals).toBeLessThan(1e-24);
    expect(evaluateFit(FitModel.QUADRATIC, fit.parameters, 10)).toBeCloseTo(24, 9);
  });

  it("uses repeated x values as separate points", () => {
    const fit = fitModel(FitModel.LINEAR, [1, 1, 2, 2, 3, 3], [1.9, 2.1, 3.9, 4.1, 5.9, 6.1]) as FitSuccess;
    expect(fit.ok).toBe(true);
    expect(fit.count).toBe(6);
    expect(fit.parameters[0]).toBeCloseTo(2, 12);
    expect(fit.parameters[1]).toBeCloseTo(0, 12);
  });

  it("residuals sum to zero when the model has an intercept", () => {
    const xs = [0, 1, 2, 3, 4, 5, 6];
    const ys = [0.1, 0.9, 2.3, 2.8, 4.4, 4.9, 6.2];
    for (const model of [FitModel.LINEAR, FitModel.QUADRATIC]) {
      const fit = fitModel(model, xs, ys) as FitSuccess;
      expect(Math.abs(fit.residuals.reduce((sum, r) => sum + r, 0))).toBeLessThan(1e-12);
    }
  });

  it("fits exactly through n = p points and reports no uncertainties", () => {
    const fit = fitModel(FitModel.LINEAR, [1, 3], [2, 8]) as FitSuccess;
    expect(fit.ok).toBe(true);
    expect(fit.parameters[0]).toBeCloseTo(3, 12);
    expect(fit.parameters[1]).toBeCloseTo(-1, 12);
    expect(fit.degreesOfFreedom).toBe(0);
    expect(fit.standardErrors).toBeNull();
    expect(fit.rmse).toBeNull();
    expect(fit.rSquared).toBeNull();
  });

  it("reports no R² when y is constant", () => {
    const fit = fitModel(FitModel.LINEAR, [1, 2, 3, 4], [5, 5, 5, 5]) as FitSuccess;
    expect(fit.ok).toBe(true);
    expect(fit.parameters[0]).toBeCloseTo(0, 12);
    expect(fit.rSquared).toBeNull();
  });

  it("fails with too few points", () => {
    expect(fitModel(FitModel.QUADRATIC, [1, 2], [1, 2])).toMatchObject({
      ok: false,
      reason: FitFailureReason.TOO_FEW_POINTS,
      required: 3,
      count: 2,
    });
    expect(fitModel(FitModel.PROPORTIONAL, [], [])).toMatchObject({
      ok: false,
      reason: FitFailureReason.TOO_FEW_POINTS,
    });
  });

  it("fails when x has too few distinct values", () => {
    expect(fitModel(FitModel.LINEAR, [2, 2, 2, 2], [1, 2, 3, 4])).toMatchObject({
      ok: false,
      reason: FitFailureReason.TOO_FEW_DISTINCT_X,
    });
    expect(fitModel(FitModel.QUADRATIC, [1, 1, 2, 2, 1], [1, 2, 3, 4, 5])).toMatchObject({
      ok: false,
      reason: FitFailureReason.TOO_FEW_DISTINCT_X,
    });
  });

  it("fails a proportional fit when every x is zero", () => {
    expect(fitModel(FitModel.PROPORTIONAL, [0, 0, 0], [1, 2, 3])).toMatchObject({
      ok: false,
      reason: FitFailureReason.ALL_X_ZERO,
    });
  });
});
