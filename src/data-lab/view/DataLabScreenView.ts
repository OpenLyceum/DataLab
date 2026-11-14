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
import { PhetFont, ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { Checkbox, TextPushButton, VerticalAquaRadioButtonGroup } from "scenerystack/sun";
import {
  FLAT_PANEL_PUSH_BUTTON_OPTIONS,
  FLAT_RESET_ALL_BUTTON_OPTIONS,
  LIGHT_SURFACE_TEXT_FILL,
} from "../../common/DataLabButtonOptions.js";
import { DataLabPanel } from "../../common/DataLabPanel.js";
import { columnLabel, createColumn, isNumericColumn, parseNumber } from "../../common/model/Dataset.js";
import { exportCsv } from "../../common/model/exportCsv.js";
import { FIT_MODELS } from "../../common/model/formatFit.js";
import { FitModel, type FitModelValue } from "../../common/model/leastSquares.js";
import { downloadBlob, downloadText, installDropTarget, openTextFile } from "../../common/view/fileIO.js";
import DataLabColors from "../../DataLabColors.js";
import {
  COLUMN_SPACING,
  CONTROL_FONT_SIZE,
  EXPORT_FILE_NAME,
  GRAPH_EXPORT_FILE_NAME,
  PLOT_HEIGHT,
  PLOT_LEFT,
  PLOT_WIDTH,
  RANGE_FIELD_WIDTH,
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
import { RunWorkspace } from "../model/RunWorkspace.js";
import { decodeSession, encodeSession, SESSION_FILE_NAME, type Session } from "../model/sessionFile.js";
import { DataLabScreenSummaryContent } from "./DataLabScreenSummaryContent.js";
import { DataTableNode } from "./DataTableNode.js";
import { editCalculatedColumn } from "./editCalculatedColumn.js";
import { editRun } from "./editRun.js";
import { fillPattern } from "./fillPattern.js";
import { createFitTextProperty, fitSummary, modelNameProperties, pinnedFitText } from "./fitText.js";
import { GraphView } from "./GraphView.js";
import { PlotNode } from "./PlotNode.js";
import { ResidualPlotNode } from "./ResidualPlotNode.js";
import { ResultsPanel } from "./ResultsPanel.js";
import { showFitComparison } from "./showFitComparison.js";
import { showRangeAnalysis } from "./showRangeAnalysis.js";

export type DataLabScreenViewOptions = ScreenViewOptions;

const CONTROL_FONT = new PhetFont(CONTROL_FONT_SIZE);
const NOTE_FONT = new PhetFont(11);
const HTML_FONT = `${CONTROL_FONT_SIZE}px Arial, sans-serif`;

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

    const labels = StringManager.getInstance().getLabels();
    const a11y = StringManager.getInstance().getDataLabA11yStrings();
    const bounds = this.layoutBounds;
    const textOptions = { font: CONTROL_FONT, fill: DataLabColors.textColorProperty };

    const createButton = (string: typeof labels.openFileStringProperty, listener: () => void) =>
      new TextPushButton(string, {
        ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
        font: CONTROL_FONT,
        textFill: LIGHT_SURFACE_TEXT_FILL,
        maxTextWidth: 110,
        xMargin: 8,
        yMargin: 5,
        listener,
      });

    const runName = (position: number) => fillPattern(labels.defaultRunStringProperty.value, { position });
    const captureRun = (): Session => ({
      ...model.fitSettings(),
      dataset: model.datasetProperty.value,
      xColumn: model.xColumnIndexProperty.value,
      yColumn: model.yColumnIndexProperty.value,
      logX: this.graphView.logXProperty.value,
      logY: this.graphView.logYProperty.value,
      showResiduals: preferences.showResidualsProperty.value,
      pin: model.pinnedFitProperty.value?.settings ?? null,
    });
    const restoreRun = (session: Session) => {
      model.loadSession(session);
      this.graphView.setLogAxes(session.logX, session.logY);
      this.graphView.autoScale();
      preferences.showResidualsProperty.value = session.showResiduals;
      this.messageProperty.value = "";
    };
    const runWorkspace = new RunWorkspace(runName(1), captureRun, restoreRun);
    const runSelect = document.createElement("select");
    runSelect.style.cssText = `width: 120px; box-sizing: border-box; font: ${HTML_FONT}; padding: 2px;`;
    labels.activeRunStringProperty.link((name) => runSelect.setAttribute("aria-label", name));
    const refreshRuns = () => {
      runSelect.replaceChildren(...runWorkspace.names.map((name, i) => new Option(name, String(i))));
      runSelect.value = String(runWorkspace.selectedIndex);
    };
    refreshRuns();
    runSelect.addEventListener("change", () => runWorkspace.select(Number(runSelect.value)));
    const newRunButton = createButton(labels.newRunStringProperty, () => {
      const columnName = (position: number) => fillPattern(labels.defaultColumnNameStringProperty.value, { position });
      const names = runWorkspace.names;
      let runNumber = names.length + 1;
      while (names.includes(runName(runNumber))) {
        runNumber++;
      }
      runWorkspace.add(runName(runNumber), {
        dataset: {
          columns: [createColumn(columnName(1), "", [""]), createColumn(columnName(2), "", [""])],
          rowCount: 1,
        },
        xColumn: -1,
        yColumn: -1,
        uncertaintyColumn: -1,
        range: null,
        model: FitModel.LINEAR,
        logX: false,
        logY: false,
        showResiduals: preferences.showResidualsProperty.value,
        pin: null,
      });
      refreshRuns();
    });
    const manageRunButton = createButton(labels.manageRunStringProperty, () => editRun(runWorkspace, refreshRuns));
    const runButtons = new HBox({
      spacing: 6,
      children: [new DOM(runSelect, { allowInput: true }), newRunButton, manageRunButton],
    });

    // ── Import ────────────────────────────────────────────────────────────────
    const importText = (text: string) => {
      const imported = model.importText(text, (position) =>
        fillPattern(labels.defaultColumnNameStringProperty.value, { position }),
      );
      this.graphView.autoScale();
      this.messageProperty.value = imported ? "" : labels.importFailedStringProperty.value;
    };
    const openSession = (text: string) => {
      const session = decodeSession(text, runName(1));
      if (session) {
        runWorkspace.load(session);
        refreshRuns();
      }
      this.messageProperty.value = session ? "" : labels.sessionInvalidStringProperty.value;
    };
    installDropTarget((text, name) => {
      if (name.toLowerCase().endsWith(".json")) {
        openSession(text);
      } else {
        importText(text);
      }
    });

    // Ctrl+V anywhere outside a text field replaces the table with the clipboard.
    document.addEventListener("paste", (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof Element && target.closest("dialog"))
      ) {
        return;
      }
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (text.trim() !== "") {
        event.preventDefault();
        importText(text);
      }
    });

    const openButton = createButton(labels.openFileStringProperty, () => openTextFile(importText));
    const pasteButton = createButton(labels.pasteTableStringProperty, () => {
      // Reading the clipboard needs the browser's permission; without it the
      // student is pointed to Ctrl+V, which never does.
      const showHint = () => {
        this.messageProperty.value = labels.pasteHintStringProperty.value;
      };
      if (navigator.clipboard?.readText) {
        navigator.clipboard.readText().then(importText).catch(showHint);
      } else {
        showHint();
      }
    });
    const sampleButton = createButton(labels.sampleDataStringProperty, () => {
      model.loadSample();
      this.graphView.autoScale();
      this.messageProperty.value = "";
    });
    const importButtons = new HBox({ spacing: 6, children: [openButton, pasteButton, sampleButton] });

    // ── Table ─────────────────────────────────────────────────────────────────
    const table = new DataTableNode(model, { width: TABLE_WIDTH, height: TABLE_HEIGHT });
    const addRowButton = createButton(labels.addRowStringProperty, () => model.addRow());
    const addColumnButton = createButton(labels.addColumnStringProperty, () => {
      const name = fillPattern(labels.defaultColumnNameStringProperty.value, {
        position: model.datasetProperty.value.columns.length + 1,
      });
      model.addColumn(name);
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
    const tableButtons = new HBox({ spacing: 6, children: [addRowButton, addColumnButton, exportButton] });

    const loadSessionButton = createButton(labels.openSessionStringProperty, () =>
      openTextFile(openSession, ".json,application/json"),
    );
    const saveSessionButton = createButton(labels.saveSessionStringProperty, () => {
      const text = encodeSession(runWorkspace.save());
      downloadText(text, SESSION_FILE_NAME, "application/json");
    });
    const fileButtons = new HBox({ spacing: 6, children: [calculatedButton, loadSessionButton, saveSessionButton] });

    const leftColumn = new VBox({
      align: "left",
      spacing: 8,
      children: [runButtons, importButtons, table, tableButtons, fileButtons],
      left: bounds.minX + SCREEN_VIEW_MARGIN,
      top: bounds.minY + SCREEN_VIEW_MARGIN,
    });
    this.addChild(leftColumn);

    // ── Graphs ────────────────────────────────────────────────────────────────
    const graphView = this.graphView;
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
      graphs.toCanvas((canvas) => {
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

    // ── Range fields ──────────────────────────────────────────────────────────
    const createField = (accessibleName: typeof a11y.controls.rangeMinimumStringProperty) => {
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.autocomplete = "off";
      input.style.cssText = `width: ${RANGE_FIELD_WIDTH}px; box-sizing: border-box; font: ${HTML_FONT}; padding: 3px 5px; text-align: right;`;
      accessibleName.link((name) => input.setAttribute("aria-label", name));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          input.blur();
        }
      });
      return input;
    };
    const minField = createField(a11y.controls.rangeMinimumStringProperty);
    const maxField = createField(a11y.controls.rangeMaximumStringProperty);
    const fieldText = (value: number) => String(Number(value.toPrecision(6)));
    const commitRange = () => {
      const min = parseNumber(minField.value, true);
      const max = parseNumber(maxField.value, true);
      if (!(Number.isFinite(min) || Number.isFinite(max))) {
        model.clearRange();
        return;
      }
      // A single bound typed on its own runs to the end of the data.
      const values = model.distinctXValues();
      model.setRange(
        Number.isFinite(min) ? min : (values[0] ?? max),
        Number.isFinite(max) ? max : (values[values.length - 1] ?? min),
      );
    };
    minField.addEventListener("change", commitRange);
    maxField.addEventListener("change", commitRange);
    model.rangeProperty.link((range) => {
      if (minField !== document.activeElement) {
        minField.value = range ? fieldText(range.min) : "";
      }
      if (maxField !== document.activeElement) {
        maxField.value = range ? fieldText(range.max) : "";
      }
    });
    const unitText = new Text("", { ...textOptions, maxWidth: 50 });
    model.xColumnProperty.link((column) => {
      unitText.string = column?.unit ?? "";
    });

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

    const rangeRow = new HBox({
      spacing: 6,
      children: [
        new Text(labels.rangeFromStringProperty, { ...textOptions, maxWidth: 90 }),
        new DOM(minField, { allowInput: true }),
        new Text(labels.rangeToStringProperty, { ...textOptions, maxWidth: 30 }),
        new DOM(maxField, { allowInput: true }),
        unitText,
      ],
    });
    const analyzeButton = createButton(labels.rangeAnalysisStringProperty, () => showRangeAnalysis(model));
    const rangeButtons = new HBox({
      spacing: 6,
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
      font: NOTE_FONT,
      fill: DataLabColors.pinnedFitColorProperty,
      maxWidth: PLOT_WIDTH,
    });
    Multilink.multilink([model.rangeProperty, model.fitProperty, model.pinnedFitProperty], (range, fit, pin) => {
      pinButton.enabled = range !== null && fit.ok && pin === null;
      removePinButton.enabled = pin !== null;
      compareButton.enabled = pin !== null;
      pinLegend.visible = pin !== null;
    });
    const pinControls = new HBox({ spacing: 6, children: [pinButton, compareButton, removePinButton, pinLegend] });

    const logXCheckbox = new Checkbox(graphView.logXProperty, new Text(labels.logXStringProperty, textOptions), {
      accessibleName: labels.logXStringProperty,
    });
    const logYCheckbox = new Checkbox(graphView.logYProperty, new Text(labels.logYStringProperty, textOptions), {
      accessibleName: labels.logYStringProperty,
    });
    const logNotice = new Text("", { ...textOptions, maxWidth: PLOT_WIDTH });
    const scales = new HBox({ spacing: 8, children: [logXCheckbox, logYCheckbox, logNotice] });

    const statusText = new Text("", { ...textOptions, maxWidth: PLOT_WIDTH + 40 });
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
    const messageText = new Text("", { font: NOTE_FONT, fill: DataLabColors.textColorProperty, maxWidth: PLOT_WIDTH });
    Multilink.multilink(
      [this.messageProperty, labels.dragHintStringProperty, labels.localOnlyStringProperty],
      (message, dragHint, localOnly) => {
        messageText.string = message === "" ? `${dragHint} ${localOnly}` : message;
      },
    );

    const belowPlots = new VBox({
      align: "left",
      spacing: 8,
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
      select.style.cssText = `width: ${SELECT_WIDTH}px; box-sizing: border-box; font: ${HTML_FONT}; padding: 2px;`;
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
    const modelRadioButtons = new VerticalAquaRadioButtonGroup<FitModelValue>(
      model.fitModelProperty,
      FIT_MODELS.map((value) => ({
        value,
        createNode: () => new Text(modelNames[value], { ...textOptions, maxWidth: RIGHT_COLUMN_WIDTH - 60 }),
        options: { accessibleName: modelNames[value] },
      })),
      { spacing: 6, accessibleName: labels.fitModelStringProperty },
    );

    const heading = (string: typeof labels.xAxisStringProperty) =>
      new Text(string, {
        font: new PhetFont({ size: CONTROL_FONT_SIZE, weight: "bold" }),
        fill: DataLabColors.textColorProperty,
        maxWidth: RIGHT_COLUMN_WIDTH - 30,
      });
    const controlPanel = new DataLabPanel(
      new VBox({
        align: "left",
        spacing: 6,
        children: [
          heading(labels.xAxisStringProperty),
          xSelect,
          heading(labels.yAxisStringProperty),
          ySelect,
          heading(labels.uncertaintyColumnStringProperty),
          uncertaintySelect,
          heading(labels.fitModelStringProperty),
          modelRadioButtons,
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
      children: [controlPanel, resultsPanel, new HBox({ spacing: 6, children: [copyButton, exportGraphButton] })],
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
    this.addChild(liveStatus);
    this.addChild(
      new Node({
        pdomOrder: [
          newRunButton,
          manageRunButton,
          openButton,
          pasteButton,
          sampleButton,
          addRowButton,
          addColumnButton,
          calculatedButton,
          loadSessionButton,
          saveSessionButton,
          exportButton,
          plot.rangeStartHandle,
          plot.rangeEndHandle,
          clearRangeButton,
          zoomButton,
          autoScaleButton,
          analyzeButton,
          liveStatus,
          logXCheckbox,
          logYCheckbox,
          pinButton,
          compareButton,
          removePinButton,
          modelRadioButtons,
          copyButton,
          exportGraphButton,
          resetAllButton,
        ],
      }),
    );
  }

  /** Resets view-side state. The table is kept; see DataLabModel.reset(). */
  public reset(): void {
    this.graphView.setLogAxes(false, false);
    this.graphView.autoScale();
    this.messageProperty.reset();
  }
}
