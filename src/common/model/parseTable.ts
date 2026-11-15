/**
 * parseTable.ts
 *
 * Turns CSV text or a block pasted from a spreadsheet into a Dataset. Pure, no
 * SceneryStack imports.
 *
 * Handles what real lab files contain: a byte-order mark, CRLF line ends, comma,
 * tab or semicolon delimiters, quoted fields, a header row with units written as
 * "Time (s)" or "Time [s]", blank cells, and decimal commas (read as decimals
 * only when the delimiter is not itself a comma).
 */

import { PARSE } from "../../DataLabConstants.js";
import { type Column, createColumn, type Dataset, parseNumber } from "./Dataset.js";

/** A single space stands for "any run of spaces or tabs", as in whitespace-aligned data files. */
export type Delimiter = "," | "\t" | ";" | " ";

export type ParsedTable = {
  readonly dataset: Dataset;
  readonly delimiter: Delimiter;
  readonly hasHeader: boolean;
  readonly decimalComma: boolean;
  /** Non-blank lines above the table (a title, export notes) that were left out. */
  readonly skippedLines: number;
  /** True when the row under the header was read as units. */
  readonly hasUnitsRow: boolean;
};

/** Every reading choice is guessed from the text unless it is given here. */
export type ParseOptions = {
  /** Name for a column with no header, from its 1-based position. */
  readonly defaultColumnName?: (position: number) => string;
  readonly delimiter?: Delimiter;
  readonly decimalComma?: boolean;
  /** Non-blank lines to leave out above the table. */
  readonly skippedLines?: number;
  readonly hasHeader?: boolean;
  readonly hasUnitsRow?: boolean;
};

/** Tried in this order; the first that splits every sampled line the same way wins. */
const DELIMITERS: readonly Exclude<Delimiter, " ">[] = ["\t", ";", ","];

const HEADER_UNIT_PATTERN = /^(.*?)\s*[([]\s*([^)\]]*?)\s*[)\]]$/;

/** A units cell is short: "m/s", "(°C)". Longer text is data. */
const MAX_UNIT_LENGTH = 16;

/** Splits text into rows of cells, honouring double-quoted fields (RFC 4180). */
export function tokenize(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function countOutsideQuotes(line: string, delimiter: Delimiter): number {
  let count = 0;
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      count++;
    }
  }
  return count;
}

/** Splits whitespace-aligned lines; "Time (s)" stays one header although it holds a space. */
function tokenizeWhitespace(text: string): string[][] {
  return text.split("\n").map((line) => {
    const cells: string[] = [];
    for (const token of line.trim().split(/\s+/)) {
      if (/^[([]/.test(token) && cells.length > 0) {
        cells[cells.length - 1] += ` ${token}`;
      } else {
        cells.push(token);
      }
    }
    return cells;
  });
}

/** True when every line is the same number (two or more) of numbers separated by spaces. */
function isWhitespaceTable(lines: readonly string[]): boolean {
  const dataLines = lines.length > 1 ? lines.slice(1) : lines;
  let width = 0;
  for (const line of dataLines) {
    const tokens = line.trim().split(/\s+/);
    if (
      tokens.length < 2 ||
      (width !== 0 && tokens.length !== width) ||
      /[\t;]/.test(line.trim()) ||
      tokens.some((token) => token.endsWith(",") || !Number.isFinite(parseNumber(token, true)))
    ) {
      return false;
    }
    width = tokens.length;
  }
  return width >= 2;
}

/**
 * Guesses the delimiter from the first lines: a tab or semicolon that appears the
 * same non-zero number of times on every line of the table (title lines above it
 * aside), else columns of numbers separated by spaces, else a comma, else the
 * most frequent of the three.
 * @internal Exported for unit tests; not part of the application API.
 */
export function sniffDelimiter(text: string): Delimiter {
  const lines = text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .slice(0, PARSE.SNIFF_LINE_COUNT);
  let best: Delimiter = ",";
  let bestTotal = 0;
  for (const delimiter of DELIMITERS) {
    if (delimiter === "," && isWhitespaceTable(lines)) {
      return " ";
    }
    const counts = lines.map((line) => countOutsideQuotes(line, delimiter));
    // Lines above the table (a title) need not hold the delimiter at all.
    const table = counts.slice(
      Math.max(
        counts.findIndex((count) => count > 0),
        0,
      ),
    );
    const first = table[0] ?? 0;
    if (first > 0 && (table.length > 1 || counts.length === 1) && table.every((count) => count === first)) {
      return delimiter;
    }
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (total > bestTotal) {
      best = delimiter;
      bestTotal = total;
    }
  }
  return best;
}

/** Splits "Time (s)" or "Time [s]" into name and unit; no brackets means no unit. */
export function splitHeader(header: string): { name: string; unit: string } {
  const trimmed = header.trim();
  const match = HEADER_UNIT_PATTERN.exec(trimmed);
  if (match && (match[1] as string) !== "") {
    return { name: match[1] as string, unit: match[2] as string };
  }
  return { name: trimmed, unit: "" };
}

/** Cells up to the last one that holds anything. */
function widthOf(row: readonly string[]): number {
  for (let c = row.length - 1; c >= 0; c--) {
    if (row[c] !== "") {
      return c + 1;
    }
  }
  return 0;
}

/**
 * A lone column of decimal-comma numbers under a one-word header reads, with a
 * comma delimiter, as two columns of integers. The header gives it away: it names
 * one column, not two.
 */
function isSingleDecimalCommaColumn(rows: readonly (readonly string[])[]): boolean {
  const [header, ...body] = rows;
  return (
    header !== undefined &&
    body.length > 0 &&
    widthOf(header) === 1 &&
    !Number.isFinite(parseNumber(header[0] as string)) &&
    body.every((row) => row.length === 2 && /^[+-]?\d+$/.test(row[0] as string) && /^\d+$/.test(row[1] as string))
  );
}

/**
 * Lines above the table — a title, the name of the logger — are narrower than the
 * table itself. Counts the leading rows narrower than the most common width.
 */
function countPreamble(rows: readonly (readonly string[])[]): number {
  const tally = new Map<number, number>();
  for (const row of rows) {
    const width = widthOf(row);
    tally.set(width, (tally.get(width) ?? 0) + 1);
  }
  let common = 0;
  let commonCount = 0;
  for (const [width, count] of tally) {
    if (count > commonCount || (count === commonCount && width > common)) {
      common = width;
      commonCount = count;
    }
  }
  if (common < 2) {
    return 0;
  }
  const first = rows.findIndex((row) => widthOf(row) >= common);
  return Math.max(first, 0);
}

/** "(m/s)" or "[m/s]" or "m/s" as a bare unit. */
function bareUnit(cell: string): string {
  return cell.replace(/^[([]\s*/, "").replace(/\s*[)\]]$/, "");
}

/** A units row sits between a header without units of its own and the numbers. */
function looksLikeUnitsRow(rows: readonly (readonly string[])[], isText: (cell: string) => boolean): boolean {
  const filled = (row: readonly string[] | undefined) => (row ?? []).filter((cell) => cell !== "");
  const second = filled(rows[1]);
  return (
    second.length > 0 &&
    second.every((cell) => isText(cell) && cell.length <= MAX_UNIT_LENGTH) &&
    filled(rows[2]).some((cell) => !isText(cell)) &&
    (rows[0] ?? []).every((cell) => splitHeader(cell).unit === "")
  );
}

/** Cells of every non-blank line, trimmed. */
function readRows(text: string, delimiter: Delimiter): string[][] {
  return (delimiter === " " ? tokenizeWhitespace(text) : tokenize(text, delimiter))
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ""));
}

export function parseTable(input: string, options: ParseOptions = {}): ParsedTable {
  const defaultColumnName = options.defaultColumnName ?? ((position: number) => `Column ${position}`);
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  let delimiter = options.delimiter ?? sniffDelimiter(text);
  let decimalComma = options.decimalComma ?? delimiter !== ",";

  let rows = readRows(text, delimiter);
  if (
    options.delimiter === undefined &&
    options.decimalComma === undefined &&
    delimiter === "," &&
    isSingleDecimalCommaColumn(rows)
  ) {
    rows = rows.map((row) => [row.join(",")]);
    delimiter = "\t";
    decimalComma = true;
  }

  const skippedLines = Math.min(options.skippedLines ?? countPreamble(rows), Math.max(rows.length - 1, 0));
  rows = rows.slice(skippedLines);

  const columnCount = rows.reduce((widest, row) => Math.max(widest, widthOf(row)), 0);
  const isText = (cell: string) => !Number.isFinite(parseNumber(cell, decimalComma));
  const filled = (row: readonly string[] | undefined) => (row ?? []).filter((cell) => cell !== "");

  // A header is a first row with text and no numbers in it.
  const firstRow = rows[0] ?? [];
  const hasHeader = options.hasHeader ?? (filled(firstRow).length > 0 && filled(firstRow).every(isText));

  const hasUnitsRow = hasHeader && (options.hasUnitsRow ?? looksLikeUnitsRow(rows, isText));
  const unitsRow = hasUnitsRow ? (rows[1] ?? []) : [];
  const bodyRows = rows.slice((hasHeader ? 1 : 0) + (hasUnitsRow ? 1 : 0));

  const columns: Column[] = [];
  for (let c = 0; c < columnCount; c++) {
    const header = hasHeader ? (firstRow[c] ?? "") : "";
    const { name, unit } = splitHeader(header);
    const texts = bodyRows.map((row) => row[c] ?? "");
    columns.push(
      createColumn(
        name === "" ? defaultColumnName(c + 1) : name,
        unit === "" ? bareUnit(unitsRow[c] ?? "") : unit,
        texts,
        decimalComma,
      ),
    );
  }

  return {
    dataset: { columns, rowCount: bodyRows.length },
    delimiter,
    hasHeader,
    decimalComma,
    skippedLines,
    hasUnitsRow,
  };
}
