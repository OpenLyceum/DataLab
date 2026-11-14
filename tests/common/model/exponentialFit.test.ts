import { expect, test } from "vitest";
import { evaluateFit, FitFailureReason, FitModel, fitModel } from "../../../src/common/model/leastSquares.js";

const xs = [0, 1, 2, 3, 4, 5];
const ys = [4, 2.8, 1.7, 0.9, 0.75, 0.4];

// Independent reference: scipy.optimize.curve_fit with analytic Jacobian,
// using absolute_sigma=True in the weighted case.
test.each([
  { sigma: undefined, expected: [4.0796478995240815, -0.4428709902358933, 0.12806033742102643, 0.02591262421078574] },
  {
    sigma: [0.2, 0.4, 0.25, 0.2, 0.6, 0.3],
    expected: [4.033435771592416, -0.4585408386488275, 0.19543250651077543, 0.04905727820724213],
  },
])("matches independent exponential fit and covariance with uncertainty column $sigma", ({ sigma, expected }) => {
  const fit = fitModel(FitModel.EXPONENTIAL, xs, ys, sigma);
  expect(fit.ok).toBe(true);
  if (fit.ok) {
    expect(fit.parameters[0]).toBeCloseTo(expected[0] as number, 7);
    expect(fit.parameters[1]).toBeCloseTo(expected[1] as number, 7);
    expect(fit.standardErrors?.[0]).toBeCloseTo(expected[2] as number, 7);
    expect(fit.standardErrors?.[1]).toBeCloseTo(expected[3] as number, 7);
    if (sigma) {
      expect(fit.reducedChiSquared).toBeCloseTo(0.9290244772383569 / 4, 8);
    } else {
      expect(fit.reducedChiSquared).toBeNull();
    }
  }
});

test("fits negative growth with a large x offset and handles degenerate data", () => {
  const timestamps = xs.map((x) => x + 1e9);
  const fit = fitModel(
    FitModel.EXPONENTIAL,
    timestamps,
    xs.map((x) => -2 * Math.exp(0.4 * x)),
  );
  expect(fit.ok).toBe(true);
  if (fit.ok) {
    expect(fit.parameters[0]).toBeCloseTo(-2, 10);
    expect(fit.parameters[1]).toBeCloseTo(0.4, 10);
    expect(evaluateFit(fit.model, fit.parameters, 1e9 + 2)).toBeCloseTo(-2 * Math.exp(0.8), 10);
  }
  expect(fitModel(FitModel.EXPONENTIAL, [1, 1], [2, 3])).toMatchObject({
    ok: false,
    reason: FitFailureReason.TOO_FEW_DISTINCT_X,
  });
  expect(
    fitModel(
      FitModel.EXPONENTIAL,
      xs,
      xs.map(() => 0),
    ),
  ).toMatchObject({ ok: false, reason: FitFailureReason.NONLINEAR_FAILURE });
});
