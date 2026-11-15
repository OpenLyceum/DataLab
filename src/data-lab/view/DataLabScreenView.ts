/**
 * DataLabScreenView.ts
 *
 * Lays out the Data Lab screen in three columns: the data table with its import
 * and export buttons on the left; the graph, the residual graph, the range fields
 * and the status line in the middle; the column choosers, the fit model and the
 * results on the right.
 *
 * Text-entry controls (the table, the column choosers, the range fields) are real
 * HTML elements mounted through Scenery's DOM node; everything else is Scenery.
 */

import { Multilink, type Property, StringProperty } from "scenerystack/axon";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { DOM, HBox, Node, Text, VBox } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { Checkbox, ComboBox } from "scenerystack/sun";
import {
  DATA_LAB_COMBO_BOX_OPTIONS,
  FLAT_RESET_ALL_BUTTON_OPTIONS,
  LIGHT_SURFACE_TEXT_FILL,
} from "../../common/DataLabButtonOptions.js";
import { DataLabPanel } from "../../common/DataLabPanel.js";
import { columnLabel, type Dataset, isNumericColumn } from "../../common/model/Dataset.js";
import { exportCsv } from "../../common/model/exportCsv.js";
import { FIT_MODELS } from "../../common/model/formatFit.js";
import type { FitModelValue } from "../../common/model/leastSquares.js";
import { parseTable } from "../../common/model/parseTable.js";
import { downloadBlob, downloadText, installDropTarget, openTextFile } from "../../common/view/fileIO.js";
import DataLabColors from "../../DataLabColors.js";
import {
  COLUMN_SPACING,
  EXPORT_FILE_NAME,
  FONTS,
  GRAPH_EXPORT_FILE_NAME,
  HTML_CONTROL_FONT,
  LAYOUT,
  PLOT,
  PLOT_HEIGHT,
  PLOT_LEFT,
  PLOT_WIDTH,
  RESIDUAL_PLOT_GAP,
  RESIDUAL_PLOT_HEIGHT,
  RIGHT_COLUMN_WIDTH,
  SCREEN_VIEW_MARGIN,
  SELECT_WIDTH,
  TABLE_HEIGHT,
  TABLE_WIDTH,
} from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabPreferencesModel } from "../../preferences/DataLabPreferencesModel.js";
import type { DataLabModel } from "../model/DataLabModel.js";
import { createTextButton } from "./createTextButton.js";
import { DataLabScreenSummaryContent } from "./DataLabScreenSummaryContent.js";
import { DataTableNode } from "./DataTableNode.js";
import { editCalculatedColumn } from "./editCalculatedColumn.js";
import { fillPattern } from "./fillPattern.js";
import { createFitTextProperty, fitSummary, modelNameProperties, pinnedFitText } from "./fitText.js";
import { GraphView } from "./GraphView.js";
import { PlotNode } from "./PlotNode.js";
import { createRangeControls } from "./RangeControls.js";
import { ResidualPlotNode } from "./ResidualPlotNode.js";
import { ResultsPanel } from "./ResultsPanel.js";
import { createRunControls } from "./RunControls.js";
import { isDoubtfulImport, reviewImport } from "./reviewImport.js";
import { showFitComparison } from "./showFitComparison.js";
import { showRangeAnalysis } from "./showRangeAnalysis.js";

export type DataLabScreenViewOptions = ScreenViewOptions;

/** True when a keystroke or paste belongs to a text field or an open dialog, not to the table as a whole. */
function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof Element && target.closest("dialog") !== null)
  );
}

export class DataLabScreenView extends ScreenView {
  /** The visible x and y intervals; created in the constructor, once the model is known. */
  private readonly graphView: GraphView;

  /** A short notice about the last import, paste or copy; "" when there is nothing to say. */
  private readonly messageProperty = new StringProperty("");

  public constructor(
    model: DataLabModel,
    preferences: DataLabPreferencesModel,
    providedOptions?: DataLabScreenViewOptions,
  ) {
    const fitTextProperty = createFitTextProperty(model);
    const options = optionize<DataLabScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new DataLabScreenSummaryContent(fitTextProperty),
      },
      providedOptions,
    );
    super(options);

    this.graphView = new GraphView(model);
    const graphView = this.graphView;

    const labels = StringManager.getInstance().getLabels();
    const a11y = StringManager.getInstance().getDataLabA11yStrings();
    const bounds = this.layoutBounds;
    const textOptions = { font: FONTS.CONTROL, fill: DataLabColors.textColorProperty };
    const createButton = createTextButton;

    const runs = createRunControls(model, graphView, preferences, this.messageProperty);

    // ── Import ────────────────────────────────────────────────────────────────
    const defaultColumnName = (position: number) =>
      fillPattern(labels.defaultColumnNameStringProperty.value, { position });
    const fileUnreadable = () => {
      this.messageProperty.value = labels.fileReadFailedStringProperty.value;
    };
    /** Replaces the table. `replacedMessage` is shown when the student did not ask for a new table by name. */
    const importText = (text: string, replacedMessage = "") => {
      const { dataset } = parseTable(text, { defaultColumnName });
      if (dataset.columns.length === 0 || dataset.rowCount === 0) {
        this.messageProperty.value = labels.importFailedStringProperty.value;
        return;
      }
      const accept = (imported: Dataset) => {
        model.importDataset(imported);
        graphView.autoScale();
        this.messageProperty.value = replacedMessage;
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
        this.messageProperty.value = labels.pasteHintStringProperty.value;
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
      this.messageProperty.value = "";
    });
    const importButtons = new HBox({
      spacing: LAYOUT.BUTTON_ROW_SPACING,
      children: [openButton, pasteButton, sampleButton, runs.captureButton],
    });

    // ── Table ─────────────────────────────────────────────────────────────────
    const table = new DataTableNode(model, { width: TABLE_WIDTH, height: TABLE_HEIGHT });
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

    const leftColumn = new VBox({
      align: "left",
      spacing: LAYOUT.STACK_SPACING,
      children: [runs.runRow, importButtons, table, tableButtons, fileButtons],
      left: bounds.minX + SCREEN_VIEW_MARGIN,
      top: bounds.minY + SCREEN_VIEW_MARGIN,
    });
    this.addChild(leftColumn);

    // ── Graphs ────────────────────────────────────────────────────────────────
    const plot = new PlotNode(model, graphView, { viewWidth: PLOT_WIDTH, viewHeight: PLOT_HEIGHT });
    // Position by the plot rectangle, not by bounds that change with the tick labels.
    plot.x = PLOT_LEFT;
    plot.y = bounds.minY + SCREEN_VIEW_MARGIN + 4;
    const residualPlot = new ResidualPlotNode(model, graphView, {
      viewWidth: PLOT_WIDTH,
      viewHeight: RESIDUAL_PLOT_HEIGHT,
    });
    residualPlot.x = PLOT_LEFT;
    residualPlot.y = plot.y + PLOT_HEIGHT + RESIDUAL_PLOT_GAP;
    const graphs = new Node({ children: [plot, residualPlot], excludeInvisibleChildrenFromBounds: true });
    this.addChild(graphs);
    // The two graphs share an x axis; its numbers are printed under the lower one.
    preferences.showResidualsProperty.link((showResiduals) => {
      residualPlot.visible = showResiduals;
      plot.frame.setXLabelsVisible(!showResiduals);
    });

    const exportGraphButton = createButton(labels.exportPngStringProperty, () => {
      const background = DataLabColors.backgroundColorProperty.value.toCSS();
      // Drawn larger than on screen: the graph is going into a lab report.
      const enlarged = new Node({ scale: PLOT.EXPORT_SCALE, children: [graphs] });
      enlarged.toCanvas((canvas) => {
        enlarged.removeAllChildren();
        enlarged.dispose();
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }
        context.globalCompositeOperation = "destination-over";
        context.resetTransform();
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, GRAPH_EXPORT_FILE_NAME);
          }
        });
      });
    });

    // ── Range ─────────────────────────────────────────────────────────────────
    const rangeRow = createRangeControls(model);
    const clearRangeButton = createButton(labels.clearRangeStringProperty, () => model.clearRange());
    const zoomButton = createButton(labels.zoomToRangeStringProperty, () => {
      const range = model.rangeProperty.value;
      if (range) {
        graphView.zoomToRange(range);
      }
    });
    const autoScaleButton = createButton(labels.autoScaleStringProperty, () => graphView.autoScale());
    model.rangeProperty.link((range) => {
      clearRangeButton.enabled = range !== null;
      zoomButton.enabled = range !== null;
    });
    graphView.isAutoScaledProperty.link((isAutoScaled) => {
      autoScaleButton.enabled = !isAutoScaled;
    });

    const analyzeButton = createButton(labels.rangeAnalysisStringProperty, () => showRangeAnalysis(model));
    const rangeButtons = new HBox({
      spacing: LAYOUT.BUTTON_ROW_SPACING,
      children: [clearRangeButton, zoomButton, autoScaleButton, analyzeButton],
    });

    const pinButton = createButton(labels.pinFitStringProperty, () => model.pinFit());
    const removePinButton = createButton(labels.removePinnedFitStringProperty, () => model.clearPinnedFit());
    const compareButton = createButton(labels.compareFitsStringProperty, () => {
      const pin = model.pinnedFitProperty.value;
      if (pin) {
        showFitComparison(fitTextProperty.value, pinnedFitText(pin));
      }
    });
    const pinLegend = new Text(labels.pinnedFitLegendStringProperty, {
      font: FONTS.NOTE,
      fill: DataLabColors.pinnedFitColorProperty,
      maxWidth: PLOT_WIDTH,
    });
    Multilink.multilink([model.rangeProperty, model.fitProperty, model.pinnedFitProperty], (range, fit, pin) => {
      pinButton.enabled = range !== null && fit.ok && pin === null;
      removePinButton.enabled = pin !== null;
      compareButton.enabled = pin !== null;
      pinLegend.visible = pin !== null;
    });
    const pinControls = new HBox({
      spacing: LAYOUT.BUTTON_ROW_SPACING,
      children: [pinButton, compareButton, removePinButton, pinLegend],
    });

    const logXCheckbox = new Checkbox(graphView.logXProperty, new Text(labels.logXStringProperty, textOptions), {
      accessibleName: labels.logXStringProperty,
    });
    const logYCheckbox = new Checkbox(graphView.logYProperty, new Text(labels.logYStringProperty, textOptions), {
      accessibleName: labels.logYStringProperty,
    });
    const rectangleCheckbox = new Checkbox(
      graphView.rectangleSelectionProperty,
      new Text(labels.rectangleSelectionStringProperty, textOptions),
      {
        accessibleName: labels.rectangleSelectionStringProperty,
      },
    );
    const logNotice = new Text("", { ...textOptions, maxWidth: PLOT_WIDTH });
    const scales = new HBox({
      spacing: LAYOUT.STACK_SPACING,
      children: [logXCheckbox, logYCheckbox, rectangleCheckbox, logNotice],
    });

    const statusText = new Text("", { ...textOptions, maxWidth: PLOT_WIDTH + LAYOUT.STATUS_EXTRA_WIDTH });
    const liveStatus = new Node({ tagName: "div", ariaRole: "status" });
    liveStatus.setPDOMAttribute("aria-live", "polite");
    liveStatus.setPDOMAttribute("aria-atomic", "true");
    Multilink.multilink(
      [fitTextProperty, graphView.hiddenCountProperty, labels.logHiddenStringProperty, this.messageProperty],
      (fitText, hidden, pattern, message) => {
        const notice = hidden ? fillPattern(pattern, { count: hidden }) : "";
        statusText.string = fitText.status;
        logNotice.string = notice;
        const announcement = [fitText.status, notice, message].filter(Boolean).join(". ");
        if (liveStatus.innerContent !== announcement) {
          liveStatus.innerContent = announcement;
        }
      },
    );
    const messageText = new Text("", { font: FONTS.NOTE, fill: DataLabColors.textColorProperty, maxWidth: PLOT_WIDTH });
    Multilink.multilink(
      [this.messageProperty, labels.dragHintStringProperty, labels.localOnlyStringProperty],
      (message, dragHint, localOnly) => {
        messageText.string = message === "" ? `${dragHint} ${localOnly}` : message;
      },
    );

    const belowPlots = new VBox({
      align: "left",
      spacing: LAYOUT.STACK_SPACING,
      children: [rangeRow, rangeButtons, statusText, messageText, pinControls, scales],
      left: PLOT_LEFT - 30,
      top: residualPlot.y + RESIDUAL_PLOT_HEIGHT + 42,
    });
    this.addChild(belowPlots);

    // ── Column choosers ───────────────────────────────────────────────────────
    const createSelect = (
      accessibleName: typeof a11y.controls.xColumnStringProperty,
      property: Property<number>,
      emptyLabel?: typeof labels.unweightedStringProperty,
    ) => {
      const select = document.createElement("select");
      select.style.cssText = `width: ${SELECT_WIDTH}px; box-sizing: border-box; font: ${HTML_CONTROL_FONT}; padding: 2px;`;
      accessibleName.link((name) => select.setAttribute("aria-label", name));
      select.addEventListener("change", () => {
        property.value = Number(select.value);
      });
      const fill = () => {
        select.replaceChildren();
        if (emptyLabel) {
          const option = document.createElement("option");
          option.value = "-1";
          option.textContent = emptyLabel.value;
          select.appendChild(option);
        }
        model.datasetProperty.value.columns.forEach((column, index) => {
          if (isNumericColumn(column) || index === property.value) {
            const option = document.createElement("option");
            option.value = String(index);
            option.textContent = columnLabel(column);
            select.appendChild(option);
          }
        });
        select.value = String(property.value);
      };
      model.datasetProperty.link(fill);
      property.lazyLink(fill);
      emptyLabel?.lazyLink(fill);
      return new DOM(select, { allowInput: true });
    };
    const xSelect = createSelect(a11y.controls.xColumnStringProperty, model.xColumnIndexProperty);
    const ySelect = createSelect(a11y.controls.yColumnStringProperty, model.yColumnIndexProperty);

    const uncertaintySelect = createSelect(
      labels.uncertaintyColumnStringProperty,
      model.uncertaintyColumnIndexProperty,
      labels.unweightedStringProperty,
    );

    // ── Fit model ─────────────────────────────────────────────────────────────
    const modelNames = modelNameProperties();
    // The popup sits above the results panel while the button stays in the controls.
    const fitModelPopup = new Node();
    const fitModelComboBox = new ComboBox<FitModelValue>(
      model.fitModelProperty,
      FIT_MODELS.map((value) => ({
        value,
        createNode: () =>
          new Text(modelNames[value], {
            font: FONTS.CONTROL,
            fill: LIGHT_SURFACE_TEXT_FILL,
            maxWidth: SELECT_WIDTH - LAYOUT.COMBO_LABEL_INSET,
          }),
        accessibleName: modelNames[value],
      })),
      fitModelPopup,
      {
        ...DATA_LAB_COMBO_BOX_OPTIONS,
        preferredWidth: SELECT_WIDTH,
        xMargin: LAYOUT.BUTTON_X_MARGIN,
        yMargin: LAYOUT.COMBO_Y_MARGIN,
        accessibleName: labels.fitModelStringProperty,
      },
    );

    const heading = (string: typeof labels.xAxisStringProperty) =>
      new Text(string, {
        font: FONTS.CONTROL_BOLD,
        fill: DataLabColors.textColorProperty,
        maxWidth: RIGHT_COLUMN_WIDTH - LAYOUT.PANEL_TITLE_INSET,
      });
    const controlPanel = new DataLabPanel(
      new VBox({
        align: "left",
        spacing: LAYOUT.BUTTON_ROW_SPACING,
        children: [
          heading(labels.xAxisStringProperty),
          xSelect,
          heading(labels.yAxisStringProperty),
          ySelect,
          heading(labels.uncertaintyColumnStringProperty),
          uncertaintySelect,
          heading(labels.fitModelStringProperty),
          fitModelComboBox,
        ],
      }),
      { minWidth: RIGHT_COLUMN_WIDTH, align: "left" },
    );

    const resultsPanel = new ResultsPanel(fitTextProperty, RIGHT_COLUMN_WIDTH - 24);
    const copyButton = createButton(labels.copySummaryStringProperty, () => {
      const current = fitSummary(fitTextProperty.value);
      const pin = model.pinnedFitProperty.value;
      const result = pin
        ? `${labels.currentFitStringProperty.value}\n${current}\n\n${labels.pinnedFitStringProperty.value}\n${fitSummary(pinnedFitText(pin))}`
        : current;
      navigator.clipboard
        ?.writeText(result)
        .then(() => {
          this.messageProperty.value = labels.copiedStringProperty.value;
        })
        .catch(() => undefined);
    });

    const rightColumn = new VBox({
      align: "left",
      spacing: COLUMN_SPACING,
      children: [
        controlPanel,
        resultsPanel,
        new HBox({ spacing: LAYOUT.BUTTON_ROW_SPACING, children: [copyButton, exportGraphButton] }),
      ],
      top: bounds.minY + SCREEN_VIEW_MARGIN,
    });
    rightColumn.left = bounds.maxX - SCREEN_VIEW_MARGIN - RIGHT_COLUMN_WIDTH;
    this.addChild(rightColumn);

    // ── Reset All ─────────────────────────────────────────────────────────────
    const resetAllButton = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      listener: () => {
        model.reset();
        this.reset();
      },
      right: bounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: bounds.maxY - SCREEN_VIEW_MARGIN,
    });
    this.addChild(resetAllButton);

    // ── Keyboard / reading order ──────────────────────────────────────────────
    this.addChild(fitModelPopup);
    this.addChild(liveStatus);
    this.addChild(
      new Node({
        pdomOrder: [
          runs.newRunButton,
          runs.manageRunButton,
          openButton,
          pasteButton,
          sampleButton,
          runs.captureButton,
          addRowButton,
          addColumnButton,
          exportButton,
          undoButton,
          redoButton,
          calculatedButton,
          runs.loadSessionButton,
          runs.saveSessionButton,
          plot.rangeStartHandle,
          plot.rangeEndHandle,
          clearRangeButton,
          zoomButton,
          autoScaleButton,
          analyzeButton,
          liveStatus,
          rectangleCheckbox,
          logXCheckbox,
          logYCheckbox,
          pinButton,
          compareButton,
          removePinButton,
          fitModelComboBox,
          copyButton,
          exportGraphButton,
          resetAllButton,
        ],
      }),
    );
  }

  /** Resets view-side state. The table is kept; see DataLabModel.reset(). */
  public reset(): void {
    this.graphView.rectangleSelectionProperty.reset();
    this.graphView.setLogAxes(false, false);
    this.graphView.autoScale();
    this.messageProperty.reset();
  }
}
