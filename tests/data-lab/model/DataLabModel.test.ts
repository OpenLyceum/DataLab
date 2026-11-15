/**
 * The screen model: one fit per edit, undo and redo of table edits, and the
 * column choices following the table through structural edits.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { parseTable } from "../../../src/common/model/parseTable.js";
import { DataLabModel } from "../../../src/data-lab/model/DataLabModel.js";
import type { Session } from "../../../src/data-lab/model/sessionFile.js";

const TABLE = "t,x,note,sigma\n0,1,a,0.1\n1,3,b,0.1\n2,5,c,0.2\n3,7.5,d,0.1\n4,9,e,0.1\n";

function createModel(): DataLabModel {
  const model = new DataLabModel();
  model.importText(TABLE);
  return model;
}

/** Counts how often the fit is recomputed by `change`. */
function fitsDuring(model: DataLabModel, change: () => void): number {
  let count = 0;
  const listener = () => count++;
  model.fitProperty.lazyLink(listener);
  change();
  model.fitProperty.unlink(listener);
  return count;
}

beforeEach(() => localStorage.clear());

describe("one fit per edit", () => {
  it("fits once for each kind of change", () => {
    const model = createModel();
    expect(fitsDuring(model, () => model.fitModelProperty.set("quadratic"))).toBe(1);
    expect(fitsDuring(model, () => model.setRange(1, 3))).toBe(1);
    expect(fitsDuring(model, () => model.setCell(0, 1, "1.5"))).toBe(1);
    expect(fitsDuring(model, () => model.deleteRow(4))).toBe(1);
    expect(fitsDuring(model, () => model.pasteBlock(0, 0, [["0.5", "2"]]))).toBe(1);
    expect(fitsDuring(model, () => model.importText(TABLE))).toBe(1);
    expect(fitsDuring(model, () => model.deleteRow(0))).toBe(1);
    expect(fitsDuring(model, () => model.undo())).toBe(1);
    expect(fitsDuring(model, () => model.redo())).toBe(1);
    expect(fitsDuring(model, () => model.reset())).toBeLessThanOrEqual(1);
  });

  it("does not fit when a column that is not plotted changes", () => {
    const model = createModel();
    expect(fitsDuring(model, () => model.setCell(0, 2, "changed"))).toBe(0);
    expect(fitsDuring(model, () => model.setColumnHeader(0, "time", "s"))).toBe(0);
    expect(fitsDuring(model, () => model.deleteColumn(2))).toBe(0);
    expect(fitsDuring(model, () => model.undo())).toBe(0);
  });

  it("keeps the fit in step with the inclusion", () => {
    const model = createModel();
    model.setRange(1, 3);
    model.fitModelProperty.value = "quadratic";
    const fit = model.fitProperty.value;
    expect(fit.ok && fit.count).toBe(3);
    expect(fit.model).toBe("quadratic");
    expect(model.inclusionProperty.value.indices).toEqual([1, 2, 3]);
  });
});

describe("undo and redo", () => {
  it("puts back a cell, a deleted row and a replaced table", () => {
    const model = createModel();
    const original = model.datasetProperty.value;
    expect(model.canUndoProperty.value).toBe(true); // the import itself

    model.setCell(0, 1, "99");
    model.deleteRow(2);
    model.importText("a,b\n1,2\n3,4\n");
    expect(model.datasetProperty.value.columns[0]?.name).toBe("a");

    model.undo();
    expect(model.datasetProperty.value.rowCount).toBe(4);
    model.undo();
    expect(model.datasetProperty.value.rowCount).toBe(5);
    expect(model.datasetProperty.value.columns[1]?.texts[0]).toBe("99");
    model.undo();
    expect(model.datasetProperty.value).toBe(original);

    model.redo();
    expect(model.datasetProperty.value.columns[1]?.texts[0]).toBe("99");
    expect(model.canRedoProperty.value).toBe(true);
    // A new edit ends the redo history.
    model.setCell(0, 1, "5");
    expect(model.canRedoProperty.value).toBe(false);
  });

  it("restores the column choices with the table", () => {
    const model = createModel();
    model.yColumnIndexProperty.value = 3;
    model.uncertaintyColumnIndexProperty.value = 3;
    model.deleteColumn(1);
    expect(model.yColumnIndexProperty.value).toBe(2);
    expect(model.uncertaintyColumnIndexProperty.value).toBe(2);
    model.undo();
    expect(model.yColumnIndexProperty.value).toBe(3);
    expect(model.uncertaintyColumnIndexProperty.value).toBe(3);
    expect(model.datasetProperty.value.columns).toHaveLength(4);
  });

  it("ignores an edit that changes nothing", () => {
    const model = createModel();
    model.undo();
    model.redo();
    const before = model.datasetProperty.value;
    model.setCell(99, 0, "1");
    model.deleteRow(99);
    expect(model.datasetProperty.value).toBe(before);
    model.undo();
    expect(model.canUndoProperty.value).toBe(false);
  });

  it("starts a new history when a run is opened", () => {
    const model = createModel();
    model.setCell(0, 1, "99");
    const session: Session = {
      dataset: parseTable("t,x\n0,0\n1,2\n2,4\n3,6\n").dataset,
      xColumn: 0,
      yColumn: 1,
      uncertaintyColumn: -1,
      model: "quadratic",
      range: { min: 0, max: 3 },
      pin: { uncertaintyColumn: -1, model: "linear", range: { min: 0, max: 2 } },
      logX: false,
      logY: false,
      showResiduals: true,
    };
    model.loadSession(session);
    expect(model.canUndoProperty.value).toBe(false);
    expect(model.fitModelProperty.value).toBe("quadratic");
    expect(model.rangeProperty.value).toEqual({ min: 0, max: 3 });
    const pin = model.pinnedFitProperty.value;
    expect(pin?.fit.model).toBe("linear");
    expect(pin?.fit.count).toBe(3);
    expect(pin?.fit.parameters[0]).toBeCloseTo(2, 12);
  });
});

describe("column choices follow the table", () => {
  it("keeps a range when the x column survives and clears it when it does not", () => {
    const model = createModel();
    model.setRange(1, 3);
    model.deleteColumn(2);
    expect(model.rangeProperty.value).toEqual({ min: 1, max: 3 });
    model.deleteColumn(0);
    expect(model.rangeProperty.value).toBeNull();
    expect(model.xColumnIndexProperty.value).toBe(0);
  });

  it("weights any model once an uncertainty column is chosen", () => {
    const model = createModel();
    model.uncertaintyColumnIndexProperty.value = 3;
    const fit = model.fitProperty.value;
    expect(fit.ok && fit.reducedChiSquared).not.toBeNull();
    model.setCell(2, 3, "0");
    expect(model.inclusionProperty.value.invalidUncertaintyCount).toBe(1);
  });
});
