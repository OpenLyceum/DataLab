/**
 * DataLabPanel.ts
 *
 * A pre-themed Panel that automatically uses DataLabColors for background and
 * border. Use this for all control panels and info boxes in the sim so that
 * default / projector mode switching is handled automatically.
 *
 * ── Basic usage ───────────────────────────────────────────────────────────────
 *
 *   import { DataLabPanel } from "../../common/DataLabPanel.js";
 *   import { VBox, Text } from "scenerystack/scenery";
 *
 *   const content = new VBox({
 *     children: [ new Text("label"), slider ],
 *     spacing: 8,
 *   });
 *   const panel = new DataLabPanel(content);
 *
 * ── Overriding defaults ───────────────────────────────────────────────────────
 *
 *   // Wider margins, sharper corners, custom stroke
 *   const panel = new DataLabPanel(content, { xMargin: 20, cornerRadius: 0 });
 *
 *   // Transparent background (decorative border only)
 *   const panel = new DataLabPanel(content, { fill: "transparent" });
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { Node } from "scenerystack/scenery";
import { Panel, type PanelOptions } from "scenerystack/sun";
import DataLabColors from "../DataLabColors.js";
import { PANEL_CORNER_RADIUS } from "../DataLabConstants.js";

export type DataLabPanelOptions = PanelOptions;

export class DataLabPanel extends Panel {
  public constructor(content: Node, providedOptions?: DataLabPanelOptions) {
    const options = optionize<DataLabPanelOptions, EmptySelfOptions, PanelOptions>()(
      {
        fill: DataLabColors.panelBackgroundColorProperty,
        stroke: DataLabColors.panelBorderColorProperty,
        cornerRadius: PANEL_CORNER_RADIUS,
        xMargin: 12,
        yMargin: 10,
      },
      providedOptions,
    );
    super(content, options);
  }
}
