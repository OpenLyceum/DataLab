import type { TReadOnlyProperty } from "scenerystack/axon";
import { HBox, type Node, Text } from "scenerystack/scenery";
import { RectangularPushButton, type RectangularPushButtonOptions } from "scenerystack/sun";
import { FLAT_PANEL_PUSH_BUTTON_OPTIONS, LIGHT_SURFACE_TEXT_FILL } from "../../common/DataLabButtonOptions.js";
import { FONTS, LAYOUT } from "../../DataLabConstants.js";
import { ButtonTooltip } from "./ButtonTooltip.js";

export type IconButtonOptions = RectangularPushButtonOptions & {
  /** A short word shown beside the icon, for when the icon alone is ambiguous (a file format, a brand). */
  caption?: TReadOnlyProperty<string> | string;
};

/**
 * The flat button used throughout the screen: an icon, sometimes with a one-word
 * caption. `name` is what a screen reader announces and what the tooltip shows.
 */
export function createIconButton(
  icon: Node,
  name: TReadOnlyProperty<string>,
  listener: () => void,
  options?: IconButtonOptions,
): RectangularPushButton {
  const { caption, ...buttonOptions } = options ?? {};
  const content = caption
    ? new HBox({
        spacing: LAYOUT.ICON_CAPTION_SPACING,
        children: [
          icon,
          new Text(caption, {
            font: FONTS.CONTROL,
            fill: LIGHT_SURFACE_TEXT_FILL,
            maxWidth: LAYOUT.BUTTON_MAX_TEXT_WIDTH,
          }),
        ],
      })
    : icon;
  const button = new RectangularPushButton({
    ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
    content,
    xMargin: LAYOUT.BUTTON_X_MARGIN,
    yMargin: LAYOUT.BUTTON_Y_MARGIN,
    accessibleName: name,
    listener,
    ...buttonOptions,
  });
  ButtonTooltip.attach(button, name);
  return button;
}
