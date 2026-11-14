import { backSubstitute, householder, isRankDeficient, standardErrorsOf } from "./qr.js";

export type Basis = (x: number, shape: readonly number[]) => readonly number[];
export type Profile = {
  readonly basis: Basis;
  readonly bounds: readonly (readonly [number, number])[];
  readonly seeds: readonly (readonly number[])[];
  readonly steps: readonly number[];
  readonly report: (linear: readonly number[], shape: readonly number[]) => number[];
};

type Point = { readonly x: number; readonly y: number; readonly weight: number };
type Trial = { readonly shape: readonly number[]; readonly linear: number[]; readonly cost: number };

const SEED_SAMPLE_SIZE = 256;
const REFINEMENT_STARTS = 4;
const MAX_ITERATIONS = 160;

function dot(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, i) => sum + value * (b[i] as number), 0);
}

/** Solve for the amplitudes and background at a fixed exponent, frequency, etc. */
function score(profile: Profile, points: readonly Point[], shape: readonly number[]): Trial {
  const invalid = { shape, linear: [], cost: Infinity };
  if (profile.bounds.some(([min, max], i) => !((shape[i] as number) > min && (shape[i] as number) < max))) {
    return invalid;
  }
  const design = points.map((point) => profile.basis(point.x, shape).map((value) => value * point.weight));
  const rhs = points.map((point) => point.y * point.weight);
  const columns = (design[0] as number[]).length;
  if (design.some((row) => row.some((value) => !Number.isFinite(value)))) {
    return invalid;
  }
  // Scale columns before QR, including reciprocal bases near a pole.
  const norms = Array.from({ length: columns }, (_, j) =>
    design.reduce((norm, row) => Math.hypot(norm, row[j] as number), 0),
  );
  if (norms.some((norm) => !(Number.isFinite(norm) && norm > 0))) {
    return invalid;
  }
  const qr = design.map((row) => row.map((value, j) => value / (norms[j] as number)));
  householder(qr, rhs, points.length, columns);
  if (isRankDeficient(qr, columns)) {
    return invalid;
  }
  const linear = backSubstitute(qr, rhs, columns).map((value, j) => value / (norms[j] as number));
  const cost = points.reduce(
    (sum, point, i) => sum + (point.y * point.weight - dot(design[i] as number[], linear)) ** 2,
    0,
  );
  return Number.isFinite(cost) ? { shape, linear, cost } : invalid;
}

/** Nelder–Mead on the one or two nonlinear parameters of the profiled objective. */
function refine(profile: Profile, points: readonly Point[], seed: Trial): Trial {
  const dimensions = seed.shape.length;
  const simplex = [seed];
  for (const [i, step] of profile.steps.entries()) {
    const shifted = (delta: number) => seed.shape.map((value, j) => (i === j ? value + delta : value));
    const plus = score(profile, points, shifted(step));
    simplex.push(Number.isFinite(plus.cost) ? plus : score(profile, points, shifted(-step)));
  }
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    simplex.sort((a, b) => a.cost - b.cost);
    const best = simplex[0] as Trial;
    const worst = simplex[dimensions] as Trial;
    if (simplex.every((trial) => trial.shape.every((x, j) => Math.abs(x - (best.shape[j] as number)) < 1e-9))) {
      return best;
    }
    const centre = best.shape.map(
      (_, j) => simplex.slice(0, dimensions).reduce((sum, trial) => sum + (trial.shape[j] as number), 0) / dimensions,
    );
    const move = (factor: number) =>
      score(
        profile,
        points,
        centre.map((x, j) => x + factor * (x - (worst.shape[j] as number))),
      );
    const reflected = move(1);
    if (reflected.cost < best.cost) {
      const expanded = move(2);
      simplex[dimensions] = expanded.cost < reflected.cost ? expanded : reflected;
    } else if (reflected.cost < (simplex[dimensions - 1] as Trial).cost) {
      simplex[dimensions] = reflected;
    } else {
      const contracted = move(reflected.cost < worst.cost ? 0.5 : -0.5);
      if (contracted.cost < Math.min(worst.cost, reflected.cost)) {
        simplex[dimensions] = contracted;
      } else {
        for (let i = 1; i < simplex.length; i++) {
          const trial = simplex[i] as Trial;
          simplex[i] = score(
            profile,
            points,
            best.shape.map((x, j) => (x + (trial.shape[j] as number)) / 2),
          );
        }
      }
    }
  }
  return simplex.reduce((best, trial) => (trial.cost < best.cost ? trial : best));
}

function differences(
  values: readonly number[],
  evaluate: (parameters: readonly number[]) => readonly number[],
  wrap?: (index: number, difference: number) => number,
): number[][] {
  const columns = values.map((value, j) => {
    const step = 1e-6 * Math.max(1, Math.abs(value));
    const plus = evaluate(values.map((v, k) => (j === k ? v + step : v)));
    const minus = evaluate(values.map((v, k) => (j === k ? v - step : v)));
    return plus.map((p, i) => {
      const difference = p - (minus[i] as number);
      return (wrap ? wrap(i, difference) : difference) / (2 * step);
    });
  });
  return (columns[0] as number[]).map((_, i) => columns.map((column) => column[i] as number));
}

export function fitProfile(
  profile: Profile,
  points: readonly Point[],
  noise: number | undefined,
  phaseIndices: readonly number[],
) {
  let sample = points;
  if (points.length > SEED_SAMPLE_SIZE) {
    const sorted = [...points].sort((a, b) => a.x - b.x);
    // Sample across x, with deterministic jitter to avoid a new regular Nyquist limit.
    sample = Array.from({ length: SEED_SAMPLE_SIZE }, (_, i) => {
      const stride = sorted.length / SEED_SAMPLE_SIZE;
      const fraction = ((i * 89) % SEED_SAMPLE_SIZE) / SEED_SAMPLE_SIZE;
      return sorted[Math.floor((i + fraction) * stride)] as Point;
    });
  }
  const seeds = profile.seeds.map((seed) => score(profile, sample, seed)).sort((a, b) => a.cost - b.cost);
  const starts: Trial[] = [];
  for (const seed of seeds) {
    if (!Number.isFinite(seed.cost) || starts.length === REFINEMENT_STARTS) {
      break;
    }
    if (
      starts.every((other) =>
        seed.shape.some((x, j) => Math.abs(x - (other.shape[j] as number)) >= (profile.steps[j] as number)),
      )
    ) {
      starts.push(seed);
    }
  }
  const candidates = starts.map((start) => {
    const rough = refine(profile, sample, start);
    return sample === points ? rough : refine(profile, points, score(profile, points, rough.shape));
  });
  const optimum = candidates.sort((a, b) => a.cost - b.cost)[0];
  if (!(optimum && Number.isFinite(optimum.cost))) {
    return null;
  }
  const { linear, shape, cost } = optimum;
  const internal = [...linear, ...shape];
  const p = internal.length;
  const report = (values: readonly number[]) =>
    profile.report(values.slice(0, linear.length), values.slice(linear.length));
  const parameters = report(internal);
  if (parameters.some((value) => !Number.isFinite(value))) {
    return null;
  }

  // The full Jacobian includes both the profiled linear coefficients and shape parameters.
  const shapeJacobian = differences(shape, (values) =>
    points.map((point) => dot(profile.basis(point.x, values), linear)),
  );
  const jacobian = points.map((point, i) =>
    [...profile.basis(point.x, shape), ...(shapeJacobian[i] as number[])].map((value) => value * point.weight),
  );
  const norms = Array.from({ length: p }, (_, j) =>
    jacobian.reduce((norm, row) => Math.hypot(norm, row[j] as number), 0),
  );
  if (norms.some((norm) => !(Number.isFinite(norm) && norm > 0))) {
    return null;
  }
  const qr = jacobian.map((row) => row.map((value, j) => value / (norms[j] as number)));
  householder(qr, new Array<number>(points.length).fill(0), points.length, p);
  if (isRankDeficient(qr, p)) {
    return null;
  }

  const scatter = noise ?? (points.length > p ? Math.sqrt(cost / (points.length - p)) : null);
  const transform = differences(internal, report, (i, delta) =>
    phaseIndices.includes(i) ? Math.atan2(Math.sin(delta), Math.cos(delta)) : delta,
  );
  const standardErrors =
    scatter === null
      ? null
      : standardErrorsOf(
          transform.map((row) => row.map((value, j) => (value * scatter) / (norms[j] as number))),
          qr,
          p,
          1,
        );
  return { parameters, standardErrors, predicted: points.map((point) => dot(profile.basis(point.x, shape), linear)) };
}
