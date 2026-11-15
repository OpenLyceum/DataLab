import type { TReadOnlyProperty } from "scenerystack/axon";
import { TextPushButton, type TextPushButtonOptions } from "scenerystack/sun";
import { FLAT_PANEL_PUSH_BUTTON_OPTIONS, LIGHT_SURFACE_TEXT_FILL } from "../../common/DataLabButtonOptions.js";
import { FONTS, LAYOUT } from "../../DataLabConstants.js";

/** The flat text button used throughout the screen. */
export function createTextButton(
  string: TReadOnlyProperty<string> | string,
  listener: () => void,
  options?: TextPushButtonOptions,
): TextPushButton {
  return new TextPushButton(string, {
    ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
    font: FONTS.CONTROL,
    textFill: LIGHT_SURFACE_TEXT_FILL,
    maxTextWidth: LAYOUT.BUTTON_MAX_TEXT_WIDTH,
    xMargin: LAYOUT.BUTTON_X_MARGIN,
    yMargin: LAYOUT.BUTTON_Y_MARGIN,
    listener,
    ...options,
  });
}
