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

import { Multilink, StringProperty } from "scenerystack/axon";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { HBox, Node, Text, VBox } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { Checkbox } from "scenerystack/sun";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/DataLabButtonOptions.js";
import DataLabColors from "../../DataLabColors.js";
import {
  FONTS,
  LAYOUT,
  PLOT_HEIGHT,
  PLOT_LEFT,
  PLOT_WIDTH,
  RESIDUAL_PLOT_GAP,
  RESIDUAL_PLOT_HEIGHT,
  RIGHT_COLUMN_WIDTH,
  SCREEN_VIEW_MARGIN,
  TABLE_HEIGHT,
  TABLE_WIDTH,
} from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabPreferencesModel } from "../../preferences/DataLabPreferencesModel.js";
import type { DataLabModel } from "../model/DataLabModel.js";
import { createFitControlsColumn } from "./createFitControlsColumn.js";
import { createImportExportControls } from "./createImportExportControls.js";
import { createTextButton } from "./createTextButton.js";
import { DataLabScreenSummaryContent } from "./DataLabScreenSummaryContent.js";
import { DataTableNode } from "./DataTableNode.js";
import { fillPattern } from "./fillPattern.js";
import { createFitTextProperty, pinnedFitText } from "./fitText.js";
import { GraphView } from "./GraphView.js";
import { PlotNode } from "./PlotNode.js";
import { createRangeControls } from "./RangeControls.js";
import { ResidualPlotNode } from "./ResidualPlotNode.js";
import { createRunControls } from "./RunControls.js";
import { showFitComparison } from "./showFitComparison.js";
import { showRangeAnalysis } from "./showRangeAnalysis.js";

export type DataLabScreenViewOptions = ScreenViewOptions;

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
    const bounds = this.layoutBounds;
    const textOptions = { font: FONTS.CONTROL, fill: DataLabColors.textColorProperty };
    const createButton = createTextButton;

    const runs = createRunControls(model, graphView, preferences, this.messageProperty);
    const tableBar = createImportExportControls(model, graphView, runs, this.messageProperty);

    // ── Table ─────────────────────────────────────────────────────────────────
    const table = new DataTableNode(model, { width: TABLE_WIDTH, height: TABLE_HEIGHT });
    const leftColumn = new VBox({
      align: "left",
      spacing: LAYOUT.STACK_SPACING,
      children: [runs.runRow, tableBar.importButtons, table, tableBar.tableButtons, tableBar.fileButtons],
      left: bounds.minX + SCREEN_VIEW_MARGIN,
      top: bounds.minY + SCREEN_VIEW_MARGIN,
    });
    this.addChild(leftColumn);

    // ── Graphs ────────────────────────────────────────────────────────────────
    const plot = new PlotNode(model, graphView, { viewWidth: PLOT_WIDTH, viewHeight: PLOT_HEIGHT });
    // Position by the plot rectangle, not by bounds that change with the tick labels.
    plot.x = PLOT_LEFT;
    plot.y = bounds.minY + SCREEN_VIEW_MARGIN + LAYOUT.PLOT_TOP_OFFSET;
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
      left: PLOT_LEFT - LAYOUT.GRAPH_FOOTER_LEFT_INSET,
      top: residualPlot.y + RESIDUAL_PLOT_HEIGHT + LAYOUT.GRAPH_FOOTER_TOP_GAP,
    });
    this.addChild(belowPlots);

    // ── Right column ──────────────────────────────────────────────────────────
    const fitColumn = createFitControlsColumn(model, fitTextProperty, graphs, this.messageProperty);
    fitColumn.node.top = bounds.minY + SCREEN_VIEW_MARGIN;
    fitColumn.node.left = bounds.maxX - SCREEN_VIEW_MARGIN - RIGHT_COLUMN_WIDTH;
    this.addChild(fitColumn.node);

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
    this.addChild(fitColumn.fitModelPopup);
    this.addChild(liveStatus);
    this.addChild(
      new Node({
        pdomOrder: [
          runs.newRunButton,
          runs.manageRunButton,
          tableBar.openButton,
          tableBar.pasteButton,
          tableBar.sampleButton,
          runs.captureButton,
          tableBar.addRowButton,
          tableBar.addColumnButton,
          tableBar.exportButton,
          tableBar.undoButton,
          tableBar.redoButton,
          tableBar.calculatedButton,
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
          fitColumn.fitModelComboBox,
          fitColumn.copyButton,
          fitColumn.exportGraphButton,
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
