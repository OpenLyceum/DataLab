/**
 * fitText.ts
 *
 * The words that describe the current selection and fit. One source for the
 * status line under the graphs, the results panel, the copied summary and the
 * screen-reader summary, so they always say the same thing.
 */

import { DerivedProperty, type TReadOnlyProperty } from "scenerystack/axon";
import {
  formatSignificant,
  formatWithUncertainty,
  MODEL_EQUATIONS,
  MODEL_SYMBOLS,
  parameterUnit,
  withUnit,
} from "../../common/model/formatFit.js";
import {
  type FitFailure,
  FitFailureReason,
  type FitModelValue,
  type FitSuccess,
  MODEL_POWERS,
} from "../../common/model/leastSquares.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";
import { fillPattern } from "./fillPattern.js";

/** Below this many points left over (n − p), the uncertainties come with a caution. */
const CAUTION_DEGREES_OF_FREEDOM = 3;

const R_SQUARED_DIGITS = 5;

export type FitText = {
  /** "Using 31 of 61 rows · Time from 0 s to 1.5 s". */
  readonly status: string;
  /** Translated name of the model: "Linear". */
  readonly modelName: string;
  /** "y = m·x + b". */
  readonly equation: string;
  /** One line per parameter and statistic, or the reason there is no fit. */
  readonly lines: readonly string[];
  /** A caution about the uncertainties, or "". */
  readonly caution: string;
};

/** The translated name of each model, as string Properties. */
export function modelNameProperties(): Record<FitModelValue, TReadOnlyProperty<string>> {
  const labels = StringManager.getInstance().getLabels();
  return {
    proportional: labels.proportionalStringProperty,
    linear: labels.linearStringProperty,
    quadratic: labels.quadraticStringProperty,
  };
}

type Labels = ReturnType<StringManager["getLabels"]>;

function statusText(model: DataLabModel, labels: Labels): string {
  const inclusion = model.inclusionProperty.value;
  const range = model.rangeProperty.value;
  const xColumn = model.xColumnProperty.value;
  const xUnit = xColumn?.unit ?? "";
  const used = inclusion.indices.length;
  const total = model.datasetProperty.value.rowCount;
  const status = range
    ? fillPattern(labels.statusRangeStringProperty.value, {
        used,
        total,
        name: xColumn?.name ?? "x",
        min: withUnit(formatSignificant(range.min), xUnit),
        max: withUnit(formatSignificant(range.max), xUnit),
      })
    : fillPattern(labels.statusAllStringProperty.value, { used, total });
  return inclusion.skippedCount > 0
    ? `${status} · ${fillPattern(labels.statusSkippedStringProperty.value, { count: inclusion.skippedCount })}`
    : status;
}

/** One line per parameter, then RMSE, R² and the number of points. */
function successLines(fit: FitSuccess, xUnit: string, yUnit: string, labels: Labels): string[] {
  const symbols = MODEL_SYMBOLS[fit.model];
  const powers = MODEL_POWERS[fit.model];
  const lines = fit.parameters.map((value, j) => {
    const formatted = formatWithUncertainty(value, fit.standardErrors?.[j] ?? null);
    return `${symbols[j]} = ${withUnit(formatted, parameterUnit(xUnit, yUnit, powers[j] as number))}`;
  });
  if (fit.rmse !== null) {
    lines.push(
      fillPattern(labels.rmseStringProperty.value, { value: withUnit(formatSignificant(fit.rmse, 3), yUnit) }),
    );
  }
  if (fit.rSquared !== null) {
    lines.push(
      fillPattern(labels.rSquaredStringProperty.value, { value: formatSignificant(fit.rSquared, R_SQUARED_DIGITS) }),
    );
  }
  lines.push(fillPattern(labels.pointsUsedStringProperty.value, { count: fit.count }));
  return lines;
}

function cautionText(fit: FitSuccess, labels: Labels): string {
  if (fit.degreesOfFreedom === 0) {
    return labels.noScatterStringProperty.value;
  }
  return fit.degreesOfFreedom < CAUTION_DEGREES_OF_FREEDOM ? labels.fewPointsStringProperty.value : "";
}

function failureLine(fit: FitFailure, labels: Labels): string {
  const pattern =
    fit.reason === FitFailureReason.TOO_FEW_POINTS
      ? labels.tooFewPointsStringProperty.value
      : fit.reason === FitFailureReason.ALL_X_ZERO
        ? labels.allXZeroStringProperty.value
        : labels.tooFewDistinctXStringProperty.value;
  return fillPattern(pattern, { required: fit.required });
}

/** A Property holding the current description; it follows the model and the language. */
export function createFitTextProperty(model: DataLabModel): TReadOnlyProperty<FitText> {
  const labels = StringManager.getInstance().getLabels();
  const names = modelNameProperties();
  return DerivedProperty.deriveAny(
    [
      model.datasetProperty,
      model.inclusionProperty,
      model.fitProperty,
      model.rangeProperty,
      names.proportional,
      names.linear,
      names.quadratic,
      labels.statusAllStringProperty,
      labels.statusRangeStringProperty,
      labels.statusSkippedStringProperty,
      labels.pointsUsedStringProperty,
      labels.rmseStringProperty,
      labels.rSquaredStringProperty,
      labels.tooFewPointsStringProperty,
      labels.tooFewDistinctXStringProperty,
      labels.allXZeroStringProperty,
      labels.noScatterStringProperty,
      labels.fewPointsStringProperty,
    ],
    (): FitText => {
      const fit = model.fitProperty.value;
      const xUnit = model.xColumnProperty.value?.unit ?? "";
      const yUnit = model.yColumnProperty.value?.unit ?? "";
      return {
        status: statusText(model, labels),
        modelName: names[fit.model].value,
        equation: MODEL_EQUATIONS[fit.model],
        lines: fit.ok ? successLines(fit, xUnit, yUnit, labels) : [failureLine(fit, labels)],
        caution: fit.ok ? cautionText(fit, labels) : "",
      };
    },
  );
}

/** The fit as plain text, for pasting into a lab report. */
export function fitSummary(text: FitText): string {
  return [`${text.modelName}: ${text.equation}`, ...text.lines, text.caution, text.status]
    .filter((line) => line !== "")
    .join("\n");
}
