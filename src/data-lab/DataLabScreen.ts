/**
 * DataLabScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createDataLabIcon() in src/common/DataLabScreenIcons.ts.
 */
import { optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createDataLabIcon } from "../common/DataLabScreenIcons.js";
import DataLabColors from "../DataLabColors.js";
import type { DataLabPreferencesModel } from "../preferences/DataLabPreferencesModel.js";
import { DataLabModel } from "./model/DataLabModel.js";
import { DataLabKeyboardHelpContent } from "./view/DataLabKeyboardHelpContent.js";
import { DataLabScreenView } from "./view/DataLabScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type SelfOptions = { preferences: DataLabPreferencesModel };
type DataLabScreenOptions = SelfOptions & ScreenOptions & { tandem: Tandem };

export class DataLabScreen extends Screen<DataLabModel, DataLabScreenView> {
  public constructor(options: DataLabScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new DataLabModel(),
      // View factory — receives the model instance
      (model) =>
        new DataLabScreenView(model, options.preferences, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<DataLabScreenOptions, SelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: DataLabColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new DataLabKeyboardHelpContent(),
          homeScreenIcon: createDataLabIcon(),
          navigationBarIcon: createDataLabIcon(),
        },
        options,
      ),
    );
  }
}
