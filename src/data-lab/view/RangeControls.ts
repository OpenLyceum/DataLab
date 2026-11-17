/**
 * RangeControls.ts
 *
 * The four text fields that hold the selected range: x from and to, and the y
 * bounds of a rectangle selection. They are the exact, non-pointer path to the
 * same selection a drag on the graph makes.
 *
 * A field shows its bound rounded for reading. Only a field the student has
 * edited is read back: committing one bound must not replace the others with
 * their rounded text, which could move an edge off the data point it sits on.
 */

import { Multilink, type TReadOnlyProperty } from "scenerystack/axon";
import { DOM, HBox, type Node, Text } from "scenerystack/scenery";
import { parseNumber } from "../../common/model/Dataset.js";
import type { XRange } from "../../common/model/includedRows.js";
import DataLabColors from "../../DataLabColors.js";
import { FONTS, HTML_CONTROL_FONT, LAYOUT, RANGE_FIELD_WIDTH } from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";

const Y_FIELD_WIDTH = LAYOUT.Y_RANGE_FIELD_WIDTH;
const FIELD_DIGITS = LAYOUT.RANGE_FIELD_DIGITS;

/**
 * @param rectangleSelectionProperty - the y fields are shown while a rectangle selection is on,
 *   or while the range has y bounds (from a session file, say); otherwise they would be two
 *   unexplained empty boxes.
 */
export function createRangeControls(model: DataLabModel, rectangleSelectionProperty: TReadOnlyProperty<boolean>): Node {
  const labels = StringManager.getInstance().getLabels();
  const a11y = StringManager.getInstance().getDataLabA11yStrings();
  const textOptions = { font: FONTS.CONTROL, fill: DataLabColors.textColorProperty };

  /** A bound's field, the bound it shows, and whether its text is the student's. */
  type Field = { readonly input: HTMLInputElement; shown: number | null; edited: boolean };
  const createField = (
    accessibleName: typeof a11y.controls.rangeMinimumStringProperty,
    width: number = RANGE_FIELD_WIDTH,
  ): Field => {
    const input = document.createElement("input");
    const field: Field = { input, shown: null, edited: false };
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.style.cssText = `width: ${width}px; box-sizing: border-box; font: ${HTML_CONTROL_FONT}; padding: 3px 5px; text-align: right;`;
    accessibleName.link((name) => input.setAttribute("aria-label", name));
    input.addEventListener("input", () => {
      field.edited = true;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        input.blur();
      }
    });
    return field;
  };
  const minField = createField(a11y.controls.rangeMinimumStringProperty);
  const maxField = createField(a11y.controls.rangeMaximumStringProperty);
  const minYField = createField(labels.rectangleMinimumStringProperty, Y_FIELD_WIDTH);
  const maxYField = createField(labels.rectangleMaximumStringProperty, Y_FIELD_WIDTH);
  const fields = [minField, maxField, minYField, maxYField];

  /** The bound a field stands for: what was typed if it was edited, else the exact value it shows. */
  const boundOf = (field: Field): number | null => {
    if (!field.edited) {
      return field.shown;
    }
    const value = parseNumber(field.input.value, true);
    return Number.isFinite(value) ? value : null;
  };

  const show = (field: Field, value: number | null) => {
    field.shown = value;
    field.edited = false;
    field.input.value = value === null ? "" : String(Number(value.toPrecision(FIELD_DIGITS)));
  };
  const showRange = (range: XRange | null) => {
    show(minField, range?.min ?? null);
    show(maxField, range?.max ?? null);
    show(minYField, range?.y?.min ?? null);
    show(maxYField, range?.y?.max ?? null);
  };

  const commitRange = () => {
    const min = boundOf(minField);
    const max = boundOf(maxField);
    const yMin = boundOf(minYField);
    const yMax = boundOf(maxYField);
    const y = yMin !== null && yMax !== null ? { min: Math.min(yMin, yMax), max: Math.max(yMin, yMax) } : undefined;
    if (min === null && max === null && !y) {
      model.clearRange();
      return;
    }
    // An x bound left blank means "to the end of the data".
    const values = model.distinctXValues();
    model.setRange(min ?? values[0] ?? max ?? Number.NaN, max ?? values[values.length - 1] ?? min ?? Number.NaN, y);
    // Show what now holds: bounds typed in the wrong order come back swapped.
    showRange(model.rangeProperty.value);
  };
  for (const field of fields) {
    field.input.addEventListener("change", commitRange);
  }
  // A field being typed in keeps its text while a drag or another field changes the range.
  model.rangeProperty.link((range) => {
    const values = [range?.min ?? null, range?.max ?? null, range?.y?.min ?? null, range?.y?.max ?? null];
    fields.forEach((field, i) => {
      if (!(field.edited && field.input === document.activeElement)) {
        show(field, values[i] ?? null);
      }
    });
  });

  const unitText = new Text("", { ...textOptions, maxWidth: LAYOUT.RANGE_UNIT_MAX_WIDTH });
  model.xColumnProperty.link((column) => {
    unitText.string = column?.unit ?? "";
  });

  const yFields = new HBox({
    spacing: LAYOUT.BUTTON_ROW_SPACING,
    children: [
      new Text(labels.rectangleYStringProperty, { ...textOptions, maxWidth: LAYOUT.RANGE_Y_MAX_WIDTH }),
      new DOM(minYField.input, { allowInput: true }),
      new DOM(maxYField.input, { allowInput: true }),
    ],
  });
  Multilink.multilink([rectangleSelectionProperty, model.rangeProperty], (rectangle, range) => {
    yFields.visible = rectangle || range?.y !== undefined;
  });

  return new HBox({
    spacing: LAYOUT.BUTTON_ROW_SPACING,
    children: [
      new Text(labels.rangeFromStringProperty, { ...textOptions, maxWidth: LAYOUT.RANGE_FROM_MAX_WIDTH }),
      new DOM(minField.input, { allowInput: true }),
      new Text(labels.rangeToStringProperty, { ...textOptions, maxWidth: LAYOUT.RANGE_TO_MAX_WIDTH }),
      new DOM(maxField.input, { allowInput: true }),
      unitText,
      yFields,
    ],
  });
}
