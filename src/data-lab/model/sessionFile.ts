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

export type NamedRun = {
  readonly name: string;
  readonly session: Session;
};

export type RunSession = {
  readonly runs: readonly NamedRun[];
  readonly activeIndex: number;
};

function decodeRun(value: unknown): Session | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const file = value as Session;
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
}

export const MAX_RUN_NAME_LENGTH = 80;

export function encodeSession(session: RunSession): string {
  return JSON.stringify({ ...session, format: "openlyceum-data-lab", version: 2 });
}

export function decodeSession(text: string, legacyName: string): RunSession | null {
  try {
    const file = JSON.parse(text) as { format?: string; version?: number; runs?: NamedRun[]; activeIndex?: number };
    if (file?.format !== "openlyceum-data-lab") {
      return null;
    }
    if (file.version === 1) {
      const session = decodeRun(file);
      return session ? { runs: [{ name: legacyName, session }], activeIndex: 0 } : null;
    }
    const { runs, activeIndex } = file;
    if (
      file.version !== 2 ||
      !Array.isArray(runs) ||
      typeof activeIndex !== "number" ||
      !Number.isInteger(activeIndex) ||
      activeIndex < 0 ||
      activeIndex >= runs.length
    ) {
      return null;
    }
    const decoded: NamedRun[] = [];
    for (const run of runs) {
      const session = decodeRun(run?.session);
      const name = run?.name;
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
