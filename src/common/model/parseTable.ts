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

import { type Column, createColumn, type Dataset, parseNumber } from "./Dataset.js";

export type Delimiter = "," | "\t" | ";";

export type ParsedTable = {
  readonly dataset: Dataset;
  readonly delimiter: Delimiter;
  readonly hasHeader: boolean;
  readonly decimalComma: boolean;
};

export type ParseOptions = {
  /** Name for a column with no header, from its 1-based position. */
  readonly defaultColumnName?: (position: number) => string;
};

/** Lines sampled when guessing the delimiter. */
const SNIFF_LINE_COUNT = 20;

/** Tried in this order; the first that splits every sampled line the same way wins. */
const DELIMITERS: readonly Delimiter[] = ["\t", ";", ","];

const HEADER_UNIT_PATTERN = /^(.*?)\s*[([]\s*([^)\]]*?)\s*[)\]]$/;

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

/**
 * Guesses the delimiter from the first lines: the first candidate that appears the
 * same non-zero number of times on every line, else the most frequent one.
 */
export function sniffDelimiter(text: string): Delimiter {
  const lines = text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .slice(0, SNIFF_LINE_COUNT);
  let best: Delimiter = ",";
  let bestTotal = 0;
  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => countOutsideQuotes(line, delimiter));
    const first = counts[0] ?? 0;
    if (first > 0 && counts.every((count) => count === first)) {
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

export function parseTable(input: string, options: ParseOptions = {}): ParsedTable {
  const defaultColumnName = options.defaultColumnName ?? ((position: number) => `Column ${position}`);
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const delimiter = sniffDelimiter(text);
  const decimalComma = delimiter !== ",";

  const rows = tokenize(text, delimiter)
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ""));

  let columnCount = 0;
  for (const row of rows) {
    for (let c = row.length - 1; c >= columnCount; c--) {
      if (row[c] !== "") {
        columnCount = c + 1;
        break;
      }
    }
  }

  // A header is a first row with text and no numbers in it.
  const firstRow = rows[0] ?? [];
  const firstCells = firstRow.filter((cell) => cell !== "");
  const hasHeader =
    firstCells.length > 0 && firstCells.every((cell) => !Number.isFinite(parseNumber(cell, decimalComma)));
  const bodyRows = hasHeader ? rows.slice(1) : rows;

  const columns: Column[] = [];
  for (let c = 0; c < columnCount; c++) {
    const header = hasHeader ? (firstRow[c] ?? "") : "";
    const { name, unit } = splitHeader(header);
    const texts = bodyRows.map((row) => row[c] ?? "");
    columns.push(createColumn(name === "" ? defaultColumnName(c + 1) : name, unit, texts, decimalComma));
  }

  return { dataset: { columns, rowCount: bodyRows.length }, delimiter, hasHeader, decimalComma };
}
