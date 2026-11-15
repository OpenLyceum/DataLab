/**
 * DataLabScreenIcons.ts
 *
 * Programmatic home-screen / navigation-bar icons for each screen.
 * Drawn on the standard PhET 548 × 373 canvas using DataLabColors.
 * Replace the stub backgrounds with screen-specific motifs.
 */
import { Node, Rectangle } from "scenerystack/scenery";
import { ScreenIcon } from "scenerystack/sim";
import DataLabColors from "../DataLabColors.js";
import { SCREEN_ICONS } from "../DataLabConstants.js";

function background(): Rectangle {
  return new Rectangle(0, 0, SCREEN_ICONS.WIDTH, SCREEN_ICONS.HEIGHT, {
    fill: DataLabColors.backgroundColorProperty,
  });
}

function iconFrom(content: Node): ScreenIcon {
  return new ScreenIcon(content, {
    maxIconWidthProportion: 1,
    maxIconHeightProportion: 1,
    fill: DataLabColors.backgroundColorProperty,
  });
}

export function createDataLabIcon(): ScreenIcon {
  return iconFrom(
    new Node({
      children: [background()],
    }),
  );
}
