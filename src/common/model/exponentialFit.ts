import { backSubstitute, householder, isRankDeficient, standardErrorsOf } from "./qr.js";

const MAX_ITERATIONS = 80;
const STEP_TOLERANCE = 1e-10;
const COST_TOLERANCE = 1e-13;

type Parameters = readonly [amplitude: number, rate: number];

export function exponentialValue(amplitude: number, exponent: number): number {
  if (amplitude === 0) {
    return 0;
  }
  const basis = Math.exp(exponent);
  return Number.isFinite(basis) && basis > 0
    ? amplitude * basis
    : Math.sign(amplitude) * Math.exp(Math.log(Math.abs(amplitude)) + exponent);
}

function estimateRate(t: readonly number[], normalizedY: readonly number[]): number {
  // A log-magnitude slope is only a starting estimate. All measurements,
  // including zero and sign changes, enter the original-y objective.
  let logCount = 0;
  let meanX = 0;
  let meanLog = 0;
  let covariance = 0;
  let varianceX = 0;
  for (const [i, y] of normalizedY.entries()) {
    if (y === 0) {
      continue;
    }
    const x = t[i] as number;
    const magnitude = Math.log(Math.abs(y));
    const dx = x - meanX;
    logCount++;
    meanX += dx / logCount;
    meanLog += (magnitude - meanLog) / logCount;
    covariance += dx * (magnitude - meanLog);
    varianceX += dx * (x - meanX);
  }
  return varianceX > 0 ? Math.max(-300, Math.min(300, covariance / varianceX)) : 0;
}

function refine(
  initial: Parameters,
  score: (parameters: Parameters) => number,
  jacobian: (parameters: Parameters) => number[][],
  residualVector: (parameters: Parameters) => number[],
): [Parameters, number] | null {
  let parameters = initial;
  let cost = score(parameters);
  let damping = 1e-3;
  let converged = false;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const design = jacobian(parameters);
    const rhs = residualVector(parameters);
    const aNorm = design.reduce((norm, row) => Math.hypot(norm, row[0] as number), 0);
    const kNorm = design.reduce((norm, row) => Math.hypot(norm, row[1] as number), 0);
    if (!(Number.isFinite(aNorm) && Number.isFinite(kNorm) && aNorm > 0 && kNorm > 0)) {
      break;
    }
    // Damped Gauss–Newton step via augmented QR, with Jacobian column scaling.
    const scaled = design.map(([a, k]) => [(a as number) / aNorm, (k as number) / kNorm]);
    scaled.push([Math.sqrt(damping), 0], [0, Math.sqrt(damping)]);
    rhs.push(0, 0);
    householder(scaled, rhs, scaled.length, 2);
    const delta = backSubstitute(scaled, rhs, 2);
    const da = (delta[0] as number) / aNorm;
    const dk = (delta[1] as number) / kNorm;
    const candidate: Parameters = [parameters[0] + da, parameters[1] + dk];
    const trial = Math.abs(candidate[1]) <= 350 ? score(candidate) : Infinity;
    const smallStep =
      Math.abs(da) <= STEP_TOLERANCE * Math.max(Math.abs(parameters[0]), Number.MIN_VALUE) &&
      Math.abs(dk) <= STEP_TOLERANCE * (1 + Math.abs(parameters[1]));
    if (trial <= cost) {
      const smallChange = cost - trial <= COST_TOLERANCE * Math.max(cost, Number.EPSILON);
      parameters = candidate;
      cost = trial;
      if (smallStep || smallChange) {
        converged = true;
        break;
      }
      damping = Math.max(1e-12, damping / 3);
    } else {
      // A rounded-away improvement at an otherwise stationary solution.
      if (smallStep && damping <= 1 && trial - cost <= COST_TOLERANCE * Math.max(cost, Number.EPSILON)) {
        converged = true;
        break;
      }
      damping *= 10;
    }
  }

  return converged ? [parameters, cost] : null;
}

/** Original-y least squares. Normalized coordinates keep the LM steps well scaled. */
export function solveExponential(xs: readonly number[], ys: readonly number[], uncertainties?: readonly number[]) {
  let reference = Infinity;
  let upper = -Infinity;
  let yScale = 0;
  for (const [i, x] of xs.entries()) {
    reference = Math.min(reference, x);
    upper = Math.max(upper, x);
    yScale = Math.max(yScale, Math.abs(ys[i] as number));
  }
  const span = upper - reference;
  if (!(Number.isFinite(span) && span > 0 && yScale > 0 && Number.isFinite(yScale))) {
    return null;
  }

  const t = xs.map((x) => (x - reference) / span);
  const normalizedY = ys.map((y) => y / yScale);
  const sigmaMin = uncertainties?.reduce((min, sigma) => Math.min(min, sigma), Infinity);
  const weights = t.map((_, i) =>
    uncertainties && sigmaMin !== undefined ? sigmaMin / (uncertainties[i] as number) : 1,
  );
  const score = ([a, k]: Parameters) =>
    t.reduce(
      (sum, x, i) => sum + (((normalizedY[i] as number) - exponentialValue(a, k * x)) * (weights[i] as number)) ** 2,
      0,
    );

  // For each trial rate, solve analytically for the best amplitude. The
  // exponential basis is normalized at its largest value to prevent overflow.
  const seed = (rate: number): Parameters => {
    const peak = Math.max(0, rate);
    let dot = 0;
    let norm = 0;
    for (const [i, x] of t.entries()) {
      const weight = weights[i] as number;
      const basis = Math.exp(rate * x - peak) * weight;
      dot += basis * (normalizedY[i] as number) * weight;
      norm += basis ** 2;
    }
    return [(dot / norm) * Math.exp(-peak), rate];
  };

  const logRate = estimateRate(t, normalizedY);
  let parameters = seed(0);
  let cost = score(parameters);
  for (const rate of [logRate, -1, 1, -5, 5]) {
    const candidate = seed(rate);
    const candidateCost = score(candidate);
    if (candidateCost < cost) {
      parameters = candidate;
      cost = candidateCost;
    }
  }

  const jacobian = ([a, k]: Parameters) =>
    t.map((x, i) => {
      const weight = weights[i] as number;
      return [Math.exp(k * x) * weight, exponentialValue(a, k * x) * x * weight];
    });
  const residualVector = ([a, k]: Parameters) =>
    t.map((x, i) => ((normalizedY[i] as number) - exponentialValue(a, k * x)) * (weights[i] as number));

  const optimum = refine(parameters, score, jacobian, residualVector);
  if (!optimum) {
    return null;
  }
  [parameters, cost] = optimum;

  const [normalizedAmplitude, normalizedRate] = parameters;
  const amplitude = normalizedAmplitude * yScale;
  const fitRate = normalizedRate / span;
  if (amplitude === 0 || !Number.isFinite(amplitude) || !Number.isFinite(fitRate)) {
    return null;
  }

  const design = jacobian(parameters);
  const aNorm = design.reduce((norm, row) => Math.hypot(norm, row[0] as number), 0);
  const kNorm = design.reduce((norm, row) => Math.hypot(norm, row[1] as number), 0);
  if (!(Number.isFinite(aNorm) && Number.isFinite(kNorm) && aNorm > 0 && kNorm > 0)) {
    return null;
  }
  const scaled = design.map(([ja, jk]) => [(ja as number) / aNorm, (jk as number) / kNorm]);
  householder(scaled, new Array<number>(t.length).fill(0), t.length, 2);
  if (isRankDeficient(scaled, 2)) {
    return null;
  }
  const residuals = ys.map((y, i) => y - exponentialValue(amplitude, fitRate * ((xs[i] as number) - reference)));
  const degreesOfFreedom = t.length - 2;
  const noise =
    sigmaMin !== undefined ? sigmaMin / yScale : degreesOfFreedom > 0 ? Math.sqrt(cost / degreesOfFreedom) : null;
  const standardErrors =
    noise === null
      ? null
      : standardErrorsOf(
          [
            [(noise / aNorm) * yScale, 0],
            [0, noise / kNorm / span],
          ],
          scaled,
          2,
          1,
        );
  return { parameters: [amplitude, fitRate, reference], residuals, standardErrors };
}
