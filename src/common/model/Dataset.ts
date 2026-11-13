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

export type Column = {
  readonly name: string;
  readonly unit: string;
  /** Cell text as imported or typed, one per row. */
  readonly texts: readonly string[];
  /** Numeric reading of each cell; NaN for a blank or non-numeric cell. */
  readonly values: readonly number[];
};

export type Dataset = {
  readonly columns: readonly Column[];
  readonly rowCount: number;
};

export const EMPTY_DATASET: Dataset = { columns: [], rowCount: 0 };

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

function replaceColumn(dataset: Dataset, columnIndex: number, column: Column): Dataset {
  return { ...dataset, columns: dataset.columns.map((existing, i) => (i === columnIndex ? column : existing)) };
}

/** Replaces one cell's text. Typed cells accept either decimal mark. */
export function setCell(dataset: Dataset, rowIndex: number, columnIndex: number, text: string): Dataset {
  const column = dataset.columns[columnIndex];
  if (!column || rowIndex < 0 || rowIndex >= dataset.rowCount) {
    return dataset;
  }
  const texts = column.texts.map((existing, i) => (i === rowIndex ? text : existing));
  const values = column.values.map((existing, i) => (i === rowIndex ? parseNumber(text, true) : existing));
  return replaceColumn(dataset, columnIndex, { ...column, texts, values });
}

export function setColumnHeader(dataset: Dataset, columnIndex: number, name: string, unit: string): Dataset {
  const column = dataset.columns[columnIndex];
  return column ? replaceColumn(dataset, columnIndex, { ...column, name, unit }) : dataset;
}

/** Appends one blank row. */
export function addRow(dataset: Dataset): Dataset {
  return {
    rowCount: dataset.rowCount + 1,
    columns: dataset.columns.map((column) => ({
      ...column,
      texts: [...column.texts, ""],
      values: [...column.values, Number.NaN],
    })),
  };
}

export function deleteRow(dataset: Dataset, rowIndex: number): Dataset {
  if (rowIndex < 0 || rowIndex >= dataset.rowCount) {
    return dataset;
  }
  return {
    rowCount: dataset.rowCount - 1,
    columns: dataset.columns.map((column) => ({
      ...column,
      texts: column.texts.filter((_, i) => i !== rowIndex),
      values: column.values.filter((_, i) => i !== rowIndex),
    })),
  };
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
  let result = dataset;
  while (result.rowCount < rowIndex + block.length) {
    result = addRow(result);
  }
  const columns = result.columns.map((column, c) => {
    const offset = c - columnIndex;
    if (offset < 0) {
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
  return { rowCount: result.rowCount, columns };
}
