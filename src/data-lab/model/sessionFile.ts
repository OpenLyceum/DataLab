import type { Dataset } from "../../common/model/Dataset.js";
import type { XRange } from "../../common/model/includedRows.js";
import { FitModel, type FitModelValue } from "../../common/model/leastSquares.js";
import { decodeDataset } from "./datasetStorage.js";

export const SESSION_FILE_NAME = "data-lab.session.json";

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

function validRange(range: unknown): range is XRange | null {
  if (range === null) {
    return true;
  }
  if (!range || typeof range !== "object") {
    return false;
  }
  const { min, max } = range as XRange;
  return Number.isFinite(min) && Number.isFinite(max) && min <= max;
}

function validFit(value: unknown, dataset: Dataset): value is FitSettings {
  if (!value || typeof value !== "object") {
    return false;
  }
  const { uncertaintyColumn, model, range } = value as FitSettings;
  return validIndex(uncertaintyColumn, dataset) && Object.values(FitModel).includes(model) && validRange(range);
}

export function encodeSession(session: Session): string {
  return JSON.stringify({ ...session, format: "openlyceum-data-lab", version: 1 });
}

export function decodeSession(text: string): Session | null {
  try {
    const file = JSON.parse(text) as Session & { format?: string; version?: number };
    if (file?.format !== "openlyceum-data-lab" || file.version !== 1) {
      return null;
    }
    const dataset = decodeDataset(file.dataset);
    if (
      !(dataset && validFit(file, dataset) && validIndex(file.xColumn, dataset) && validIndex(file.yColumn, dataset)) ||
      typeof file.logX !== "boolean" ||
      typeof file.logY !== "boolean" ||
      typeof file.showResiduals !== "boolean" ||
      (file.pin !== null && (!validFit(file.pin, dataset) || file.pin.range === null))
    ) {
      return null;
    }
    return { ...file, dataset };
  } catch {
    return null;
  }
}
