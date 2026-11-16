/**
 * formatFit.ts
 *
 * Turns fit numbers into what a student reads: parameter units built from the
 * column units, and values rounded to match their uncertainty. Pure, no
 * SceneryStack imports.
 */

import { toFixed } from "scenerystack/dot";
import { FORMAT } from "../../DataLabConstants.js";
import { FitModel, type FitModelValue, MODEL_POWERS } from "./leastSquares.js";

/** Parameter symbols, in the order the fit reports its parameters. */
export const MODEL_SYMBOLS: Record<FitModelValue, readonly string[]> = {
  proportional: ["A"],
  linear: ["m", "b"],
  quadratic: ["A", "B", "C"],
  cubic: ["A", "B", "C", "D"],
  quartic: ["A", "B", "C", "D", "E"],
  power: ["A", "n", "B"],
  powerNoOffset: ["A", "n"],
  inverse: ["A", "B"],
  shiftedInverse: ["A", "x₀", "B"],
  inverseSquare: ["A", "B"],
  shiftedInverseSquare: ["A", "x₀", "B"],
  exponential: ["A", "k", "x₀"],
  exponentialBackground: ["A", "k", "y₀"],
  inverseExponential: ["A", "k", "y₀"],
  logarithmic: ["A", "B"],
  sine: ["A", "ω", "φ", "C"],
  dampedSine: ["A", "k", "ω", "φ", "C"],
  sineSeries: ["ω", "A₁", "φ₁", "A₂", "φ₂", "A₃", "φ₃", "C"],
  gaussian: ["A", "μ", "σ", "y₀"],
};

const MODEL_EQUATIONS: Record<FitModelValue, string> = {
  proportional: "y = A·x",
  linear: "y = m·x + b",
  quadratic: "y = A·x² + B·x + C",
  cubic: "y = A·x³ + B·x² + C·x + D",
  quartic: "y = A·x⁴ + B·x³ + C·x² + D·x + E",
  power: "y = A·x^n + B",
  powerNoOffset: "y = A·x^n",
  inverse: "y = A/x + B",
  shiftedInverse: "y = A/(x − x₀) + B",
  inverseSquare: "y = A/x² + B",
  shiftedInverseSquare: "y = A/(x − x₀)² + B",
  exponential: "y = A·exp(k·(x − x₀))",
  exponentialBackground: "y = A·exp(k·x) + y₀",
  inverseExponential: "y = A·(1 − exp(−k·x)) + y₀",
  logarithmic: "y = A·ln(x) + B",
  sine: "y = A·sin(ω·x + φ) + C",
  dampedSine: "y = A·exp(−k·x)·sin(ω·x + φ) + C",
  sineSeries: "y = A₁·sin(ω·x + φ₁) + A₂·sin(2ω·x + φ₂) + A₃·sin(3ω·x + φ₃) + C",
  gaussian: "y = A·exp(−½·((x − μ)/σ)²) + y₀",
};

export function fitEquation(model: FitModelValue, xName = "x", yName = "y"): string {
  const x = /^\p{L}[\p{L}\p{N}_]*$/u.test(xName) ? xName : `[${xName}]`;
  return MODEL_EQUATIONS[model].replace(/\b[xy]\b(?![₀])/g, (symbol) => (symbol === "x" ? x : yName));
}

export const FIT_MODELS: readonly FitModelValue[] = Object.values(FitModel);

/** Powers of x in the units of nonlinear coefficients, with y units specified independently. */
const CURVE_UNITS: Partial<Record<FitModelValue, readonly string[]>> = {
  power: ["power", "", "y"],
  powerNoOffset: ["power", ""],
  shiftedInverse: ["yx", "x", "y"],
  shiftedInverseSquare: ["yxx", "x", "y"],
  exponential: ["y", "rate", "x"],
  exponentialBackground: ["y", "rate", "y"],
  inverseExponential: ["y", "rate", "y"],
  logarithmic: ["y", "y"],
  sine: ["y", "angularRate", "rad", "y"],
  dampedSine: ["y", "rate", "angularRate", "rad", "y"],
  sineSeries: ["angularRate", "y", "rad", "y", "rad", "y", "rad", "y"],
  gaussian: ["y", "x", "x", "y"],
};

export function fitParameterUnit(model: FitModelValue, index: number, xUnit: string, yUnit: string): string {
  const kind = CURVE_UNITS[model]?.[index];
  switch (kind) {
    case "x":
      return xUnit;
    case "y":
      return yUnit;
    case "yx":
      return parameterUnit(xUnit, yUnit, -1);
    case "yxx":
      return parameterUnit(xUnit, yUnit, -2);
    case "rate":
      return parameterUnit(xUnit, "", 1);
    case "angularRate":
      return parameterUnit(xUnit, "rad", 1);
    case "rad":
      return "rad";
    case "power": {
      const numerator = yUnit === "" ? "1" : needsParentheses(yUnit) ? `(${yUnit})` : yUnit;
      const denominator = needsParentheses(xUnit) ? `(${xUnit})` : xUnit;
      return xUnit === "" ? yUnit : `${numerator}/${denominator}^n`;
    }
    case "":
      return "";
    default: {
      const powers = MODEL_POWERS as Partial<Record<FitModelValue, readonly number[]>>;
      return parameterUnit(xUnit, yUnit, powers[model]?.[index] ?? 0);
    }
  }
}

const SUPERSCRIPTS: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

function superscript(exponent: number): string {
  return [...String(exponent)].map((char) => SUPERSCRIPTS[char] ?? char).join("");
}

function needsParentheses(unit: string): boolean {
  return /[\s/·*]/.test(unit);
}

/**
 * The unit of the coefficient of x^power: [y]/[x]^power. Built as text — "m/s²"
 * from "m" and "s" — with no attempt to simplify. Blank units drop out.
 */
export function parameterUnit(xUnit: string, yUnit: string, power: number): string {
  if (power === 0 || xUnit === "") {
    return yUnit;
  }
  if (power < 0) {
    const factor = `${needsParentheses(xUnit) ? `(${xUnit})` : xUnit}${power === -1 ? "" : superscript(-power)}`;
    return yUnit === "" ? factor : `${yUnit}·${factor}`;
  }
  const denominator = `${needsParentheses(xUnit) ? `(${xUnit})` : xUnit}${power === 1 ? "" : superscript(power)}`;
  const numerator = yUnit === "" ? "1" : needsParentheses(yUnit) ? `(${yUnit})` : yUnit;
  return `${numerator}/${denominator}`;
}

function exponentOf(value: number): number {
  return Math.floor(Math.log10(Math.abs(value)));
}

function usesFixed(magnitude: number): boolean {
  return magnitude === 0 || (magnitude >= FORMAT.FIXED_MIN && magnitude < FORMAT.FIXED_MAX);
}

/** A number to `digits` significant figures: "0.9012", or "3.161×10⁻¹⁵" when very large or small. */
export function formatSignificant(value: number, digits: number = FORMAT.DEFAULT_DIGITS): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (value === 0) {
    return "0";
  }
  if (usesFixed(Math.abs(value))) {
    const decimals = Math.max(0, digits - 1 - exponentOf(value));
    return toFixed(value, Math.min(decimals, FORMAT.MAX_FIXED_DECIMALS));
  }
  const exponent = exponentOf(value);
  return `${toFixed(value / 10 ** exponent, digits - 1)}×10${superscript(exponent)}`;
}

/**
 * A value with its standard error, both rounded so the error has two significant
 * figures: "0.9012 ± 0.0034", or "(−3.161 ± 0.049)×10⁻¹⁵". Without an error the
 * value is given to four significant figures.
 */
export function formatWithUncertainty(value: number, standardError: number | null): string {
  if (standardError === null || !Number.isFinite(standardError) || standardError <= 0) {
    return formatSignificant(value);
  }
  const leading = Math.max(Math.abs(value), standardError);
  if (usesFixed(leading)) {
    const decimals = FORMAT.UNCERTAINTY_DIGITS - 1 - exponentOf(standardError);
    if (decimals >= 0) {
      return `${toFixed(value, Math.min(decimals, FORMAT.MAX_FIXED_DECIMALS))} ± ${toFixed(standardError, Math.min(decimals, FORMAT.MAX_FIXED_DECIMALS))}`;
    }
    const step = 10 ** -decimals;
    return `${toFixed(Math.round(value / step) * step, 0)} ± ${toFixed(Math.round(standardError / step) * step, 0)}`;
  }
  const exponent = exponentOf(leading);
  const factor = 10 ** exponent;
  const decimals = Math.max(0, FORMAT.UNCERTAINTY_DIGITS - 1 - exponentOf(standardError / factor));
  return `(${toFixed(value / factor, decimals)} ± ${toFixed(standardError / factor, decimals)})×10${superscript(exponent)}`;
}

/** Appends a unit to a formatted number, or returns the number alone when there is no unit. */
export function withUnit(text: string, unit: string): string {
  return unit === "" ? text : `${text} ${unit}`;
}
