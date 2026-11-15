/**
 * leastSquares.ts
 *
 * Least-squares fitting and evaluation for Data Lab. Polynomial models and
 * the fixed-predictor reciprocal and logarithmic models use a shared QR solver.
 *
 * Method: x is shifted to its mean and scaled to [−1, 1], the design matrix is
 * factored by Householder QR, and the coefficients and their covariance are then
 * mapped back to powers of the original x. The normal equations are never formed:
 * with x in the millions (NIST's Pontius data) they lose most of the available
 * digits. The proportional model is not shifted, because a shift would introduce
 * the intercept the model forbids.
 *
 * Standard errors come from the scatter of the residuals, so they exist only when
 * points are left over after the parameters are determined (n > p).
 */

import { CURVE_PARAMETER_COUNTS, type CurveModel, evaluateCurve, solveCurve } from "./curveModels.js";
import { exponentialValue, solveExponential } from "./exponentialFit.js";
import { backSubstitute, householder, isRankDeficient, standardErrorsOf } from "./qr.js";

export const FitModel = {
  PROPORTIONAL: "proportional",
  LINEAR: "linear",
  WEIGHTED_LINEAR: "weightedLinear",
  QUADRATIC: "quadratic",
  CUBIC: "cubic",
  QUARTIC: "quartic",
  POWER: "power",
  POWER_NO_OFFSET: "powerNoOffset",
  INVERSE: "inverse",
  SHIFTED_INVERSE: "shiftedInverse",
  INVERSE_SQUARE: "inverseSquare",
  SHIFTED_INVERSE_SQUARE: "shiftedInverseSquare",
  EXPONENTIAL: "exponential",
  EXPONENTIAL_BACKGROUND: "exponentialBackground",
  INVERSE_EXPONENTIAL: "inverseExponential",
  LOGARITHMIC: "logarithmic",
  SINE: "sine",
  DAMPED_SINE: "dampedSine",
  SINE_SERIES: "sineSeries",
  GAUSSIAN: "gaussian",
} as const;

export type FitModelValue = (typeof FitModel)[keyof typeof FitModel];

/** Powers of x in each model, in the order its parameters are reported. */
export const MODEL_POWERS: Record<Exclude<FitModelValue, "exponential" | CurveModel>, readonly number[]> = {
  proportional: [1],
  linear: [1, 0],
  weightedLinear: [1, 0],
  logarithmic: [1, 0],
  quadratic: [2, 1, 0],
  cubic: [3, 2, 1, 0],
  quartic: [4, 3, 2, 1, 0],
  inverse: [-1, 0],
  inverseSquare: [-2, 0],
};

export const FitFailureReason = {
  /** Fewer points than parameters. */
  TOO_FEW_POINTS: "tooFewPoints",
  /** Too few distinct x values to determine every parameter. */
  TOO_FEW_DISTINCT_X: "tooFewDistinctX",
  /** Proportional fit where every x is zero. */
  ALL_X_ZERO: "allXZero",
  MISSING_UNCERTAINTY: "missingUncertainty",
  INVALID_UNCERTAINTY: "invalidUncertainty",
  NONLINEAR_FAILURE: "nonlinearFailure",
  UNSUPPORTED_X: "unsupportedX",
} as const;

type FitFailureReasonValue = (typeof FitFailureReason)[keyof typeof FitFailureReason];

export type FitSuccess = {
  readonly ok: true;
  readonly model: FitModelValue;
  /** Model coefficients, with the fixed reference x appended for an exponential fit. */
  readonly parameters: readonly number[];
  /** Parameter uncertainty from supplied σ, or from residual scatter when n > p. */
  readonly standardErrors: readonly number[] | null;
  /** Number of points used. */
  readonly count: number;
  /** Points left over after the parameters: n − p. */
  readonly degreesOfFreedom: number;
  /** y − f(x) for each point used, in the order given. */
  readonly residuals: readonly number[];
  readonly sumSquaredResiduals: number;
  /** Residual standard deviation √(SSR/(n − p)), in y units; null when n = p. */
  readonly rmse: number | null;
  /** Coefficient of determination; null for the proportional model, when y is constant, or when n = p. */
  readonly rSquared: number | null;
  readonly reducedChiSquared: number | null;
};

export type FitFailure = {
  readonly ok: false;
  readonly model: FitModelValue;
  readonly reason: FitFailureReasonValue;
  /** Points (or distinct x values) the model needs. */
  readonly required: number;
  readonly count: number;
};

export type FitResult = FitSuccess | FitFailure;

function binomial(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

function isCurveModel(model: FitModelValue): model is CurveModel {
  return Object.hasOwn(CURVE_PARAMETER_COUNTS, model);
}

function reciprocalPower(model: FitModelValue): number | null {
  return model === FitModel.INVERSE ? -1 : model === FitModel.INVERSE_SQUARE ? -2 : null;
}

/** Position of the vertical asymptote, when the plot must draw separate branches. */
export function fitPole(model: FitModelValue, parameters: readonly number[]): number | null {
  if (model === FitModel.SHIFTED_INVERSE || model === FitModel.SHIFTED_INVERSE_SQUARE) {
    return parameters[1] as number;
  }
  return reciprocalPower(model) === null ? null : 0;
}

/** Highest fitted angular frequency, used to sample oscillatory curves densely enough. */
export function highestAngularFrequency(fit: FitSuccess): number {
  switch (fit.model) {
    case FitModel.SINE:
      return fit.parameters[1] as number;
    case FitModel.DAMPED_SINE:
      return fit.parameters[2] as number;
    case FitModel.SINE_SERIES:
      return 3 * (fit.parameters[0] as number);
    default:
      return 0;
  }
}

export function requiresPositiveX(model: FitModelValue): boolean {
  return model === FitModel.LOGARITHMIC || model === FitModel.POWER || model === FitModel.POWER_NO_OFFSET;
}

export function supportsFitX(model: FitModelValue, x: number): boolean {
  if (requiresPositiveX(model)) {
    return x > 0;
  }
  const power = reciprocalPower(model);
  return power === null || Number.isFinite(x ** power);
}

/** A standard uncertainty must be finite and strictly positive. */
export function validUncertainty(sigma: number | undefined): sigma is number {
  return sigma !== undefined && Number.isFinite(sigma) && sigma > 0;
}

/** Evaluates a fitted model at x. */
export function evaluateFit(model: FitModelValue, parameters: readonly number[], x: number): number {
  if (model === FitModel.EXPONENTIAL) {
    const [amplitude, rate, reference] = parameters as readonly [number, number, number];
    return exponentialValue(amplitude, rate * (x - reference));
  }
  if (!supportsFitX(model, x)) {
    return Number.NaN;
  }
  if (isCurveModel(model)) {
    return evaluateCurve(model, parameters, x);
  }
  const predictor = model === FitModel.LOGARITHMIC ? Math.log(x) : x;
  const powers = MODEL_POWERS[model];
  let y = 0;
  for (let j = 0; j < powers.length; j++) {
    y += (parameters[j] as number) * predictor ** (powers[j] as number);
  }
  return y;
}

/** The reason these points cannot determine the model's parameters, or null when they can. */
function unsolvableReason(
  xs: readonly number[],
  n: number,
  p: number,
  hasIntercept: boolean,
): FitFailureReasonValue | null {
  if (n < p) {
    return FitFailureReason.TOO_FEW_POINTS;
  }
  const used = xs.slice(0, n);
  if (hasIntercept) {
    return new Set(used).size < p ? FitFailureReason.TOO_FEW_DISTINCT_X : null;
  }
  return used.every((x) => x === 0) ? FitFailureReason.ALL_X_ZERO : null;
}

function applyWeights(
  design: number[][],
  rhs: number[],
  uncertainties: readonly number[] | undefined,
  sigmaMin: number | undefined,
): void {
  if (uncertainties && sigmaMin !== undefined) {
    uncertainties.forEach((sigma, i) => {
      const factor = sigmaMin / sigma;
      design[i] = (design[i] as number[]).map((value) => value * factor);
      rhs[i] = (rhs[i] as number) * factor;
    });
  }
}

function coefficientOfDetermination(
  ys: readonly number[],
  n: number,
  meanY: number,
  sumSquaredResiduals: number,
): number | null {
  let totalSumSquares = 0;
  for (let i = 0; i < n; i++) {
    totalSumSquares += ((ys[i] as number) - meanY) ** 2;
  }
  return totalSumSquares > 0 ? 1 - sumSquaredResiduals / totalSumSquares : null;
}

function fitNonlinear(
  model: "exponential" | CurveModel,
  xs: readonly number[],
  ys: readonly number[],
  uncertainties?: readonly number[],
): FitResult {
  const count = Math.min(xs.length, ys.length);
  const required = model === FitModel.EXPONENTIAL ? 2 : CURVE_PARAMETER_COUNTS[model];
  const fail = (reason: FitFailureReasonValue): FitFailure => ({ ok: false, model, reason, required, count });
  const obstacle = unsolvableReason(xs, count, required, true);
  if (obstacle) {
    return fail(obstacle);
  }
  if (uncertainties && (uncertainties.length !== count || uncertainties.some((sigma) => !validUncertainty(sigma)))) {
    return fail(FitFailureReason.INVALID_UNCERTAINTY);
  }
  const xValues = xs.slice(0, count);
  const yValues = ys.slice(0, count);
  if (xValues.some((x) => !supportsFitX(model, x))) {
    return fail(FitFailureReason.UNSUPPORTED_X);
  }
  const solution =
    model === FitModel.EXPONENTIAL
      ? solveExponential(xValues, yValues, uncertainties)
      : solveCurve(model, xValues, yValues, uncertainties);
  if (!solution) {
    return fail(FitFailureReason.NONLINEAR_FAILURE);
  }
  const { parameters, standardErrors } = solution;
  const { residuals } = solution;
  if (residuals.some((value) => !Number.isFinite(value))) {
    return fail(FitFailureReason.NONLINEAR_FAILURE);
  }
  const degreesOfFreedom = count - required;
  const sumSquaredResiduals = residuals.reduce((sum, residual) => sum + residual ** 2, 0);
  return {
    ok: true,
    model,
    parameters,
    standardErrors,
    count,
    degreesOfFreedom,
    residuals,
    sumSquaredResiduals,
    rmse: degreesOfFreedom > 0 ? Math.sqrt(sumSquaredResiduals / degreesOfFreedom) : null,
    rSquared:
      !uncertainties && degreesOfFreedom > 0 && model !== FitModel.EXPONENTIAL && model !== FitModel.POWER_NO_OFFSET
        ? coefficientOfDetermination(
            yValues,
            count,
            yValues.reduce((sum, y) => sum + y / count, 0),
            sumSquaredResiduals,
          )
        : null,
    reducedChiSquared: reducedChiSquared(residuals, uncertainties, degreesOfFreedom),
  };
}

function reducedChiSquared(
  residuals: readonly number[],
  uncertainties: readonly number[] | undefined,
  degreesOfFreedom: number,
): number | null {
  return uncertainties && degreesOfFreedom > 0
    ? residuals.reduce((sum, residual, i) => sum + (residual / (uncertainties[i] as number)) ** 2, 0) / degreesOfFreedom
    : null;
}

/**
 * Fits `model` to the points (xs[i], ys[i]). Every value must be finite — filter
 * with includedRows() first.
 */
export function fitModel(
  model: FitModelValue,
  xs: readonly number[],
  ys: readonly number[],
  uncertainties?: readonly number[],
): FitResult {
  if (model === FitModel.EXPONENTIAL || isCurveModel(model)) {
    return fitNonlinear(model, xs, ys, uncertainties);
  }
  return fitLinearInParameters(model, xs, ys, uncertainties);
}

function linearPredictor(model: keyof typeof MODEL_POWERS, xs: readonly number[]) {
  const reciprocal = reciprocalPower(model);
  if (reciprocal !== null) {
    return { powers: MODEL_POWERS.linear, predictors: xs.map((x) => x ** reciprocal) };
  }
  const predictors = model === FitModel.LOGARITHMIC ? xs.map(Math.log) : xs;
  return { powers: MODEL_POWERS[model], predictors };
}

function fitLinearInParameters(
  model: keyof typeof MODEL_POWERS,
  xs: readonly number[],
  ys: readonly number[],
  uncertainties?: readonly number[],
): FitResult {
  const n = Math.min(xs.length, ys.length);
  const { powers, predictors } = linearPredictor(model, xs.slice(0, n));
  const p = powers.length;
  const hasIntercept = powers.includes(0);
  const fail = (reason: FitFailureReasonValue): FitFailure => ({ ok: false, model, reason, required: p, count: n });

  if (model === FitModel.WEIGHTED_LINEAR && !uncertainties) {
    return fail(FitFailureReason.MISSING_UNCERTAINTY);
  }
  if (predictors.some((x) => !Number.isFinite(x))) {
    return fail(FitFailureReason.UNSUPPORTED_X);
  }
  if (uncertainties && (uncertainties.length !== n || uncertainties.some((sigma) => !validUncertainty(sigma)))) {
    return fail(FitFailureReason.INVALID_UNCERTAINTY);
  }
  const obstacle = unsolvableReason(predictors, n, p, hasIntercept);
  if (obstacle !== null) {
    return fail(obstacle);
  }

  // Shift and scale x so every power of it stays within [−1, 1].
  let centre = 0;
  if (hasIntercept) {
    for (let i = 0; i < n; i++) {
      centre += (predictors[i] as number) / n;
    }
  }
  let scale = 0;
  for (let i = 0; i < n; i++) {
    scale = Math.max(scale, Math.abs((predictors[i] as number) - centre));
  }

  const design: number[][] = [];
  const rhs: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((predictors[i] as number) - centre) / scale;
    design.push(powers.map((power) => t ** power));
    rhs.push(ys[i] as number);
  }
  const original = design.map((row) => [...row]);

  // Normalize inverse standard deviations before scaling the QR rows.
  const sigmaMin = uncertainties?.reduce((min, sigma) => Math.min(min, sigma), Number.POSITIVE_INFINITY);
  applyWeights(design, rhs, uncertainties, sigmaMin);

  householder(design, rhs, n, p);

  if (isRankDeficient(design, p)) {
    return fail(FitFailureReason.TOO_FEW_DISTINCT_X);
  }
  // Coefficients of the scaled variable t.
  const scaled = backSubstitute(design, rhs, p);

  // Residuals from the scaled model, which is the well-conditioned one.
  const residuals = new Array<number>(n);
  let sumSquaredResiduals = 0;
  let meanY = 0;
  for (let i = 0; i < n; i++) {
    let predicted = 0;
    for (let j = 0; j < p; j++) {
      predicted += ((original[i] as number[])[j] as number) * (scaled[j] as number);
    }
    const residual = (ys[i] as number) - predicted;
    residuals[i] = residual;
    sumSquaredResiduals += residual * residual;
    meanY += (ys[i] as number) / n;
  }

  // Map back to powers of x: t^k = ((x − c)/s)^k = Σ_j C(k,j)·(−c)^(k−j)·x^j / s^k.
  // transform[j][k] is the contribution of the t-coefficient k to the x-coefficient j.
  const transform: number[][] = powers.map((powerJ) =>
    powers.map((powerK) =>
      powerK >= powerJ ? (binomial(powerK, powerJ) * (-centre) ** (powerK - powerJ)) / scale ** powerK : 0,
    ),
  );
  const parameters = transform.map((row) => row.reduce((sum, weight, k) => sum + weight * (scaled[k] as number), 0));

  const degreesOfFreedom = n - p;
  let standardErrors: number[] | null = null;
  let rmse: number | null = null;
  if (degreesOfFreedom > 0) {
    const variance = sumSquaredResiduals / degreesOfFreedom;
    rmse = Math.sqrt(variance);
    if (!uncertainties) {
      standardErrors = standardErrorsOf(transform, design, p, variance);
    }
  }

  if (sigmaMin !== undefined) {
    standardErrors = standardErrorsOf(transform, design, p, 1).map((error) => error * sigmaMin);
  }

  return {
    ok: true,
    model,
    parameters,
    standardErrors,
    count: n,
    degreesOfFreedom,
    residuals,
    sumSquaredResiduals,
    rmse,
    rSquared:
      !uncertainties && hasIntercept && degreesOfFreedom > 0
        ? coefficientOfDetermination(ys, n, meanY, sumSquaredResiduals)
        : null,
    reducedChiSquared: reducedChiSquared(residuals, uncertainties, degreesOfFreedom),
  };
}
