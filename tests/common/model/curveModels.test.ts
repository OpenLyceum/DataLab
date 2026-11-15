import { describe, expect, it } from "vitest";
import { includedRows } from "../../../src/common/model/includedRows.js";
import {
  evaluateFit,
  FitFailureReason,
  type FitModelValue,
  fitModel,
  fitPole,
} from "../../../src/common/model/leastSquares.js";

const xs = Array.from({ length: 48 }, (_, i) => 0.45 + 0.17 * i + 0.024 * Math.sin(1.7 * i));
const noise = xs.map((_, i) => 0.015 * (Math.sin(2.3 * i) + 0.5 * Math.cos(1.19 * i)));
const sigmas = xs.map((_, i) => 0.022 + 0.006 * (i % 5));

// Independent scipy.optimize.curve_fit references (TRF, three-point Jacobian,
// ftol/xtol/gtol 1e-13). Gaussian uses absolute_sigma with the sigmas above.
const references = {
  quartic: [
    [0.08, -0.42, 0.37, -1.4, 2.7],
    [0.08004560548, -0.4208121013, 0.3749058333, -1.411498509, 2.708322512],
    [8.801081056e-5, 0.001574673248, 0.009491825202, 0.02193328887, 0.01552300529],
  ],
  power: [
    [-1.7, 1.65, 3.8],
    [-1.700594701, 1.649836497, 3.801677732],
    [0.001761902265, 0.0004759801327, 0.005298693759],
  ],
  powerNoOffset: [
    [2.6, -0.72],
    [2.601288815, -0.7204717891],
    [0.00324533175, 0.001406756851],
  ],
  shiftedInverse: [
    [2.2, -0.8, -1],
    [2.180059816, -0.7866605263, -0.9973300028],
    [0.04417784405, 0.02530459219, 0.006705476087],
  ],
  shiftedInverseSquare: [
    [-2.4, 3.61, 2.3],
    [-2.400127929, 3.609999045, 2.300887761],
    [0.000106748965, 2.041425171e-6, 0.001836138353],
  ],
  exponentialBackground: [
    [3.8, -0.72, -0.4],
    [3.806871504, -0.7216191519, -0.3992300217],
    [0.01530011727, 0.004241544041, 0.003056888335],
  ],
  inverseExponential: [
    [2.3, 0.62, -0.7],
    [2.294472672, 0.617800123, -0.6935337921],
    [0.01310931598, 0.005881773105, 0.01438197116],
  ],
  logarithmic: [
    [-1.6, 2.4],
    [-1.600427545, 2.400824317],
    [0.002436241798, 0.003599596283],
  ],
  sine: [
    [1.7, 3.44, -0.75, 0.5],
    [1.700228092, 3.439830854, -0.7491895707, 0.5002654744],
    [0.002576764526, 0.000647450837, 0.003330654256, 0.001826795785],
  ],
  dampedSine: [
    [2.1, 0.31, 3.24, 1.22, -0.4],
    [2.103913769, 0.3105725726, 3.240094213, 1.219191395, -0.399680212],
    [0.01243514495, 0.002305915958, 0.002019697137, 0.004689220004, 0.001870369457],
  ],
  sineSeries: [
    [2.57, 0.27, -0.4, 1.11, 0.54, 0.78, -1.17, 0.5],
    [2.570360974, 0.2701591827, -0.4015717141, 1.110905167, 0.5366374029, 0.7798855722, -1.174835497, 0.5000515825],
    [
      0.0003139159789, 0.002636128532, 0.01016929325, 0.002595302292, 0.003813704082, 0.002666481344, 0.005465728041,
      0.001900213232,
    ],
  ],
  gaussian: [
    [-3.1, 3.2, 0.67, 1.3],
    [-3.097558916, 3.199033982, 0.6693244777, 1.29936992],
    [0.01466631423, 0.003583465866, 0.003864347173, 0.005784777713],
  ],
} as const;

describe("expanded fit models", () => {
  for (const model of Object.keys(references) as (keyof typeof references)[]) {
    it(`agrees with SciPy for ${model}`, () => {
      const [generator, expected, errors] = references[model];
      const y = xs.map((x, i) => evaluateFit(model, generator, x) + (noise[i] as number));
      const fit = fitModel(model, xs, y, model === "gaussian" ? sigmas : undefined);
      expect(fit.ok).toBe(true);
      if (!fit.ok) {
        return;
      }
      expect(fit.degreesOfFreedom).toBe(xs.length - generator.length);
      expect(fit.parameters).toHaveLength(expected.length);
      for (const [i, value] of expected.entries()) {
        expect(fit.parameters[i]).toBeCloseTo(value, 5);
      }
      expect(fit.standardErrors).toHaveLength(errors.length);
      for (const [i, error] of errors.entries()) {
        expect(fit.standardErrors?.[i]).toBeGreaterThan(error * 0.995);
        expect(fit.standardErrors?.[i]).toBeLessThan(error * 1.005);
      }
      expect(fit.residuals).toEqual(
        y.map((value, i) => expect.closeTo(value - evaluateFit(model, fit.parameters, xs[i] as number), 7)),
      );
    });
  }

  it("requires positive x for logarithms and free real powers", () => {
    for (const model of ["logarithmic", "power", "powerNoOffset"] as const) {
      const x = [-1, 0, 1, 2, 3];
      const y = [2, 3, 4, 5, 6];
      expect(includedRows(x, y, null, [], model)).toMatchObject({ indices: [2, 3, 4], unsupportedCount: 2 });
      expect(fitModel(model, x, y)).toMatchObject({ ok: false, reason: FitFailureReason.UNSUPPORTED_X });
      expect(evaluateFit(model, [1, 2, 3], 0)).toBeNaN();
    }
  });

  it("reports a fitted reciprocal pole for graph segmentation", () => {
    expect(fitPole("shiftedInverseSquare", [-2.4, 3.61, 2.3])).toBe(3.61);
    expect(evaluateFit("shiftedInverseSquare", [-2.4, 3.61, 2.3], 3.61)).toBe(-Infinity);
    expect(fitPole("inverse", [2.4, 3.61])).toBe(0);
    expect(fitPole("sine", [2, 3, 4, 5])).toBeNull();
  });

  it("weights a linear fit by the supplied uncertainties", () => {
    // Weighted slope and intercept from the independent closed-form WLS solution.
    const fit = fitModel("linear", [0, 1, 2], [1, 3, 6], [1, 1, 2]);
    expect(fit).toMatchObject({
      ok: true,
      parameters: [expect.closeTo(7 / 3, 12), expect.closeTo(8 / 9, 12)],
      reducedChiSquared: expect.closeTo(1 / 9, 12),
    });
  });

  it("reports insufficient data for a sine series and rejects a flat nonlinear fit", () => {
    expect(fitModel("sineSeries", [0, 1, 2], [1, 2, 1])).toMatchObject({
      ok: false,
      required: 8,
      reason: FitFailureReason.TOO_FEW_POINTS,
    });
    for (const model of ["sine", "exponentialBackground", "gaussian"] satisfies FitModelValue[]) {
      expect(
        fitModel(
          model,
          xs,
          xs.map(() => 2),
        ),
      ).toMatchObject({ ok: false, reason: FitFailureReason.NONLINEAR_FAILURE });
    }
  });
});
