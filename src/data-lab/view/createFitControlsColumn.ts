/**
 * createFitControlsColumn.ts
 *
 * Right-column fit controls: x/y/uncertainty column choosers, the fit-model
 * combo box, the results panel, and the actions on a fit: copy, export the graph,
 * and whatever the screen adds (the pin controls). The actions wrap to the
 * column's width.
 */

import type { Property, TReadOnlyProperty } from "scenerystack/axon";
import { DOM, FlowBox, Node, Text, VBox } from "scenerystack/scenery";
import { ComboBox } from "scenerystack/sun";
import { DATA_LAB_COMBO_BOX_OPTIONS, LIGHT_SURFACE_TEXT_FILL } from "../../common/DataLabButtonOptions.js";
import { DataLabPanel } from "../../common/DataLabPanel.js";
import { columnLabel, isNumericColumn } from "../../common/model/Dataset.js";
import { FIT_MODELS } from "../../common/model/formatFit.js";
import type { FitModelValue } from "../../common/model/leastSquares.js";
import { downloadBlob } from "../../common/view/fileIO.js";
import DataLabColors from "../../DataLabColors.js";
import {
  COLUMN_SPACING,
  FONTS,
  GRAPH_EXPORT_FILE_NAME,
  HTML_CONTROL_FONT,
  LAYOUT,
  PANEL,
  PLOT,
  RIGHT_COLUMN_WIDTH,
  SELECT_WIDTH,
} from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";
import { createIconButton } from "./createIconButton.js";
import { type FitText, fitSummary, modelNameProperties, pinnedFitText } from "./fitText.js";
import { Icons } from "./icons.js";
import { ResultsPanel } from "./ResultsPanel.js";

export type FitControlsColumn = {
  readonly node: Node;
  readonly fitModelComboBox: ComboBox<FitModelValue>;
  readonly fitModelPopup: Node;
  readonly copyButton: Node;
  readonly exportGraphButton: Node;
};

export function createFitControlsColumn(
  model: DataLabModel,
  fitTextProperty: TReadOnlyProperty<FitText>,
  graphs: Node,
  messageProperty: Property<string>,
  extraActions: readonly Node[] = [],
  footer: readonly Node[] = [],
): FitControlsColumn {
  const labels = StringManager.getInstance().getLabels();
  const a11y = StringManager.getInstance().getDataLabA11yStrings();

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

  const resultsPanel = new ResultsPanel(fitTextProperty, RIGHT_COLUMN_WIDTH - PANEL.CONTENT_WIDTH_INSET);
  const copyButton = createIconButton(Icons.copy(), labels.copySummaryStringProperty, () => {
    const current = fitSummary(fitTextProperty.value);
    const pin = model.pinnedFitProperty.value;
    const result = pin
      ? `${labels.currentFitStringProperty.value}\n${current}\n\n${labels.pinnedFitStringProperty.value}\n${fitSummary(pinnedFitText(pin))}`
      : current;
    navigator.clipboard
      ?.writeText(result)
      .then(() => {
        messageProperty.value = labels.copiedStringProperty.value;
      })
      .catch(() => undefined);
  });

  const exportGraphButton = createIconButton(
    Icons.download(),
    labels.exportPngStringProperty,
    () => {
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
    },
    { caption: "PNG" },
  );

  const node = new VBox({
    align: "left",
    spacing: COLUMN_SPACING,
    children: [
      controlPanel,
      resultsPanel,
      new FlowBox({
        orientation: "horizontal",
        wrap: true,
        justify: "left",
        spacing: LAYOUT.BUTTON_ROW_SPACING,
        lineSpacing: LAYOUT.BUTTON_ROW_SPACING,
        // Stretched to the panels' width, so the buttons wrap at the column's edge.
        layoutOptions: { stretch: true },
        children: [copyButton, exportGraphButton, ...extraActions],
      }),
      ...footer,
    ],
  });

  return {
    node,
    fitModelComboBox,
    fitModelPopup,
    copyButton,
    exportGraphButton,
  };
}
