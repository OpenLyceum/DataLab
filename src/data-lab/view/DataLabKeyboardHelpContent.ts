/**
 * DataLabKeyboardHelpContent.ts
 *
 * Content for the keyboard-help dialog (the "?" button in the navigation bar).
 * The left column documents exactly the keys PlotNode binds on the two edges of
 * the selected range; the right column is the standard button and radio-button help.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { HotkeyData, type OneKeyStroke } from "scenerystack/scenery";
import {
  BasicActionsKeyboardHelpSection,
  KeyboardHelpSection,
  KeyboardHelpSectionRow,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";

export class DataLabKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    const strings = StringManager.getInstance().getDataLabA11yStrings().keyboardHelp;

    const row = (keys: OneKeyStroke[], label: TReadOnlyProperty<string>) =>
      KeyboardHelpSectionRow.fromHotkeyData(
        new HotkeyData({ keys, repoName: "data-lab", keyboardHelpDialogLabelStringProperty: label }),
      );

    const rangeSection = new KeyboardHelpSection(strings.rangeHeadingStringProperty, [
      row(["arrowLeft", "arrowRight"], strings.moveToPointStringProperty),
      row(["shift+arrowLeft", "shift+arrowRight"], strings.moveFineStringProperty),
      row(["pageUp", "pageDown"], strings.moveTenPointsStringProperty),
      row(["home", "end"], strings.moveToEndsStringProperty),
    ]);

    super([rangeSection], [new BasicActionsKeyboardHelpSection()]);
  }
}
