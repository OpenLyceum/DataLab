import { describe, expect, it } from "vitest";
import {
  addRow,
  columnLabel,
  deleteRow,
  isNumericColumn,
  parseNumber,
  pasteBlock,
  setCell,
} from "../../../src/common/model/Dataset.js";
import { parseTable, sniffDelimiter, splitHeader } from "../../../src/common/model/parseTable.js";

describe("parseTable", () => {
  it("reads a comma CSV with a header and units", () => {
    const { dataset, delimiter, hasHeader } = parseTable("Time (s),Position (m)\n0,0.1\n0.5,0.35\n");
    expect(delimiter).toBe(",");
    expect(hasHeader).toBe(true);
    expect(dataset.rowCount).toBe(2);
    expect(dataset.columns.map((c) => [c.name, c.unit])).toEqual([
      ["Time", "s"],
      ["Position", "m"],
    ]);
    expect(dataset.columns[1]?.values).toEqual([0.1, 0.35]);
  });

  it("reads a tab-separated spreadsheet paste", () => {
    const { dataset, delimiter } = parseTable("t [s]\tx [cm]\n1\t2\n3\t4");
    expect(delimiter).toBe("\t");
    expect(dataset.columns[0]?.unit).toBe("s");
    expect(dataset.columns[1]?.values).toEqual([2, 4]);
  });

  it("reads semicolons with decimal commas", () => {
    const { dataset, delimiter, decimalComma } = parseTable("Temps (s);Position (m)\n0,5;1,25\n1,0;2,50\n");
    expect(delimiter).toBe(";");
    expect(decimalComma).toBe(true);
    expect(dataset.columns[0]?.values).toEqual([0.5, 1]);
    expect(dataset.columns[1]?.values).toEqual([1.25, 2.5]);
  });

  it("does not read a comma as a decimal mark in a comma CSV", () => {
    const { dataset } = parseTable("a,b\n1,5\n2,6\n");
    expect(dataset.columns).toHaveLength(2);
    expect(dataset.columns[0]?.values).toEqual([1, 2]);
  });

  it("handles a BOM, CRLF line ends and quoted fields", () => {
    const { dataset } = parseTable('﻿"Mass, hanging (kg)","Note"\r\n0.05,"said ""ok"""\r\n0.10,"a,b"\r\n');
    expect(dataset.columns[0]?.name).toBe("Mass, hanging");
    expect(dataset.columns[0]?.unit).toBe("kg");
    expect(dataset.columns[1]?.texts).toEqual(['said "ok"', "a,b"]);
    expect(dataset.columns[0]?.values).toEqual([0.05, 0.1]);
  });

  it("names columns when there is no header", () => {
    const { dataset, hasHeader } = parseTable("1,2\n3,4\n", { defaultColumnName: (n) => `Col ${n}` });
    expect(hasHeader).toBe(false);
    expect(dataset.rowCount).toBe(2);
    expect(dataset.columns.map((c) => c.name)).toEqual(["Col 1", "Col 2"]);
  });

  it("keeps blank and text cells as missing values", () => {
    const { dataset } = parseTable("x,y\n1,2\n,3\n4,n/a\n5,6\n");
    expect(dataset.rowCount).toBe(4);
    expect(dataset.columns[0]?.values[1]).toBeNaN();
    expect(dataset.columns[1]?.values[2]).toBeNaN();
    expect(dataset.columns[1]?.texts[2]).toBe("n/a");
  });

  it("drops blank lines, pads short rows and trims empty trailing columns", () => {
    const { dataset } = parseTable("x,y,\n1,2,\n\n3\n");
    expect(dataset.columns).toHaveLength(2);
    expect(dataset.rowCount).toBe(2);
    expect(dataset.columns[1]?.texts).toEqual(["2", ""]);
  });

  it("reads a single column and scientific notation", () => {
    const { dataset } = parseTable("counts\n1e3\n2.5E-2\n-.5\n");
    expect(dataset.columns).toHaveLength(1);
    expect(dataset.columns[0]?.values).toEqual([1000, 0.025, -0.5]);
  });

  it("returns an empty dataset for empty text", () => {
    const { dataset } = parseTable("  \n");
    expect(dataset.columns).toHaveLength(0);
    expect(dataset.rowCount).toBe(0);
  });
});

describe("header and delimiter helpers", () => {
  it("splits units from headers", () => {
    expect(splitHeader("Time (s)")).toEqual({ name: "Time", unit: "s" });
    expect(splitHeader("Speed [m/s]")).toEqual({ name: "Speed", unit: "m/s" });
    expect(splitHeader("Trial")).toEqual({ name: "Trial", unit: "" });
    expect(splitHeader("(s)")).toEqual({ name: "(s)", unit: "" });
  });

  it("prefers a delimiter that splits every line the same way", () => {
    expect(sniffDelimiter("a;b\n1,5;2,5\n3,5;4,5")).toBe(";");
    expect(sniffDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(sniffDelimiter("a,b\n1,2")).toBe(",");
  });
});

describe("Dataset editing", () => {
  const base = parseTable("Time (s),Position (m)\n0,1\n1,2\n").dataset;

  it("parses numbers strictly", () => {
    expect(parseNumber(" 1.5 ")).toBe(1.5);
    expect(parseNumber("−2")).toBe(-2);
    expect(parseNumber("1,5")).toBeNaN();
    expect(parseNumber("1,5", true)).toBe(1.5);
    expect(parseNumber("")).toBeNaN();
    expect(parseNumber("12abc")).toBeNaN();
    expect(parseNumber("Infinity")).toBeNaN();
  });

  it("edits a cell without touching the original", () => {
    const edited = setCell(base, 1, 1, "2.5");
    expect(edited.columns[1]?.values).toEqual([1, 2.5]);
    expect(base.columns[1]?.values).toEqual([1, 2]);
    expect(setCell(base, 9, 0, "1")).toBe(base);
  });

  it("adds and deletes rows", () => {
    const longer = addRow(base);
    expect(longer.rowCount).toBe(3);
    expect(longer.columns[0]?.values[2]).toBeNaN();
    const shorter = deleteRow(longer, 0);
    expect(shorter.rowCount).toBe(2);
    expect(shorter.columns[0]?.texts).toEqual(["1", ""]);
  });

  it("pastes a block, growing the table and dropping overflow columns", () => {
    const pasted = pasteBlock(base, 1, 1, [
      ["7", "extra"],
      ["8", "extra"],
    ]);
    expect(pasted.rowCount).toBe(3);
    expect(pasted.columns[1]?.values).toEqual([1, 7, 8]);
    expect(pasted.columns[0]?.texts).toEqual(["0", "1", ""]);
  });

  it("labels columns and detects numeric ones", () => {
    expect(columnLabel(base.columns[0] as never)).toBe("Time (s)");
    expect(isNumericColumn(base.columns[0] as never)).toBe(true);
    expect(isNumericColumn(parseTable("name\nabc\n").dataset.columns[0] as never)).toBe(false);
  });
});
