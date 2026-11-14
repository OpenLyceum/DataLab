/** Local recovery for the last committed table on this browser and origin. */

import { compileFormula } from "../../common/model/columnFormula.js";
import { type Column, type Dataset, recalculateColumns } from "../../common/model/Dataset.js";

const STORAGE_KEY = "openlyceum.data-lab.table.v1";

/** JSON encodes NaN and infinities as null. Keep the parsed values alongside the original text. */
type StoredColumn = Omit<Column, "values"> & { readonly values: readonly (number | null)[] };

function isStoredColumn(value: unknown, rowCount: number): value is StoredColumn {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const column = value as Record<string, unknown>;
  return (
    typeof column["name"] === "string" &&
    typeof column["unit"] === "string" &&
    (column["formula"] === undefined || typeof column["formula"] === "string") &&
    Array.isArray(column["texts"]) &&
    column["texts"].length === rowCount &&
    column["texts"].every((text: unknown) => typeof text === "string") &&
    Array.isArray(column["values"]) &&
    column["values"].length === rowCount &&
    column["values"].every((cell: unknown) => cell === null || (typeof cell === "number" && Number.isFinite(cell)))
  );
}

export function decodeDataset(value: unknown): Dataset | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const {
    rowCount,
    columns,
    excludedRows = [],
  } = value as { rowCount?: number; columns?: unknown[]; excludedRows?: number[] };
  if (
    typeof rowCount !== "number" ||
    !Number.isSafeInteger(rowCount) ||
    rowCount < 0 ||
    !Array.isArray(columns) ||
    columns.length === 0 ||
    !columns.every(
      (column, index): column is StoredColumn =>
        isStoredColumn(column, rowCount) &&
        (column.formula === undefined || compileFormula(column.formula, index) !== null),
    ) ||
    !Array.isArray(excludedRows) ||
    !excludedRows.every((row) => Number.isInteger(row) && row >= 0 && row < rowCount)
  ) {
    return null;
  }
  return recalculateColumns({
    rowCount,
    columns: columns.map((column) => ({ ...column, values: column.values.map((cell) => cell ?? Number.NaN) })),
    excludedRows: [...new Set(excludedRows)],
  });
}

export function restoreDataset(): Dataset | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : decodeDataset(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDataset(dataset: Dataset): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
  } catch {
    // Storage can be disabled or full. The live table remains usable.
  }
}
