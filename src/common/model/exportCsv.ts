/**
 * exportCsv.ts
 *
 * The table as CSV text, with three columns added so a spreadsheet can reproduce
 * the fit: `in_fit` (1 for rows the fit used), `fit_value` (the model at that
 * row's x) and `residual` (y − fit, for rows the fit used). Pure, no SceneryStack
 * imports.
 *
 * Numeric cells are written from their numeric reading, so a table imported with
 * decimal commas exports with decimal points and re-imports unchanged.
 */

import { columnLabel, type Dataset } from "./Dataset.js";
import type { Inclusion } from "./includedRows.js";
import { evaluateFit, type FitResult } from "./leastSquares.js";

export const IN_FIT_HEADER = "in_fit";
export const FIT_VALUE_HEADER = "fit_value";
export const RESIDUAL_HEADER = "residual";

function quote(field: string): string {
  return /[",\n\r]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

export type FitExport = {
  readonly xColumnIndex: number;
  readonly inclusion: Inclusion;
  readonly fit: FitResult;
};

export function exportCsv(dataset: Dataset, fitExport: FitExport | null): string {
  const headers = dataset.columns.map(columnLabel);
  if (fitExport) {
    headers.push(IN_FIT_HEADER, FIT_VALUE_HEADER, RESIDUAL_HEADER);
  }
  const lines = [headers.map(quote).join(",")];

  // Residuals are listed per included row, in table order.
  const residualByRow = new Map<number, number>();
  if (fitExport?.fit.ok) {
    const { residuals } = fitExport.fit;
    fitExport.inclusion.indices.forEach((rowIndex, k) => {
      residualByRow.set(rowIndex, residuals[k] as number);
    });
  }

  for (let row = 0; row < dataset.rowCount; row++) {
    const cells = dataset.columns.map((column) => {
      const value = column.values[row] as number;
      return Number.isFinite(value) ? String(value) : (column.texts[row] ?? "");
    });
    if (fitExport) {
      const { fit, inclusion, xColumnIndex } = fitExport;
      const x = dataset.columns[xColumnIndex]?.values[row] ?? Number.NaN;
      cells.push(inclusion.flags[row] ? "1" : "0");
      cells.push(fit.ok && Number.isFinite(x) ? String(evaluateFit(fit.model, fit.parameters, x)) : "");
      const residual = residualByRow.get(row);
      cells.push(residual === undefined ? "" : String(residual));
    }
    lines.push(cells.map(quote).join(","));
  }
  return `${lines.join("\n")}\n`;
}
