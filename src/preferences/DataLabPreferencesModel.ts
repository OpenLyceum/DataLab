/**
 * DataLabPreferencesModel.ts
 *
 * Model for the simulation-specific preferences shown in Preferences →
 * Simulation. Each preference Property takes its initial value from the
 * corresponding query parameter in dataLabQueryParameters.
 *
 * Remove the example preference (and its query parameter / UI control) if the
 * sim has no sim-specific preferences.
 */

import { BooleanProperty } from "scenerystack/axon";
import type { Tandem } from "scenerystack/tandem";
import DataLabNamespace from "../DataLabNamespace.js";
import dataLabQueryParameters from "./dataLabQueryParameters.js";

export class DataLabPreferencesModel {
  /** Whether the residual graph is shown; initial value comes from the `showResiduals` query parameter. */
  public readonly showResidualsProperty: BooleanProperty;

  public constructor(tandem?: Tandem) {
    this.showResidualsProperty = new BooleanProperty(
      dataLabQueryParameters.showResiduals,
      tandem ? { tandem: tandem.createTandem("showResidualsProperty") } : undefined,
    );
  }

  public reset(): void {
    this.showResidualsProperty.reset();
  }
}

DataLabNamespace.register("DataLabPreferencesModel", DataLabPreferencesModel);
