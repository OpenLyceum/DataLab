/**
 * Reading a stored table, and recovery of the single table that releases before
 * workspace recovery kept under their own key. See workspaceStorage.ts.
 */

import { compileFormula } from "../../common/model/columnFormula.js";
import { type Column, type Dataset, recalculateColumns } from "../../common/model/Dataset.js";

const STORAGE_KEY = "openlyceum.data-lab.table.v1";

/** JSON encodes NaN and infinities as null. Keep the parsed values alongside the original text. */
type StoredColumn = Omit<Column, "values"> & { readonly values: readonly (number | null)[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStoredColumn(column: unknown, rowCount: number): column is StoredColumn {
  if (!isRecord(column)) {
    return false;
  }
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
  if (!isRecord(value)) {
    return null;
  }
  const { rowCount, columns: rawColumns, excludedRows: rawExcludedRows = [] } = value;
  if (!(Array.isArray(rawColumns) && Array.isArray(rawExcludedRows))) {
    return null;
  }
  const columns: readonly unknown[] = rawColumns;
  const excludedRows: readonly unknown[] = rawExcludedRows;
  if (
    typeof rowCount !== "number" ||
    !Number.isSafeInteger(rowCount) ||
    rowCount < 0 ||
    columns.length === 0 ||
    !columns.every(
      (column, index): column is StoredColumn =>
        isStoredColumn(column, rowCount) &&
        (column.formula === undefined || compileFormula(column.formula, index) !== null),
    ) ||
    !excludedRows.every(
      (row): row is number => typeof row === "number" && Number.isInteger(row) && row >= 0 && row < rowCount,
    )
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

/** Drops the single-table copy once the whole workspace has been saved. */
export function forgetDataset(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be disabled. There is then nothing to forget.
  }
}
