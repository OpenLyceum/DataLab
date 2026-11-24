import type { Dataset } from "../../common/model/Dataset.js";
import type { XRange } from "../../common/model/includedRows.js";
import { FitModel, type FitModelValue } from "../../common/model/leastSquares.js";
import { SESSION } from "../../DataLabConstants.js";
import { decodeDataset } from "./datasetStorage.js";

export type FitSettings = {
  readonly uncertaintyColumn: number;
  readonly model: FitModelValue;
  readonly range: XRange | null;
};

export type Session = FitSettings & {
  readonly dataset: Dataset;
  readonly xColumn: number;
  readonly yColumn: number;
  readonly logX: boolean;
  readonly logY: boolean;
  readonly showResiduals: boolean;
  readonly pin: FitSettings | null;
};

function validIndex(index: unknown, dataset: Dataset): index is number {
  return typeof index === "number" && Number.isInteger(index) && index >= -1 && index < dataset.columns.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function decodeInterval(value: unknown): XRange | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { min, max } = value;
  return typeof min === "number" &&
    typeof max === "number" &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min <= max
    ? { min, max }
    : undefined;
}

function decodeRange(value: unknown): XRange | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const x = decodeInterval(value);
  if (!x || value["y"] === undefined) {
    return x;
  }
  const y = decodeInterval(value["y"]);
  return y ? { ...x, y } : undefined;
}

function decodeFit(value: Record<string, unknown>, dataset: Dataset): FitSettings | null {
  const { uncertaintyColumn, model: savedModel, range: savedRange } = value;
  // "Weighted linear" was a separate model before weighting applied to every model.
  const model =
    savedModel === "weightedLinear"
      ? FitModel.LINEAR
      : Object.values(FitModel).find((candidate) => candidate === savedModel);
  const range = decodeRange(savedRange);
  return validIndex(uncertaintyColumn, dataset) && model !== undefined && range !== undefined
    ? { uncertaintyColumn, model, range }
    : null;
}

export type NamedRun = {
  readonly name: string;
  readonly session: Session;
};

export type RunSession = {
  readonly runs: readonly NamedRun[];
  readonly activeIndex: number;
};

function decodeRun(value: unknown): Session | null {
  if (!isRecord(value)) {
    return null;
  }
  const { dataset: savedDataset, xColumn, yColumn, logX, logY, showResiduals, pin: savedPin } = value;
  const dataset = decodeDataset(savedDataset);
  if (
    !(dataset && validIndex(xColumn, dataset) && validIndex(yColumn, dataset)) ||
    typeof logX !== "boolean" ||
    typeof logY !== "boolean" ||
    typeof showResiduals !== "boolean"
  ) {
    return null;
  }
  const fit = decodeFit(value, dataset);
  const pin = isRecord(savedPin) ? decodeFit(savedPin, dataset) : null;
  if (!fit || (savedPin !== null && (!pin || pin.range === null))) {
    return null;
  }
  return { ...fit, dataset, xColumn, yColumn, logX, logY, showResiduals, pin };
}

export const MAX_RUN_NAME_LENGTH = SESSION.MAX_RUN_NAME_LENGTH;

export function encodeSession(session: RunSession): string {
  return JSON.stringify({ ...session, format: "openlyceum-data-lab", version: 2 });
}

export function decodeSession(text: string, legacyName: string): RunSession | null {
  try {
    const file: unknown = JSON.parse(text);
    if (!isRecord(file) || file["format"] !== "openlyceum-data-lab") {
      return null;
    }
    if (file["version"] === 1) {
      const session = decodeRun(file);
      return session ? { runs: [{ name: legacyName, session }], activeIndex: 0 } : null;
    }
    const { runs, activeIndex } = file;
    if (
      file["version"] !== 2 ||
      !Array.isArray(runs) ||
      typeof activeIndex !== "number" ||
      !Number.isInteger(activeIndex) ||
      activeIndex < 0 ||
      activeIndex >= runs.length
    ) {
      return null;
    }
    const decoded: NamedRun[] = [];
    const rawRuns: readonly unknown[] = runs;
    for (const run of rawRuns) {
      if (!isRecord(run)) {
        return null;
      }
      const session = decodeRun(run["session"]);
      const name = run["name"];
      if (!session || typeof name !== "string" || !name.trim() || name.length > MAX_RUN_NAME_LENGTH) {
        return null;
      }
      decoded.push({ name, session });
    }
    return { runs: decoded, activeIndex };
  } catch {
    return null;
  }
}
