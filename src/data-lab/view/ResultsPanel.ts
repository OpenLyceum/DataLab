/**
 * ResultsPanel.ts
 *
 * The fit written out: the model's equation, each parameter with its standard
 * error and unit, RMSE, R² and the number of points used — or, when there is no
 * fit, the reason in plain words.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { DataLabPanel } from "../../common/DataLabPanel.js";
import DataLabColors from "../../DataLabColors.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { FitText } from "./fitText.js";

const TITLE_FONT = new PhetFont({ size: 13, weight: "bold" });
const LINE_FONT = new PhetFont(13);
const NOTE_FONT = new PhetFont(11);
const LINE_SPACING = 5;

/** Most lines a fit produces: three parameters, RMSE, R², points used. */
const MAX_LINES = 6;

export class ResultsPanel extends DataLabPanel {
  public constructor(fitTextProperty: TReadOnlyProperty<FitText>, contentWidth: number) {
    const labels = StringManager.getInstance().getLabels();
    const textOptions = { fill: DataLabColors.textColorProperty, maxWidth: contentWidth };

    const title = new Text(labels.resultsStringProperty, { ...textOptions, font: TITLE_FONT });
    const equation = new Text("", { ...textOptions, font: LINE_FONT });
    const lines = Array.from({ length: MAX_LINES }, () => new Text("", { ...textOptions, font: LINE_FONT }));
    const caution = new Text("", { ...textOptions, font: NOTE_FONT, fill: DataLabColors.fitLineColorProperty });

    const content = new VBox({
      align: "left",
      spacing: LINE_SPACING,
      excludeInvisibleChildrenFromBounds: true,
      children: [title, equation, ...lines, caution],
    });
    super(content, { minWidth: contentWidth + 24, align: "left" });

    fitTextProperty.link((fitText) => {
      equation.string = fitText.equation;
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
