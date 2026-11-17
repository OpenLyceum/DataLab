/**
 * RunControls.ts
 *
 * Named runs and their storage: the run chooser, New run, Manage run, PASCO
 * capture, and opening and saving session files. A run is a table together with
 * its analysis settings; the active one lives in the model and the graph view,
 * the others wait in the RunWorkspace.
 *
 * The whole workspace is also kept in the browser's storage, so a reload brings
 * back every run and not just the table on show. Each run comes back with its
 * table, columns, model and scales; the range, the pinned fit and the zoom start
 * afresh, as they always have after a reload.
 */

import type { Property, TReadOnlyProperty } from "scenerystack/axon";
import { DOM, HBox, type Node } from "scenerystack/scenery";
import { createColumn, type Dataset } from "../../common/model/Dataset.js";
import { FitModel } from "../../common/model/leastSquares.js";
import { downloadText, openTextFile } from "../../common/view/fileIO.js";
import { HTML_CONTROL_FONT, LAYOUT, SESSION_FILE_NAME } from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabPreferencesModel } from "../../preferences/DataLabPreferencesModel.js";
import type { DataLabModel } from "../model/DataLabModel.js";
import { RunWorkspace } from "../model/RunWorkspace.js";
import { decodeSession, encodeSession, type RunSession, type Session } from "../model/sessionFile.js";
import { restoreWorkspace, saveWorkspace } from "../model/workspaceStorage.js";
import { capturePasco } from "./capturePasco.js";
import { createIconButton } from "./createIconButton.js";
import { editRun } from "./editRun.js";
import { fillPattern } from "./fillPattern.js";
import type { GraphView } from "./GraphView.js";
import { Icons } from "./icons.js";

export type RunControls = {
  /** The run chooser with New run and Manage run. */
  readonly runRow: Node;
  readonly newRunButton: Node;
  readonly manageRunButton: Node;
  readonly captureButton: Node;
  readonly loadSessionButton: Node;
  readonly saveSessionButton: Node;
  /** Opens the text of a session file, as dropped on the page. */
  readonly openSession: (text: string) => void;
};

export function createRunControls(
  model: DataLabModel,
  graphView: GraphView,
  preferences: DataLabPreferencesModel,
  messageProperty: Property<string>,
): RunControls {
  const labels = StringManager.getInstance().getLabels();
  const runName = (position: number) => fillPattern(labels.defaultRunStringProperty.value, { position });

  const captureRun = (): Session => ({
    ...model.fitSettings(),
    dataset: model.datasetProperty.value,
    xColumn: model.xColumnIndexProperty.value,
    yColumn: model.yColumnIndexProperty.value,
    logX: graphView.logXProperty.value,
    logY: graphView.logYProperty.value,
    showResiduals: preferences.showResidualsProperty.value,
    pin: model.pinnedFitProperty.value?.settings ?? null,
  });
  const restoreRun = (session: Session) => {
    model.loadSession(session);
    graphView.setLogAxes(session.logX, session.logY);
    graphView.autoScale();
    preferences.showResidualsProperty.value = session.showResiduals;
    messageProperty.value = "";
  };
  const runWorkspace = new RunWorkspace(runName(1), captureRun, restoreRun);

  // ── Recovery after a reload ───────────────────────────────────────────────
  // Switching runs changes the table, the columns and the scales one after another.
  // The workspace is stored once they have all changed, not in between.
  let storageWarned = false;
  let persistQueued = false;
  const persist = () => {
    if (persistQueued) {
      return;
    }
    persistQueued = true;
    queueMicrotask(() => {
      persistQueued = false;
      if (!(saveWorkspace(runWorkspace.save()) || storageWarned)) {
        // Said once: the student needs to know, and does not need to be told on every edit.
        storageWarned = true;
        messageProperty.value = labels.storageFullStringProperty.value;
      }
    });
  };
  const stored: RunSession | null = restoreWorkspace(runName(1));
  if (stored) {
    runWorkspace.load({
      ...stored,
      runs: stored.runs.map((run) => ({ ...run, session: { ...run.session, range: null, pin: null } })),
    });
  }
  const settings: readonly TReadOnlyProperty<unknown>[] = [
    model.datasetProperty,
    model.xColumnIndexProperty,
    model.yColumnIndexProperty,
    model.uncertaintyColumnIndexProperty,
    model.fitModelProperty,
    graphView.logXProperty,
    graphView.logYProperty,
    preferences.showResidualsProperty,
  ];
  for (const setting of settings) {
    setting.lazyLink(persist);
  }

  // ── Run chooser ───────────────────────────────────────────────────────────
  const runSelect = document.createElement("select");
  runSelect.style.cssText = `width: ${LAYOUT.RUN_SELECT_WIDTH}px; box-sizing: border-box; font: ${HTML_CONTROL_FONT}; padding: 2px;`;
  labels.activeRunStringProperty.link((name) => runSelect.setAttribute("aria-label", name));
  const refreshRuns = () => {
    runSelect.replaceChildren(...runWorkspace.names.map((name, i) => new Option(name, String(i))));
    runSelect.value = String(runWorkspace.selectedIndex);
  };
  refreshRuns();
  /** A change to the runs themselves — added, renamed, removed, switched. */
  const runsChanged = () => {
    refreshRuns();
    persist();
  };
  runSelect.addEventListener("change", () => {
    runWorkspace.select(Number(runSelect.value));
    persist();
  });

  const nextRunName = () => {
    const names = runWorkspace.names;
    let runNumber = names.length + 1;
    while (names.includes(runName(runNumber))) {
      runNumber++;
    }
    return runName(runNumber);
  };
  const addRun = (dataset: Dataset, name: string, hasData: boolean) => {
    runWorkspace.add(name, {
      dataset,
      xColumn: hasData ? 0 : -1,
      yColumn: hasData ? 1 : -1,
      uncertaintyColumn: -1,
      range: null,
      model: FitModel.LINEAR,
      logX: false,
      logY: false,
      showResiduals: preferences.showResidualsProperty.value,
      pin: null,
    });
    runsChanged();
  };
  const newRunButton = createIconButton(Icons.newRun(), labels.newRunStringProperty, () => {
    const columnName = (position: number) => fillPattern(labels.defaultColumnNameStringProperty.value, { position });
    addRun(
      { columns: [createColumn(columnName(1), "", [""]), createColumn(columnName(2), "", [""])], rowCount: 1 },
      nextRunName(),
      false,
    );
  });
  const captureButton = createIconButton(
    Icons.bluetooth(),
    labels.capturePascoStringProperty,
    () => {
      capturePasco((dataset, name) => addRun(dataset, name, true));
    },
    { caption: labels.capturePascoStringProperty },
  );
  const manageRunButton = createIconButton(Icons.edit(), labels.manageRunStringProperty, () =>
    editRun(runWorkspace, runsChanged),
  );

  // ── Session files ─────────────────────────────────────────────────────────
  const openSession = (text: string) => {
    const session = decodeSession(text, runName(1));
    if (session) {
      runWorkspace.load(session);
      runsChanged();
    }
    messageProperty.value = session ? "" : labels.sessionInvalidStringProperty.value;
  };
  const fileUnreadable = () => {
    messageProperty.value = labels.fileReadFailedStringProperty.value;
  };
  const loadSessionButton = createIconButton(Icons.openSession(), labels.openSessionStringProperty, () =>
    openTextFile(openSession, fileUnreadable, ".json,application/json"),
  );
  const saveSessionButton = createIconButton(Icons.save(), labels.saveSessionStringProperty, () => {
    downloadText(encodeSession(runWorkspace.save()), SESSION_FILE_NAME, "application/json");
  });

  return {
    runRow: new HBox({
      spacing: LAYOUT.BUTTON_ROW_SPACING,
      children: [new DOM(runSelect, { allowInput: true }), newRunButton, manageRunButton],
    }),
    newRunButton,
    manageRunButton,
    captureButton,
    loadSessionButton,
    saveSessionButton,
    openSession,
  };
}
