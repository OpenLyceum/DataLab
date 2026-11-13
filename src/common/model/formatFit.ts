/**
 * formatFit.ts
 *
 * Turns fit numbers into what a student reads: parameter units built from the
 * column units, and values rounded to match their uncertainty. Pure, no
 * SceneryStack imports.
 */

import { FitModel, type FitModelValue } from "./leastSquares.js";

/** Parameter symbols, in the order the fit reports its parameters. */
export const MODEL_SYMBOLS: Record<FitModelValue, readonly string[]> = {
  proportional: ["A"],
  linear: ["m", "b"],
  quadratic: ["A", "B", "C"],
};

/** The model written out. Mathematical notation, the same in every language. */
export const MODEL_EQUATIONS: Record<FitModelValue, string> = {
  proportional: "y = A·x",
  linear: "y = m·x + b",
  quadratic: "y = A·x² + B·x + C",
};

export const FIT_MODELS: readonly FitModelValue[] = [FitModel.PROPORTIONAL, FitModel.LINEAR, FitModel.QUADRATIC];

/** Significant figures kept in an uncertainty, and so in the value it belongs to. */
const UNCERTAINTY_DIGITS = 2;

/** Significant figures for a value shown without an uncertainty. */
const DEFAULT_DIGITS = 4;

/** Outside this range of magnitudes a number is written with a power of ten. */
const FIXED_MIN = 1e-4;
const FIXED_MAX = 1e6;

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
  const denominator = `${needsParentheses(xUnit) ? `(${xUnit})` : xUnit}${power === 1 ? "" : superscript(power)}`;
  const numerator = yUnit === "" ? "1" : needsParentheses(yUnit) ? `(${yUnit})` : yUnit;
  return `${numerator}/${denominator}`;
}

function exponentOf(value: number): number {
  return Math.floor(Math.log10(Math.abs(value)));
}

function usesFixed(magnitude: number): boolean {
  return magnitude === 0 || (magnitude >= FIXED_MIN && magnitude < FIXED_MAX);
}

/** A number to `digits` significant figures: "0.9012", or "3.161×10⁻¹⁵" when very large or small. */
export function formatSignificant(value: number, digits = DEFAULT_DIGITS): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (value === 0) {
    return "0";
  }
  if (usesFixed(Math.abs(value))) {
    const decimals = Math.max(0, digits - 1 - exponentOf(value));
    return value.toFixed(Math.min(decimals, 100));
  }
  const exponent = exponentOf(value);
  return `${(value / 10 ** exponent).toFixed(digits - 1)}×10${superscript(exponent)}`;
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
    const decimals = UNCERTAINTY_DIGITS - 1 - exponentOf(standardError);
    if (decimals >= 0) {
      return `${value.toFixed(Math.min(decimals, 100))} ± ${standardError.toFixed(Math.min(decimals, 100))}`;
    }
    const step = 10 ** -decimals;
    return `${(Math.round(value / step) * step).toFixed(0)} ± ${(Math.round(standardError / step) * step).toFixed(0)}`;
  }
  const exponent = exponentOf(leading);
  const factor = 10 ** exponent;
  const decimals = Math.max(0, UNCERTAINTY_DIGITS - 1 - exponentOf(standardError / factor));
  return `(${(value / factor).toFixed(decimals)} ± ${(standardError / factor).toFixed(decimals)})×10${superscript(exponent)}`;
}

/** Appends a unit to a formatted number, or returns the number alone when there is no unit. */
export function withUnit(text: string, unit: string): string {
  return unit === "" ? text : `${text} ${unit}`;
}
