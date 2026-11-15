/** Runs held in the workspace, and the workspace kept in browser storage. */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTable } from "../../../src/common/model/parseTable.js";
import { restoreDataset } from "../../../src/data-lab/model/datasetStorage.js";
import { RunWorkspace } from "../../../src/data-lab/model/RunWorkspace.js";
import { decodeSession, type Session } from "../../../src/data-lab/model/sessionFile.js";
import { restoreWorkspace, saveWorkspace } from "../../../src/data-lab/model/workspaceStorage.js";

function session(csv: string): Session {
  return {
    dataset: parseTable(csv).dataset,
    xColumn: 0,
    yColumn: 1,
    uncertaintyColumn: -1,
    model: "linear",
    range: null,
    pin: null,
    logX: false,
    logY: false,
    showResiduals: true,
  };
}

/** A workspace whose "screen" is one variable holding the active session. */
function createWorkspace() {
  const screen = { active: session("t,x\n0,1\n1,2\n") };
  const workspace = new RunWorkspace(
    "Run 1",
    () => screen.active,
    (restored) => {
      screen.active = restored;
    },
  );
  return { screen, workspace };
}

beforeEach(() => localStorage.clear());

describe("RunWorkspace", () => {
  it("keeps each run's table while another is on show", () => {
    const { screen, workspace } = createWorkspace();
    const first = screen.active;
    const second = session("a,b\n5,6\n7,8\n");
    workspace.add("Run 2", second);
    expect(workspace.names).toEqual(["Run 1", "Run 2"]);
    expect(workspace.selectedIndex).toBe(1);
    expect(screen.active).toBe(second);

    // An edit to the run on show is captured when it is left.
    const edited = session("a,b\n5,6\n7,9\n");
    screen.active = edited;
    workspace.select(0);
    expect(screen.active).toBe(first);
    workspace.select(1);
    expect(screen.active).toBe(edited);
  });

  it("renames and removes the run on show, and never the last one", () => {
    const { screen, workspace } = createWorkspace();
    const first = screen.active;
    workspace.add("Run 2", session("a,b\n5,6\n"));
    workspace.rename("Pendulum");
    expect(workspace.names).toEqual(["Run 1", "Pendulum"]);
    workspace.remove();
    expect(workspace.names).toEqual(["Run 1"]);
    expect(screen.active).toBe(first);
    workspace.remove();
    expect(workspace.names).toEqual(["Run 1"]);
  });

  it("saves and loads every run with the active one", () => {
    const { workspace } = createWorkspace();
    workspace.add("Run 2", session("a,b\n5,6\n"));
    workspace.select(0);
    const saved = workspace.save();
    const other = createWorkspace();
    other.workspace.load(saved);
    expect(other.workspace.names).toEqual(["Run 1", "Run 2"]);
    expect(other.workspace.selectedIndex).toBe(0);
    expect(other.screen.active).toBe(saved.runs[0]?.session);
  });
});

describe("workspace storage", () => {
  const runs = {
    runs: [
      { name: "Base", session: session("t,x\n0,1\n1,2\n") },
      { name: "Trial", session: { ...session("a,b\n5,6\n"), model: "quadratic" as const } },
    ],
    activeIndex: 1,
  };

  it("restores every run after a reload", () => {
    expect(restoreWorkspace("Run 1")).toBeNull();
    expect(saveWorkspace(runs)).toBe(true);
    expect(restoreWorkspace("Run 1")).toMatchObject(runs);
  });

  it("drops the single-table copy of earlier releases once the workspace is stored", () => {
    const table = { rowCount: 1, columns: [{ name: "t", unit: "s", texts: ["1"], values: [1] }] };
    localStorage.setItem("openlyceum.data-lab.table.v1", JSON.stringify(table));
    expect(restoreDataset()?.columns[0]?.name).toBe("t");
    saveWorkspace(runs);
    expect(restoreDataset()).toBeNull();
  });

  it("removes the stored copy when a newer one does not fit", () => {
    saveWorkspace(runs);
    const full = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    try {
      expect(saveWorkspace({ ...runs, activeIndex: 0 })).toBe(false);
    } finally {
      full.mockRestore();
    }
    // Better nothing than the table as it was before the edits that did not fit.
    expect(restoreWorkspace("Run 1")).toBeNull();
  });

  it("ignores stored text that is not a workspace", () => {
    localStorage.setItem("openlyceum.data-lab.workspace.v1", "{not json");
    expect(restoreWorkspace("Run 1")).toBeNull();
  });

  it("opens a session saved when weighted linear was a model of its own", () => {
    const old = JSON.stringify({
      ...session("t,x,s\n0,1,1\n1,2,1\n2,3,1\n"),
      uncertaintyColumn: 2,
      model: "weightedLinear",
      pin: { uncertaintyColumn: 2, model: "weightedLinear", range: { min: 0, max: 1 } },
      format: "openlyceum-data-lab",
      version: 1,
    });
    const decoded = decodeSession(old, "Run 1");
    expect(decoded?.runs[0]?.session.model).toBe("linear");
    expect(decoded?.runs[0]?.session.pin?.model).toBe("linear");
  });
});
