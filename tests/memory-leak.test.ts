/**
 * Memory-leak regression suite (fleet standard).
 *
 * Data Lab builds its model and view once and keeps them for the life of the page (the ScreenView is
 * `isDisposable: false`), and none of its classes implements dispose(), so the shared
 * describeDisposalLeaks() list stays empty. What is worth guarding is that:
 *
 *  - the model and its derived chain (dataset → inclusion → fit) are plain object graphs that can be
 *    collected as a unit, even after imports, edits, ranges, pinned fits and session loads;
 *  - GraphView only links Properties that die with it, so it does not pin the model;
 *  - editing data never piles listeners onto the long-lived Properties (model Properties, colour
 *    profile, strings) — the table rebuilds its DOM in place and the plots redraw in place.
 *
 * PlotNode, ResidualPlotNode and DataTableNode link the global colour/string Properties through
 * closures that capture the model, so a view pins its model by design (it lives as long as the page);
 * the views are covered by listener-count tests only.
 */

import { describe, expect, it } from "vitest";
import { parseTable } from "../src/common/model/parseTable.js";
import DataLabColors from "../src/DataLabColors.js";
import { DataLabModel } from "../src/data-lab/model/DataLabModel.js";
import { DataTableNode } from "../src/data-lab/view/DataTableNode.js";
import { GraphView } from "../src/data-lab/view/GraphView.js";
import { PlotNode } from "../src/data-lab/view/PlotNode.js";
import { ResidualPlotNode } from "../src/data-lab/view/ResidualPlotNode.js";
import { StringManager } from "../src/i18n/StringManager.js";
import { DataLabPreferencesModel } from "../src/preferences/DataLabPreferencesModel.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

// Nothing in Data Lab is created and disposed at run time (see the header).
describeDisposalLeaks([]);

const VIEW = { viewWidth: 300, viewHeight: 200 } as const;

/** Listener count of a Property (public at runtime, private in the type declarations). */
const listenerCount = (property: object): number =>
  (property as unknown as { getListenerCount(): number }).getListenerCount();

/** Exercises the model the way a session does: imports, edits, ranges, fit models, pins and resets. */
function exercise(model: DataLabModel): void {
  model.loadSample();
  model.setRange(0.5, 2);
  model.fitModelProperty.value = "quadratic";
  model.pinFit();
  model.setCell(0, 1, "3.5");
  model.addRow();
  model.addColumn("Extra");
  model.setRowExcluded(1, true);
  model.importText("t,x\n0,1\n1,3\n2,5\n3,7");
  model.setRange(0, 2);
  model.fitModelProperty.value = "linear";
  model.pinFit();
  model.clearPinnedFit();
  model.reset();
}

function createAndDropModel(): WeakRef<object> {
  const model = new DataLabModel();
  exercise(model);
  return new WeakRef<object>(model);
}

function createAndDropPreferences(): WeakRef<object> {
  const preferences = new DataLabPreferencesModel();
  preferences.showResidualsProperty.value = !preferences.showResidualsProperty.value;
  preferences.reset();
  return new WeakRef<object>(preferences);
}

function createAndDropGraphView(): WeakRef<object> {
  const model = new DataLabModel();
  const graphView = new GraphView(model);
  model.loadSample();
  graphView.setLogAxes(true, false);
  graphView.setLogAxes(false, false);
  model.importText("x,y\n1,2\n2,4\n3,6");
  model.reset();
  return new WeakRef<object>(graphView);
}

describe("Data Lab memory leaks", () => {
  it("DataLabModel is collected after drop", async () => {
    const ref = createAndDropModel();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("repeated DataLabModel create/drop cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDropModel());
    }
    await forceGC(refs);
    expect(refs.filter((r) => r.deref() !== undefined).length).toBe(0);
  });

  it("DataLabPreferencesModel is collected after drop", async () => {
    const refs = Array.from({ length: 10 }, createAndDropPreferences);
    await forceGC(refs);
    expect(refs.filter((r) => r.deref() !== undefined).length).toBe(0);
  });

  it("GraphView and its model are collected after drop", async () => {
    const refs = Array.from({ length: 5 }, createAndDropGraphView);
    await forceGC(refs);
    expect(refs.filter((r) => r.deref() !== undefined).length).toBe(0);
  });
});

describe("edits do not accumulate listeners", () => {
  const labels = StringManager.getInstance().getLabels();

  it("model edits leave the model's Property listeners unchanged", () => {
    const model = new DataLabModel();
    const graphView = new GraphView(model);
    const properties = [
      model.datasetProperty,
      model.xColumnIndexProperty,
      model.yColumnIndexProperty,
      model.rangeProperty,
      model.fitModelProperty,
      model.xColumnProperty,
      model.inclusionProperty,
      model.fitProperty,
      graphView.xAxisRangeProperty,
      graphView.yAxisRangeProperty,
    ];
    const before = properties.map(listenerCount);
    for (let i = 0; i < 10; i++) {
      exercise(model);
      graphView.setLogAxes(true, true);
      graphView.setLogAxes(false, false);
    }
    expect(properties.map(listenerCount)).toEqual(before);
  });

  it("plots redrawing for edits leave model and colour listeners unchanged", () => {
    const model = new DataLabModel();
    const graphView = new GraphView(model);
    new PlotNode(model, graphView, VIEW);
    new ResidualPlotNode(model, graphView, VIEW);
    const properties = [
      model.xColumnProperty,
      model.yColumnProperty,
      model.inclusionProperty,
      model.fitProperty,
      model.rangeProperty,
      model.pinnedFitProperty,
      graphView.xAxisRangeProperty,
      graphView.logXProperty,
      DataLabColors.pointColorProperty,
      DataLabColors.excludedPointColorProperty,
      DataLabColors.fitLineColorProperty,
      labels.residualsStringProperty,
    ];
    const before = properties.map(listenerCount);
    for (let i = 0; i < 10; i++) {
      exercise(model);
      graphView.setLogAxes(true, true);
      graphView.setLogAxes(false, false);
    }
    expect(properties.map(listenerCount)).toEqual(before);
  });

  it("the table rebuilding its rows leaves the model, colour and string listeners unchanged", () => {
    const model = new DataLabModel();
    new DataTableNode(model, { width: 400, height: 300 });
    const properties = [
      model.datasetProperty,
      model.inclusionProperty,
      DataLabColors.tableHeaderBackgroundColorProperty,
      DataLabColors.tableIncludedRowColorProperty,
      labels.inFitStringProperty,
      labels.rowStringProperty,
      labels.excludeStringProperty,
    ];
    const before = properties.map(listenerCount);
    for (let i = 0; i < 10; i++) {
      exercise(model);
      model.datasetProperty.value = parseTable("a,b\n1,2\n3,4\n5,6").dataset;
    }
    expect(properties.map(listenerCount)).toEqual(before);
  });

  it("each table adds a fixed number of listeners, so only construction (once per page) grows them", () => {
    const model = new DataLabModel();
    const property = labels.inFitStringProperty;
    const base = listenerCount(property);
    new DataTableNode(model, { width: 400, height: 300 });
    const perTable = listenerCount(property) - base;
    expect(perTable).toBeGreaterThan(0);
    model.loadSample();
    model.reset();
    expect(listenerCount(property)).toBe(base + perTable);
  });
});
