/**
 * Dataset.ts
 *
 * The student's table: named columns with units, one text cell per row. Pure, no
 * SceneryStack imports.
 *
 * The text is the source of truth — it is exactly what was imported or typed — and
 * `values` is its numeric reading, NaN where a cell is blank or not a number. Every
 * operation returns a new Dataset, so a Property holding one notifies on each edit.
 */

import { compileFormula, formulaReferences, shiftFormulaAfterDeletion } from "./columnFormula.js";

export type Column = {
  readonly name: string;
  readonly unit: string;
  readonly formula?: string;
  /** Cell text as imported or typed, one per row. */
  readonly texts: readonly string[];
  /** Numeric reading of each cell; NaN for a blank or non-numeric cell. */
  readonly values: readonly number[];
};

export type Dataset = {
  readonly columns: readonly Column[];
  readonly rowCount: number;
  /** Manually excluded row indices, independent of the selected fit range. */
  readonly excludedRows?: readonly number[];
};

const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const DECIMAL_COMMA_PATTERN = /^[+-]?(\d+,?\d*|,\d+)([eE][+-]?\d+)?$/;

/**
 * Reads a cell as a number, or NaN. With `decimalComma`, "1,5" reads as 1.5 —
 * used for tables whose delimiter is not a comma.
 */
export function parseNumber(text: string, decimalComma = false): number {
  const trimmed = text.trim().replace(/−/g, "-");
  if (NUMBER_PATTERN.test(trimmed)) {
    return Number(trimmed);
  }
  if (decimalComma && DECIMAL_COMMA_PATTERN.test(trimmed)) {
    return Number(trimmed.replace(",", "."));
  }
  return Number.NaN;
}

export function createColumn(name: string, unit: string, texts: readonly string[], decimalComma = false): Column {
  return { name, unit, texts, values: texts.map((text) => parseNumber(text, decimalComma)) };
}

/** True when the column has at least one numeric cell, so it can go on an axis. */
export function isNumericColumn(column: Column): boolean {
  return column.values.some((value) => Number.isFinite(value));
}

/** The label used on axes and headers: "Time (s)", or just "Time" without a unit. */
export function columnLabel(column: Column): string {
  return column.unit === "" ? column.name : `${column.name} (${column.unit})`;
}

/** Recalculate left to right so a formula can use earlier calculated columns. */
export function recalculateColumns(dataset: Dataset): Dataset {
  if (!dataset.columns.some((column) => column.formula !== undefined)) {
    return dataset;
  }
  const columns: Column[] = [];
  for (const column of dataset.columns) {
    if (column.formula === undefined) {
      columns.push(column);
      continue;
    }
    const expression = compileFormula(column.formula, columns.length);
    const values = Array.from({ length: dataset.rowCount }, (_, row) => {
      let validInputs = true;
      const value =
        expression?.((index) => {
          const input = columns[index]?.values[row] ?? Number.NaN;
          validInputs &&= Number.isFinite(input);
          return input;
        }) ?? Number.NaN;
      return validInputs && Number.isFinite(value) ? value : Number.NaN;
    });
    columns.push({ ...column, values, texts: values.map((value) => (Number.isFinite(value) ? String(value) : "")) });
  }
  return { ...dataset, columns };
}

export function setCalculatedColumn(
  dataset: Dataset,
  index: number,
  name: string,
  unit: string,
  formula: string,
): Dataset {
  if (
    !(name && Number.isInteger(index)) ||
    index < 0 ||
    index > dataset.columns.length ||
    !compileFormula(formula, index)
  ) {
    return dataset;
  }
  const columns = [...dataset.columns];
  columns[index] = { name, unit, formula, values: [], texts: [] };
  return recalculateColumns({ ...dataset, columns });
}

export function canDeleteColumn(dataset: Dataset, index: number): boolean {
  return !dataset.columns.some((column) => column.formula && formulaReferences(column.formula).includes(index));
}

function replaceColumn(dataset: Dataset, columnIndex: number, column: Column): Dataset {
  return { ...dataset, columns: dataset.columns.map((existing, i) => (i === columnIndex ? column : existing)) };
}

/** Replaces one cell's text. Typed cells accept either decimal mark. */
export function setCell(dataset: Dataset, rowIndex: number, columnIndex: number, text: string): Dataset {
  const column = dataset.columns[columnIndex];
  if (!column || column.formula !== undefined || rowIndex < 0 || rowIndex >= dataset.rowCount) {
    return dataset;
  }
  const texts = column.texts.map((existing, i) => (i === rowIndex ? text : existing));
  const values = column.values.map((existing, i) => (i === rowIndex ? parseNumber(text, true) : existing));
  return recalculateColumns(replaceColumn(dataset, columnIndex, { ...column, texts, values }));
}

export function setColumnHeader(dataset: Dataset, columnIndex: number, name: string, unit: string): Dataset {
  const column = dataset.columns[columnIndex];
  return column ? replaceColumn(dataset, columnIndex, { ...column, name, unit }) : dataset;
}

export function setRowExcluded(dataset: Dataset, rowIndex: number, excluded: boolean): Dataset {
  const current = dataset.excludedRows ?? [];
  if (
    !Number.isInteger(rowIndex) ||
    rowIndex < 0 ||
    rowIndex >= dataset.rowCount ||
    current.includes(rowIndex) === excluded
  ) {
    return dataset;
  }
  return {
    ...dataset,
    excludedRows: excluded ? [...current, rowIndex] : current.filter((row) => row !== rowIndex),
  };
}

/** Appends one blank row. */
export function addRow(dataset: Dataset): Dataset {
  return recalculateColumns({
    ...dataset,
    rowCount: dataset.rowCount + 1,
    columns: dataset.columns.map((column) => ({
      ...column,
      texts: [...column.texts, ""],
      values: [...column.values, Number.NaN],
    })),
  });
}

export function deleteRow(dataset: Dataset, rowIndex: number): Dataset {
  if (rowIndex < 0 || rowIndex >= dataset.rowCount) {
    return dataset;
  }
  return {
    rowCount: dataset.rowCount - 1,
    excludedRows: (dataset.excludedRows ?? [])
      .filter((row) => row !== rowIndex)
      .map((row) => (row > rowIndex ? row - 1 : row)),
    columns: dataset.columns.map((column) => ({
      ...column,
      texts: column.texts.filter((_, i) => i !== rowIndex),
      values: column.values.filter((_, i) => i !== rowIndex),
    })),
  };
}

/** Appends a blank column without reinterpreting the existing cells. */
export function addColumn(dataset: Dataset, name: string): Dataset {
  const texts = Array.from({ length: dataset.rowCount }, () => "");
  return { ...dataset, columns: [...dataset.columns, createColumn(name, "", texts)] };
}

export function deleteColumn(dataset: Dataset, columnIndex: number): Dataset {
  if (!(dataset.columns[columnIndex] && canDeleteColumn(dataset, columnIndex))) {
    return dataset;
  }
  const columns = dataset.columns
    .filter((_, i) => i !== columnIndex)
    .map((column) =>
      column.formula === undefined
        ? column
        : { ...column, formula: shiftFormulaAfterDeletion(column.formula, columnIndex) },
    );
  return { ...dataset, columns };
}

/**
 * Writes a pasted block of cells into the table starting at (rowIndex, columnIndex),
 * adding rows as needed. Cells that fall to the right of the last column are dropped.
 */
export function pasteBlock(
  dataset: Dataset,
  rowIndex: number,
  columnIndex: number,
  block: readonly (readonly string[])[],
): Dataset {
  const extra = Math.max(0, rowIndex + block.length - dataset.rowCount);
  const result =
    extra === 0
      ? dataset
      : {
          ...dataset,
          rowCount: dataset.rowCount + extra,
          columns: dataset.columns.map((column) => ({
            ...column,
            texts: [...column.texts, ...new Array<string>(extra).fill("")],
            values: [...column.values, ...new Array<number>(extra).fill(Number.NaN)],
          })),
        };
  const columns = result.columns.map((column, c) => {
    const offset = c - columnIndex;
    if (offset < 0 || column.formula !== undefined) {
      return column;
    }
    const texts = [...column.texts];
    const values = [...column.values];
    let changed = false;
    block.forEach((cells, r) => {
      const text = cells[offset];
      if (text !== undefined) {
        texts[rowIndex + r] = text;
        values[rowIndex + r] = parseNumber(text, true);
        changed = true;
      }
    });
    return changed ? { ...column, texts, values } : column;
  });
  return recalculateColumns({ ...result, columns });
}
