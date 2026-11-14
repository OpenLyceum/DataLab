import { describe, expect, it } from "vitest";
import { compileFormula } from "../../../src/common/model/columnFormula.js";
import { deleteColumn, pasteBlock, setCalculatedColumn, setCell } from "../../../src/common/model/Dataset.js";
import { parseTable } from "../../../src/common/model/parseTable.js";

describe("calculated columns", () => {
  it("uses arithmetic precedence and accepts only supported expressions", () => {
    expect(compileFormula("-C1^2 + 2^3^2 + sqrt(C2) + 2e-1", 2)?.((i) => [3, 16][i] ?? Number.NaN)).toBeCloseTo(507.2);
    for (const invalid of ["C3", "C1 +", "C1 C2", "Math.sqrt(C1)", "()"]) {
      expect(compileFormula(invalid, 2)).toBeNull();
    }
  });

  it("updates chained formulas and protects references across edits and deletions", () => {
    let dataset = parseTable("unused,Time\n0,2\n0,4").dataset;
    dataset = setCalculatedColumn(dataset, 2, "Time squared", "s²", "C2^2");
    dataset = setCalculatedColumn(dataset, 3, "Scaled", "", "C3/2");
    expect(deleteColumn(dataset, 1)).toBe(dataset);
    dataset = deleteColumn(dataset, 0);
    expect(dataset.columns[1]?.formula).toBe("C1^2");
    expect(dataset.columns[2]?.formula).toBe("C2/2");
    dataset = pasteBlock(dataset, 0, 0, [
      ["3", "999"],
      ["", "999"],
      ["5", "999"],
    ]);
    expect(dataset.columns[2]?.texts).toEqual(["4.5", "", "12.5"]);
    expect(setCell(dataset, 0, 1, "999")).toBe(dataset);
    expect(setCell(dataset, 1, 0, "6").columns[2]?.texts).toEqual(["4.5", "18", "12.5"]);
  });
});
