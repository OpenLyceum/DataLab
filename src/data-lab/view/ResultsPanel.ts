/**
 * ResultsPanel.ts
 *
 * The fit written out: the model's equation, each parameter with its standard
 * error and unit, RMSE, R² and the number of points used — or, when there is no
 * fit, the reason in plain words.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { RichText, Text, VBox } from "scenerystack/scenery";
import { DataLabPanel } from "../../common/DataLabPanel.js";
import { MODEL_SYMBOLS } from "../../common/model/formatFit.js";
import DataLabColors from "../../DataLabColors.js";
import { FONTS, PANEL, RESULTS } from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import { escapeMarkup } from "./escapeMarkup.js";
import type { FitText } from "./fitText.js";

/** Parameters plus RMSE, a goodness-of-fit statistic, and points used. */
const MAX_LINES = Math.max(...Object.values(MODEL_SYMBOLS).map((symbols) => symbols.length)) + 3;

export class ResultsPanel extends DataLabPanel {
  public constructor(fitTextProperty: TReadOnlyProperty<FitText>, contentWidth: number) {
    const labels = StringManager.getInstance().getLabels();
    const textOptions = { fill: DataLabColors.textColorProperty, maxWidth: contentWidth };

    const title = new Text(labels.resultsStringProperty, { ...textOptions, font: FONTS.RESULTS_TITLE });
    // A long equation (a damped sine, say) wraps at a space rather than shrinking out of reach.
    const equation = new RichText("", {
      fill: DataLabColors.textColorProperty,
      font: FONTS.RESULTS_LINE,
      lineWrap: contentWidth,
    });
    const lines = Array.from({ length: MAX_LINES }, () => new Text("", { ...textOptions, font: FONTS.RESULTS_LINE }));
    const caution = new Text("", {
      ...textOptions,
      font: FONTS.NOTE,
      fill: DataLabColors.fitLineColorProperty,
    });

    const content = new VBox({
      align: "left",
      spacing: RESULTS.LINE_SPACING,
      excludeInvisibleChildrenFromBounds: true,
      children: [title, equation, ...lines, caution],
    });
    super(content, { minWidth: contentWidth + PANEL.CONTENT_WIDTH_INSET, align: "left" });

    fitTextProperty.link((fitText) => {
      equation.string = escapeMarkup(fitText.equation);
      lines.forEach((line, i) => {
        const string = fitText.lines[i];
        line.visible = string !== undefined;
        line.string = string ?? "";
      });
      caution.visible = fitText.caution !== "";
      caution.string = fitText.caution;
    });
  }
}
