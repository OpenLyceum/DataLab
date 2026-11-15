/**
 * What lab files look like beyond a clean CSV: columns aligned with spaces, a
 * title above the table, units on their own row, decimal commas, grouped
 * thousands, and encodings other than UTF-8.
 */

import { describe, expect, it } from "vitest";
import { parseNumber } from "../../../src/common/model/Dataset.js";
import { decodeText } from "../../../src/common/model/decodeText.js";
import { parseTable, sniffDelimiter } from "../../../src/common/model/parseTable.js";

const summary = (text: string, options = {}) =>
  parseTable(text, options).dataset.columns.map((column) => [column.name, column.unit, column.values]);

describe("delimiters", () => {
  it("reads columns of numbers separated by spaces", () => {
    expect(sniffDelimiter("t x\n1 2\n2 4\n")).toBe(" ");
    expect(summary("t x\n1 2\n2 4\n3 6\n")).toEqual([
      ["t", "", [1, 2, 3]],
      ["x", "", [2, 4, 6]],
    ]);
  });

  it("keeps a bracketed unit with its header in aligned text", () => {
    expect(summary("Time (s)   Position [m]\n0.0   1.5\n0.5   2.5\n")).toEqual([
      ["Time", "s", [0, 0.5]],
      ["Position", "m", [1.5, 2.5]],
    ]);
  });

  it("still reads a comma followed by a space as a comma", () => {
    expect(sniffDelimiter("t, x\n1.5, 2\n2.5, 4\n")).toBe(",");
    expect(summary("t, x\n1.5, 2\n2.5, 4\n")).toEqual([
      ["t", "", [1.5, 2.5]],
      ["x", "", [2, 4]],
    ]);
  });

  it("does not split a single column of text on its spaces", () => {
    expect(summary("Trial name\nfirst try\nsecond try\n")).toHaveLength(1);
  });
});

describe("lines around the table", () => {
  it("leaves out a title above the header", () => {
    const parsed = parseTable("Run 1 exported 2026-01-01\nTime (s),Position (m)\n0,1\n1,2\n");
    expect(parsed.skippedLines).toBe(1);
    expect(summary("Run 1 exported 2026-01-01\nTime (s),Position (m)\n0,1\n1,2\n")).toEqual([
      ["Time", "s", [0, 1]],
      ["Position", "m", [1, 2]],
    ]);
  });

  it("reads a units row under the header", () => {
    const parsed = parseTable("Time,Position\ns,(m)\n0,1\n1,2\n");
    expect(parsed.hasUnitsRow).toBe(true);
    expect(summary("Time,Position\ns,(m)\n0,1\n1,2\n")).toEqual([
      ["Time", "s", [0, 1]],
      ["Position", "m", [1, 2]],
    ]);
  });

  it("does not take a first row of labels for units", () => {
    const parsed = parseTable("Trial,Result\nfirst,ok\nsecond,ok\n");
    expect(parsed.hasUnitsRow).toBe(false);
    expect(parsed.dataset.rowCount).toBe(2);
  });

  it("follows explicit instructions over its own guesses", () => {
    const text = "note\nt;x\n1,5;2\n2,5;4\n";
    expect(summary(text, { skippedLines: 0, hasHeader: false, delimiter: ";", decimalComma: false })).toEqual([
      ["Column 1", "", [Number.NaN, Number.NaN, Number.NaN, Number.NaN]],
      ["Column 2", "", [Number.NaN, Number.NaN, 2, 4]],
    ]);
    expect(summary(text)).toEqual([
      ["t", "", [1.5, 2.5]],
      ["x", "", [2, 4]],
    ]);
  });
});

describe("numbers", () => {
  it("reads one column of decimal commas under a one-word header", () => {
    expect(summary("x\n1,5\n2,5\n3,5\n")).toEqual([["x", "", [1.5, 2.5, 3.5]]]);
  });

  it("keeps two columns of integers as two columns", () => {
    expect(summary("t,x\n1,5\n2,5\n")).toHaveLength(2);
    expect(summary("1,5\n2,5\n")).toHaveLength(2);
  });

  it("reads grouped thousands only where they cannot be decimals", () => {
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("1,234,567")).toBe(1234567);
    expect(parseNumber("1,234")).toBe(1234);
    // In a cell where a comma may be a decimal mark, "1,234" is 1.234.
    expect(parseNumber("1,234", true)).toBe(1.234);
    expect(parseNumber("1,234.5", true)).toBe(1234.5);
    expect(parseNumber("1.234,5", true)).toBe(1234.5);
    expect(parseNumber("1.234", true)).toBe(1.234);
    expect(parseNumber("12,34.5")).toBeNaN();
    expect(summary('t,x\n1,"1,234.5"\n2,3\n')[1]).toEqual(["x", "", [1234.5, 3]]);
  });
});

describe("decodeText", () => {
  const header = "Température (°C),Durée (µs)";

  it("reads UTF-8", () => {
    expect(decodeText(new TextEncoder().encode(header))).toBe(header);
  });

  it("reads Windows-1252, as Excel on Windows writes CSV", () => {
    const bytes = Uint8Array.from([...header].map((char) => char.charCodeAt(0)));
    expect(decodeText(bytes)).toBe(header);
  });

  it("reads UTF-16 with a byte-order mark", () => {
    const littleEndian = new Uint8Array(2 + 2 * header.length);
    littleEndian.set([0xff, 0xfe]);
    [...header].forEach((char, i) => {
      littleEndian[2 + 2 * i] = char.charCodeAt(0) & 0xff;
      littleEndian[3 + 2 * i] = char.charCodeAt(0) >> 8;
    });
    expect(decodeText(littleEndian).replace(/^﻿/, "")).toBe(header);
  });
});

describe("a title above a table that is not comma-separated", () => {
  it("does not let commas in the numbers outvote the semicolons", () => {
    const text = "Pendule du 3 mars\nLongueur;Période\nm;s\n0,25;1,00\n0,50;1,42\n";
    expect(sniffDelimiter(text)).toBe(";");
    expect(summary(text)).toEqual([
      ["Longueur", "m", [0.25, 0.5]],
      ["Période", "s", [1, 1.42]],
    ]);
  });
});
