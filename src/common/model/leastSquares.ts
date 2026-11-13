/**
 * leastSquares.ts
 *
 * Ordinary least squares for the polynomial models students fit: proportional
 * (y = A·x), linear (y = m·x + b) and quadratic (y = A·x² + B·x + C). Pure, no
 * SceneryStack imports.
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

export const FitModel = {
  PROPORTIONAL: "proportional",
  LINEAR: "linear",
  QUADRATIC: "quadratic",
} as const;

export type FitModelValue = (typeof FitModel)[keyof typeof FitModel];

/** Powers of x in each model, in the order its parameters are reported. */
export const MODEL_POWERS: Record<FitModelValue, readonly number[]> = {
  proportional: [1],
  linear: [1, 0],
  quadratic: [2, 1, 0],
};

export const FitFailureReason = {
  /** Fewer points than parameters. */
  TOO_FEW_POINTS: "tooFewPoints",
  /** Too few distinct x values to determine every parameter. */
  TOO_FEW_DISTINCT_X: "tooFewDistinctX",
  /** Proportional fit where every x is zero. */
  ALL_X_ZERO: "allXZero",
} as const;

export type FitFailureReasonValue = (typeof FitFailureReason)[keyof typeof FitFailureReason];

export type FitSuccess = {
  readonly ok: true;
  readonly model: FitModelValue;
  /** Parameter values, ordered as in MODEL_POWERS (highest power of x first). */
  readonly parameters: readonly number[];
  /** Standard error of each parameter, or null when n = p leaves nothing to estimate scatter from. */
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

/** Relative size below which a diagonal entry of R marks a rank-deficient fit. */
const RANK_TOLERANCE = 1e-10;

function binomial(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

/** Evaluates a fitted model at x. */
export function evaluateFit(model: FitModelValue, parameters: readonly number[], x: number): number {
  const powers = MODEL_POWERS[model];
  let y = 0;
  for (let j = 0; j < powers.length; j++) {
    y += (parameters[j] as number) * x ** (powers[j] as number);
  }
  return y;
}

/**
 * Householder QR of the n×p matrix `a` (row-major, modified in place) applied to
 * the right-hand side `b` (modified in place). Afterwards the upper triangle of
 * `a` holds R and the first p entries of `b` hold Qᵀb.
 */
function householder(a: number[][], b: number[], n: number, p: number): void {
  for (let k = 0; k < p; k++) {
    let norm = 0;
    for (let i = k; i < n; i++) {
      norm = Math.hypot(norm, (a[i] as number[])[k] as number);
    }
    if (norm === 0) {
      continue;
    }
    const pivotRow = a[k] as number[];
    const alpha = (pivotRow[k] as number) > 0 ? -norm : norm;
    // v = column k below the diagonal, with alpha subtracted from its head.
    const v = new Array<number>(n - k);
    for (let i = k; i < n; i++) {
      v[i - k] = (a[i] as number[])[k] as number;
    }
    v[0] = (v[0] as number) - alpha;
    let vDotV = 0;
    for (const value of v) {
      vDotV += value * value;
    }
    if (vDotV === 0) {
      continue;
    }
    for (let j = k; j < p; j++) {
      let dot = 0;
      for (let i = k; i < n; i++) {
        dot += (v[i - k] as number) * ((a[i] as number[])[j] as number);
      }
      const scale = (2 * dot) / vDotV;
      for (let i = k; i < n; i++) {
        const row = a[i] as number[];
        row[j] = (row[j] as number) - scale * (v[i - k] as number);
      }
    }
    let dot = 0;
    for (let i = k; i < n; i++) {
      dot += (v[i - k] as number) * (b[i] as number);
    }
    const scale = (2 * dot) / vDotV;
    for (let i = k; i < n; i++) {
      b[i] = (b[i] as number) - scale * (v[i - k] as number);
    }
  }
}

/** Inverse of the upper-triangular p×p block of `r`. */
function invertUpperTriangular(r: number[][], p: number): number[][] {
  const inverse: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let j = 0; j < p; j++) {
    (inverse[j] as number[])[j] = 1 / ((r[j] as number[])[j] as number);
    for (let i = j - 1; i >= 0; i--) {
      let sum = 0;
      for (let k = i + 1; k <= j; k++) {
        sum += ((r[i] as number[])[k] as number) * ((inverse[k] as number[])[j] as number);
      }
      (inverse[i] as number[])[j] = -sum / ((r[i] as number[])[i] as number);
    }
  }
  return inverse;
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

/** Solves R·β = Qᵀy by back-substitution, R being the upper triangle of `r`. */
function backSubstitute(r: number[][], qty: number[], p: number): number[] {
  const solution = new Array<number>(p).fill(0);
  for (let j = p - 1; j >= 0; j--) {
    let sum = qty[j] as number;
    for (let k = j + 1; k < p; k++) {
      sum -= ((r[j] as number[])[k] as number) * (solution[k] as number);
    }
    solution[j] = sum / ((r[j] as number[])[j] as number);
  }
  return solution;
}

/** True when a diagonal entry of R is negligible beside the largest: the columns are dependent. */
function isRankDeficient(r: number[][], p: number): boolean {
  let largest = 0;
  for (let j = 0; j < p; j++) {
    largest = Math.max(largest, Math.abs((r[j] as number[])[j] as number));
  }
  for (let j = 0; j < p; j++) {
    if (Math.abs((r[j] as number[])[j] as number) <= RANK_TOLERANCE * largest) {
      return true;
    }
  }
  return false;
}

/**
 * Standard errors of the parameters: Cov(β) = σ²·R⁻¹R⁻ᵀ, so
 * Cov(parameters) = σ²·(T·R⁻¹)(T·R⁻¹)ᵀ, T being the map back to powers of x.
 */
function standardErrorsOf(transform: number[][], r: number[][], p: number, variance: number): number[] {
  const rInverse = invertUpperTriangular(r, p);
  return transform.map((row) => {
    let sumSquares = 0;
    for (let m = 0; m < p; m++) {
      let entry = 0;
      for (let k = 0; k < p; k++) {
        entry += (row[k] as number) * ((rInverse[k] as number[])[m] as number);
      }
      sumSquares += entry * entry;
    }
    return Math.sqrt(variance * sumSquares);
  });
}

/**
 * Fits `model` to the points (xs[i], ys[i]). Every value must be finite — filter
 * with includedRows() first.
 */
export function fitModel(model: FitModelValue, xs: readonly number[], ys: readonly number[]): FitResult {
  const n = Math.min(xs.length, ys.length);
  const powers = MODEL_POWERS[model];
  const p = powers.length;
  const hasIntercept = powers.includes(0);
  const fail = (reason: FitFailureReasonValue): FitFailure => ({ ok: false, model, reason, required: p, count: n });

  const obstacle = unsolvableReason(xs, n, p, hasIntercept);
  if (obstacle !== null) {
    return fail(obstacle);
  }

  // Shift and scale x so every power of it stays within [−1, 1].
  let centre = 0;
  if (hasIntercept) {
    for (let i = 0; i < n; i++) {
      centre += (xs[i] as number) / n;
    }
  }
  let scale = 0;
  for (let i = 0; i < n; i++) {
    scale = Math.max(scale, Math.abs((xs[i] as number) - centre));
  }

  const design: number[][] = [];
  const rhs: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((xs[i] as number) - centre) / scale;
    design.push(powers.map((power) => t ** power));
    rhs.push(ys[i] as number);
  }
  const original = design.map((row) => [...row]);

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
    standardErrors = standardErrorsOf(transform, design, p, variance);
  }

  let rSquared: number | null = null;
  if (hasIntercept && degreesOfFreedom > 0) {
    let totalSumSquares = 0;
    for (let i = 0; i < n; i++) {
      totalSumSquares += ((ys[i] as number) - meanY) ** 2;
    }
    if (totalSumSquares > 0) {
      rSquared = 1 - sumSquaredResiduals / totalSumSquares;
    }
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
    rSquared,
  };
}
