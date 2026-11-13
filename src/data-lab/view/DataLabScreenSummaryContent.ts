/**
 * DataLabScreenSummaryContent.ts
 *
 * The accessible screen summary read by screen readers. Its "current details"
 * paragraph is live: it restates which rows the fit is using and which model is
 * fitted, in the same words as the status line under the graphs.
 */
import { DerivedProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import { fillPattern } from "./fillPattern.js";
import type { FitText } from "./fitText.js";

export class DataLabScreenSummaryContent extends ScreenSummaryContent {
  public constructor(fitTextProperty: TReadOnlyProperty<FitText>) {
    const a11y = StringManager.getInstance().getDataLabA11yStrings();

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: new DerivedProperty(
        [fitTextProperty, a11y.currentDetailsStringProperty],
        (fitText, pattern) => fillPattern(pattern, { status: `${fitText.status}.`, model: fitText.modelName }),
      ),
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
