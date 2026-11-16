/**
 * createImportExportControls.ts
 *
 * Import, paste, sample, table edit, CSV export, undo/redo, and the session-file
 * buttons that sit under the data table. Drop-target and document-level paste /
 * undo shortcuts live here so DataLabScreenView stays a layout shell.
 */

import type { Property } from "scenerystack/axon";
import { HBox, type Node } from "scenerystack/scenery";
import type { Dataset } from "../../common/model/Dataset.js";
import { exportCsv } from "../../common/model/exportCsv.js";
import { parseTable } from "../../common/model/parseTable.js";
import { downloadText, installDropTarget, openTextFile } from "../../common/view/fileIO.js";
import { EXPORT_FILE_NAME, LAYOUT } from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";
import { createTextButton } from "./createTextButton.js";
import { editCalculatedColumn } from "./editCalculatedColumn.js";
import { fillPattern } from "./fillPattern.js";
import type { GraphView } from "./GraphView.js";
import type { RunControls } from "./RunControls.js";
import { isDoubtfulImport, reviewImport } from "./reviewImport.js";

/** True when a keystroke or paste belongs to a text field or an open dialog, not to the table as a whole. */
function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof Element && target.closest("dialog") !== null)
  );
}

export type ImportExportControls = {
  readonly importButtons: Node;
  readonly tableButtons: Node;
  readonly fileButtons: Node;
  readonly openButton: Node;
  readonly pasteButton: Node;
  readonly sampleButton: Node;
  readonly addRowButton: Node;
  readonly addColumnButton: Node;
  readonly exportButton: Node;
  readonly undoButton: Node;
  readonly redoButton: Node;
  readonly calculatedButton: Node;
};

export function createImportExportControls(
  model: DataLabModel,
  graphView: GraphView,
  runs: RunControls,
  messageProperty: Property<string>,
): ImportExportControls {
  const labels = StringManager.getInstance().getLabels();
  const createButton = createTextButton;

  const defaultColumnName = (position: number) =>
    fillPattern(labels.defaultColumnNameStringProperty.value, { position });
  const fileUnreadable = () => {
    messageProperty.value = labels.fileReadFailedStringProperty.value;
  };
  /** Replaces the table. `replacedMessage` is shown when the student did not ask for a new table by name. */
  const importText = (text: string, replacedMessage = "") => {
    const { dataset } = parseTable(text, { defaultColumnName });
    if (dataset.columns.length === 0 || dataset.rowCount === 0) {
      messageProperty.value = labels.importFailedStringProperty.value;
      return;
    }
    const accept = (imported: Dataset) => {
      model.importDataset(imported);
      graphView.autoScale();
      messageProperty.value = replacedMessage;
    };
    // A reading that left a column without numbers is shown for correction first.
    if (isDoubtfulImport(dataset)) {
      reviewImport(text, defaultColumnName, accept);
    } else {
      accept(dataset);
    }
  };
  installDropTarget((text, name) => {
    if (name.toLowerCase().endsWith(".json")) {
      runs.openSession(text);
    } else {
      importText(text);
    }
  }, fileUnreadable);

  // Ctrl+V anywhere outside a text field replaces the table with the clipboard.
  // It is easy to do by accident, so it says what happened and how to go back.
  document.addEventListener("paste", (event) => {
    if (isTextEntry(event.target)) {
      return;
    }
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (text.trim() !== "") {
      event.preventDefault();
      importText(text, labels.tableReplacedStringProperty.value);
    }
  });

  // Ctrl+Z and Ctrl+Y (or Shift+Ctrl+Z) undo and redo table edits. Inside a text
  // field they keep their usual meaning for the text being typed.
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || isTextEntry(event.target)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "z" || key === "y") {
      event.preventDefault();
      if (key === "y" || event.shiftKey) {
        model.redo();
      } else {
        model.undo();
      }
    }
  });

  const openButton = createButton(labels.openFileStringProperty, () =>
    openTextFile((text) => importText(text), fileUnreadable),
  );
  const pasteButton = createButton(labels.pasteTableStringProperty, () => {
    // Reading the clipboard needs the browser's permission; without it the
    // student is pointed to Ctrl+V, which never does.
    const showHint = () => {
      messageProperty.value = labels.pasteHintStringProperty.value;
    };
    if (navigator.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then((text) => importText(text))
        .catch(showHint);
    } else {
      showHint();
    }
  });
  const sampleButton = createButton(labels.sampleDataStringProperty, () => {
    model.loadSample();
    graphView.autoScale();
    messageProperty.value = "";
  });
  const importButtons = new HBox({
    spacing: LAYOUT.BUTTON_ROW_SPACING,
    children: [openButton, pasteButton, sampleButton, runs.captureButton],
  });

  const addRowButton = createButton(labels.addRowStringProperty, () => model.addRow());
  const addColumnButton = createButton(labels.addColumnStringProperty, () => {
    model.addColumn(defaultColumnName(model.datasetProperty.value.columns.length + 1));
  });
  const calculatedButton = createButton(labels.calculatedColumnStringProperty, () => editCalculatedColumn(model));
  const exportButton = createButton(labels.exportCsvStringProperty, () => {
    const csv = exportCsv(model.datasetProperty.value, {
      xColumnIndex: model.xColumnIndexProperty.value,
      inclusion: model.inclusionProperty.value,
      fit: model.fitProperty.value,
    });
    downloadText(csv, EXPORT_FILE_NAME, "text/csv;charset=utf-8;");
  });
  // Arrows keep the row inside the table's width; the names are read out.
  const undoButton = createButton("↶", () => model.undo(), { accessibleName: labels.undoStringProperty });
  const redoButton = createButton("↷", () => model.redo(), { accessibleName: labels.redoStringProperty });
  model.canUndoProperty.link((canUndo) => {
    undoButton.enabled = canUndo;
  });
  model.canRedoProperty.link((canRedo) => {
    redoButton.enabled = canRedo;
  });
  const tableButtons = new HBox({
    spacing: LAYOUT.BUTTON_ROW_SPACING,
    children: [addRowButton, addColumnButton, exportButton, undoButton, redoButton],
  });
  const fileButtons = new HBox({
    spacing: LAYOUT.BUTTON_ROW_SPACING,
    children: [calculatedButton, runs.loadSessionButton, runs.saveSessionButton],
  });

  return {
    importButtons,
    tableButtons,
    fileButtons,
    openButton,
    pasteButton,
    sampleButton,
    addRowButton,
    addColumnButton,
    exportButton,
    undoButton,
    redoButton,
    calculatedButton,
  };
}
