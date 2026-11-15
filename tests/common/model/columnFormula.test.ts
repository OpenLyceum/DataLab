import { describe, expect, it } from "vitest";
import { compileFormula, createFormulaContext, evaluateFormula } from "../../../src/common/model/columnFormula.js";
import { deleteColumn, pasteBlock, setCalculatedColumn, setCell } from "../../../src/common/model/Dataset.js";
import { parseTable } from "../../../src/common/model/parseTable.js";

describe("calculated columns", () => {
  it("uses arithmetic precedence and accepts only supported expressions", () => {
    const expression = compileFormula("-C1^2 + 2^3^2 + sqrt(C2) + 2e-1", 2);
    const context = createFormulaContext(1, (i) => [3, 16][i] ?? Number.NaN);
    expect(expression && evaluateFormula(expression, context, 0)).toBeCloseTo(507.2);
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

describe("functions across rows", () => {
  const table = (text: string, formula: string) =>
    setCalculatedColumn(parseTable(text).dataset, 2, "result", "", formula).columns[2]?.values;

  it("differentiates with central differences and one-sided ends", () => {
    // x = t², sampled unevenly: the central difference of a parabola is exact
    // only on even spacing, so the expected values are worked by hand.
    expect(table("t,x\n0,0\n1,1\n2,4\n4,16\n", "derivative(C2, C1)")).toEqual([1, 2, 5, 6]);
  });

  it("integrates with a running trapezoid sum from the first row", () => {
    expect(table("t,v\n0,0\n1,2\n2,4\n4,4\n", "integral(C2, C1)")).toEqual([0, 1, 4, 12]);
  });

  it("leaves a row blank when it or a neighbour is missing, without breaking the integral", () => {
    expect(table("t,x\n0,0\n1,\n2,4\n3,9\n", "derivative(C2, C1)")).toEqual([Number.NaN, Number.NaN, Number.NaN, 5]);
    expect(table("t,v\n0,2\n1,\n2,2\n3,2\n", "integral(C2, C1)")).toEqual([0, Number.NaN, 4, 6]);
  });

  it("composes with arithmetic and keeps a blank blank", () => {
    expect(table("t,x\n0,0\n1,1\n2,4\n", "2*derivative(C2, C1) + pi - pi")).toEqual([2, 4, 6]);
    expect(table("t,x\n0,0\n1,\n2,4\n", "derivative(C2, C1)^0")).toEqual([Number.NaN, Number.NaN, Number.NaN]);
    expect(compileFormula("derivative(C2)", 2)).toBeNull();
    expect(compileFormula("integral(C2, C1, C1)", 2)).toBeNull();
  });

  it("shows calculated cells without binary rounding noise", () => {
    const dataset = setCalculatedColumn(parseTable("a,b\n0.1,0.2\n").dataset, 2, "sum", "", "C1 + C2");
    expect(dataset.columns[2]?.texts).toEqual(["0.3"]);
    expect(dataset.columns[2]?.values[0]).toBe(0.1 + 0.2);
  });
});
