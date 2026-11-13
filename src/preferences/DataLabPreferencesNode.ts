/**
 * DataLabPreferencesNode.ts
 *
 * Custom preferences UI shown in Preferences → Simulation. Controls are bound
 * to DataLabPreferencesModel Properties (whose initial values come from
 * dataLabQueryParameters).
 */

import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox } from "scenerystack/sun";
import type { Tandem } from "scenerystack/tandem";
import DataLabColors from "../DataLabColors.js";
import DataLabNamespace from "../DataLabNamespace.js";
import { StringManager } from "../i18n/StringManager.js";
import type { DataLabPreferencesModel } from "./DataLabPreferencesModel.js";

export class DataLabPreferencesNode extends VBox {
  public constructor(preferencesModel: DataLabPreferencesModel, tandem?: Tandem) {
    const prefStrings = StringManager.getInstance().getPreferences();

    // The Preferences dialog is always white, so use the dark "light control surface"
    // colors (readable on white in both default and projector profiles), not textColorProperty
    // (which is near-white in default mode and would be invisible on the white dialog).
    const header = new Text(prefStrings.titleStringProperty, {
      font: new PhetFont({ size: 18, weight: "bold" }),
      fill: DataLabColors.controlSurfaceTextColorProperty,
    });

    const showResidualsCheckbox = new Checkbox(
      preferencesModel.showResidualsProperty,
      new Text(prefStrings.showResidualsStringProperty, {
        font: new PhetFont(14),
        fill: DataLabColors.controlSurfaceTextColorProperty,
      }),
      {
        checkboxColor: DataLabColors.controlSurfaceTextColorProperty,
        checkboxColorBackground: DataLabColors.controlSurfaceColorProperty,
        spacing: 8,
        ...(tandem && { tandem: tandem.createTandem("showResidualsCheckbox") }),
      },
    );

    super({
      align: "left",
      spacing: 12,
      children: [header, showResidualsCheckbox],
    });
  }
}

DataLabNamespace.register("DataLabPreferencesNode", DataLabPreferencesNode);
