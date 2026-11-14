import { exponentialValue } from "./exponentialFit.js";
import { fitProfile, type Profile } from "./profiledFit.js";

export const CURVE_PARAMETER_COUNTS = {
  power: 3,
  powerNoOffset: 2,
  shiftedInverse: 3,
  shiftedInverseSquare: 3,
  exponentialBackground: 3,
  inverseExponential: 3,
  sine: 4,
  dampedSine: 5,
  sineSeries: 8,
  gaussian: 4,
} as const;

export type CurveModel = keyof typeof CURVE_PARAMETER_COUNTS;

type Coordinates = {
  readonly origin: number;
  readonly span: number;
  readonly x: readonly number[];
  readonly y: readonly number[];
  readonly yScale: number;
};

const RATE_LIMIT = 350;
const MAX_FREQUENCY_SEEDS = 512;
const rateSeeds = [-100, -40, -15, -6, -2, -0.5, -0.1, 0.1, 0.5, 2, 6, 15, 40, 100];

function normalizedPhase(phase: number): number {
  return Math.atan2(Math.sin(phase), Math.cos(phase));
}

function exponentialProfile(model: "exponentialBackground" | "inverseExponential", c: Coordinates): Profile {
  return {
    basis: (x, [rate]) => [Math.exp((rate as number) * x - Math.max(0, rate as number)), 1],
    bounds: [[-RATE_LIMIT, RATE_LIMIT]],
    seeds: rateSeeds.map((rate) => [rate]),
    steps: [0.09],
    report: ([amplitude, background], [rate]) => {
      const k = (rate as number) / c.span;
      const a = exponentialValue((amplitude as number) * c.yScale, -k * c.origin - Math.max(0, rate as number));
      const b = (background as number) * c.yScale;
      return model === "inverseExponential" ? [-a, -k, b + a] : [a, k, b];
    },
  };
}

function powerProfile(model: "power" | "powerNoOffset", c: Coordinates): Profile {
  const background = model === "power";
  return {
    basis: (x, [exponent]) => {
      const power = Math.exp((exponent as number) * x - Math.max(0, exponent as number));
      return background ? [power, 1] : [power];
    },
    bounds: [[-RATE_LIMIT, RATE_LIMIT]],
    seeds: (background ? rateSeeds : [0, ...rateSeeds]).map((exponent) => [exponent]),
    steps: [0.09],
    report: ([amplitude, offset], [rate]) => {
      const exponent = (rate as number) / c.span;
      const a = exponentialValue((amplitude as number) * c.yScale, -exponent * c.origin - Math.max(0, rate as number));
      return background ? [a, exponent, (offset as number) * c.yScale] : [a, exponent];
    },
  };
}

function reciprocalProfile(model: "shiftedInverse" | "shiftedInverseSquare", c: Coordinates): Profile {
  const power = model === "shiftedInverse" ? 1 : 2;
  const sorted = [...new Set(c.x)].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((right, i) => {
    const left = sorted[i] as number;
    return { centre: (left + right) / 2, width: right - left };
  });
  gaps.sort((a, b) => b.width - a.width);
  const offsets = [0.0001, 0.001, 0.01, 0.03, 0.07, 0.15, 0.3, 0.6, 1, 2, 5, 15, 50];
  return {
    basis: (x, [pole]) => [1 / (x - (pole as number)) ** power, 1],
    bounds: [[-Infinity, Infinity]],
    seeds: [
      ...offsets.flatMap((offset) => [[-offset], [1 + offset]]),
      ...gaps.slice(0, 128).map(({ centre }) => [centre]),
    ],
    steps: [0.001],
    report: ([amplitude, offset], [pole]) => [
      (amplitude as number) * c.yScale * c.span ** power,
      c.origin + (pole as number) * c.span,
      (offset as number) * c.yScale,
    ],
  };
}

function harmonicProfile(model: "sine" | "dampedSine" | "sineSeries", c: Coordinates): Profile {
  const damped = model === "dampedSine";
  const harmonics = model === "sineSeries" ? [1, 2, 3] : [1];
  const sorted = [...new Set(c.x)].sort((a, b) => a - b);
  const gaps = sorted
    .slice(1)
    .map((x, i) => x - (sorted[i] as number))
    .sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)] as number;
  const maxFrequency = Math.min(Math.PI / (medianGap * harmonics.length), (MAX_FREQUENCY_SEEDS * Math.PI) / 2);
  const frequencyCount = Math.max(8, Math.ceil(maxFrequency / (Math.PI / 2)));
  const frequencies = Array.from({ length: frequencyCount }, (_, i) => ((i + 0.5) * maxFrequency) / frequencyCount);
  return {
    basis: (x, [frequency, rate]) => {
      const envelope = damped ? Math.exp(-(rate as number) * x) : 1;
      return [
        ...harmonics.flatMap((h) => {
          const angle = h * (frequency as number) * x;
          return [envelope * Math.sin(angle), envelope * Math.cos(angle)];
        }),
        1,
      ];
    },
    bounds: damped
      ? [
          [0, maxFrequency],
          [-RATE_LIMIT, RATE_LIMIT],
        ]
      : [[0, maxFrequency]],
    seeds: damped
      ? frequencies.flatMap((frequency) => [0, 2, 8, -2].map((rate) => [frequency, rate]))
      : frequencies.map((frequency) => [frequency]),
    steps: damped ? [maxFrequency / frequencyCount / 2, 0.3] : [maxFrequency / frequencyCount / 2],
    report: (linear, [frequency, rate]) => {
      const omega = (frequency as number) / c.span;
      const k = damped ? (rate as number) / c.span : 0;
      const pairs = harmonics.flatMap((h, i) => [
        exponentialValue(Math.hypot(linear[2 * i] as number, linear[2 * i + 1] as number) * c.yScale, k * c.origin),
        normalizedPhase(Math.atan2(linear[2 * i + 1] as number, linear[2 * i] as number) - h * omega * c.origin),
      ]);
      const background = (linear[linear.length - 1] as number) * c.yScale;
      if (damped) {
        return [pairs[0] as number, k, omega, pairs[1] as number, background];
      }
      return model === "sine"
        ? [pairs[0] as number, omega, pairs[1] as number, background]
        : [omega, ...pairs, background];
    },
  };
}

function gaussianProfile(c: Coordinates): Profile {
  let low = 0;
  let high = 0;
  for (const [i, y] of c.y.entries()) {
    if (y < (c.y[low] as number)) {
      low = i;
    }
    if (y > (c.y[high] as number)) {
      high = i;
    }
  }
  const centres = [c.x[low] as number, c.x[high] as number, -0.3, 0, 0.15, 0.3, 0.5, 0.7, 0.85, 1, 1.3];
  return {
    basis: (x, [centre, logWidth]) => [
      Math.exp(-0.5 * ((x - (centre as number)) / Math.exp(logWidth as number)) ** 2),
      1,
    ],
    bounds: [
      [-20, 21],
      [-25, 5],
    ],
    seeds: centres.flatMap((centre) =>
      [0.01, 0.025, 0.06, 0.15, 0.35, 0.8, 1.8].map((width) => [centre, Math.log(width)]),
    ),
    steps: [0.025, 0.2],
    report: ([amplitude, offset], [centre, logWidth]) => [
      (amplitude as number) * c.yScale,
      c.origin + (centre as number) * c.span,
      Math.exp(logWidth as number) * c.span,
      (offset as number) * c.yScale,
    ],
  };
}

export function solveCurve(
  model: CurveModel,
  xs: readonly number[],
  ys: readonly number[],
  uncertainties?: readonly number[],
) {
  const logarithmic = model === "power" || model === "powerNoOffset";
  const input = logarithmic ? xs.map(Math.log) : xs;
  let origin = Infinity;
  let upper = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const [i, x] of input.entries()) {
    origin = Math.min(origin, x);
    upper = Math.max(upper, x);
    yMin = Math.min(yMin, ys[i] as number);
    yMax = Math.max(yMax, ys[i] as number);
  }
  const span = upper - origin;
  const yScale = Math.max(Math.abs(yMin), Math.abs(yMax));
  if (!(Number.isFinite(span) && span > 0 && yMin < yMax && Number.isFinite(yScale))) {
    return null;
  }

  const x = input.map((value) => (value - origin) / span);
  const y = ys.map((value) => value / yScale);
  const c = { origin, span, x, y, yScale };
  const sigmaMin = uncertainties?.reduce((min, sigma) => Math.min(min, sigma), Infinity);
  const points = x.map((value, i) => ({
    x: value,
    y: y[i] as number,
    weight: uncertainties && sigmaMin !== undefined ? sigmaMin / (uncertainties[i] as number) : 1,
  }));
  let profile: Profile;
  switch (model) {
    case "power":
    case "powerNoOffset":
      profile = powerProfile(model, c);
      break;
    case "shiftedInverse":
    case "shiftedInverseSquare":
      profile = reciprocalProfile(model, c);
      break;
    case "exponentialBackground":
    case "inverseExponential":
      profile = exponentialProfile(model, c);
      break;
    case "sine":
    case "dampedSine":
    case "sineSeries":
      profile = harmonicProfile(model, c);
      break;
    case "gaussian":
      profile = gaussianProfile(c);
      break;
  }
  const phases = model === "sineSeries" ? [2, 4, 6] : model === "sine" ? [2] : model === "dampedSine" ? [3] : [];
  const fit = fitProfile(profile, points, sigmaMin === undefined ? undefined : sigmaMin / yScale, phases);
  if (!fit) {
    return null;
  }
  const predicted = xs.map((value) => evaluateCurve(model, fit.parameters, value));
  // Reject a coefficient conversion that loses the fitted curve (e.g. an
  // amplitude that underflows when extrapolated all the way to x = 0).
  if (predicted.some((value, i) => !(Math.abs(value / yScale - (fit.predicted[i] as number)) <= 1e-6))) {
    return null;
  }
  return {
    parameters: fit.parameters,
    standardErrors: fit.standardErrors,
    residuals: ys.map((value, i) => value - (predicted[i] as number)),
  };
}

export function evaluateCurve(model: CurveModel, parameters: readonly number[], x: number): number {
  const [a, b, c, d, e, f, g, h] = parameters as readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  switch (model) {
    case "power":
      return exponentialValue(a, b * Math.log(x)) + c;
    case "powerNoOffset":
      return exponentialValue(a, b * Math.log(x));
    case "shiftedInverse":
      return a / (x - b) + c;
    case "shiftedInverseSquare":
      return a / (x - b) ** 2 + c;
    case "exponentialBackground":
      return exponentialValue(a, b * x) + c;
    case "inverseExponential":
      return -a * Math.expm1(-b * x) + c;
    case "sine":
      return a * Math.sin(b * x + c) + d;
    case "dampedSine":
      return exponentialValue(a * Math.sin(c * x + d), -b * x) + e;
    case "sineSeries":
      return b * Math.sin(a * x + c) + d * Math.sin(2 * a * x + e) + f * Math.sin(3 * a * x + g) + h;
    case "gaussian":
      return a * Math.exp(-0.5 * ((x - b) / c) ** 2) + d;
  }
}
