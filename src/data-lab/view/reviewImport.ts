/**
 * reviewImport.ts
 *
 * The import dialog: how a file was read — separator, decimal mark, lines skipped
 * above the table, header and units rows — with a preview of the result, so a
 * student can correct a guess before the table is replaced.
 *
 * It is shown only when the automatic reading looks doubtful; a clean table goes
 * straight in.
 */

import { columnLabel, type Dataset, isNumericColumn } from "../../common/model/Dataset.js";
import { type Delimiter, type ParseOptions, parseTable } from "../../common/model/parseTable.js";
import { openDialog } from "../../common/view/openDialog.js";
import { IMPORT } from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";

/** A reading is doubtful when a column came out with no numbers in it at all. */
export function isDoubtfulImport(dataset: Dataset): boolean {
  return dataset.rowCount > 0 && dataset.columns.some((column) => !isNumericColumn(column));
}

const AUTOMATIC = "auto";

export function reviewImport(
  text: string,
  defaultColumnName: (position: number) => string,
  onImport: (dataset: Dataset) => void,
): void {
  const labels = StringManager.getInstance().getLabels();
  const { body, button, close, show } = openDialog(labels.importOptionsStringProperty.value, {
    maxWidth: "min(92vw, 40rem)",
  });
  const note = document.createElement("p");
  note.style.margin = "0";
  note.textContent = labels.importHelpStringProperty.value;
  const form = document.createElement("div");
  form.style.cssText = "display: grid; grid-template-columns: auto 1fr; gap: 0.4em 0.8em; align-items: center;";
  body.append(note, form);

  const row = <T extends HTMLElement>(name: string, control: T): T => {
    const label = document.createElement("label");
    label.textContent = name;
    const id = `data-lab-import-${form.childElementCount}`;
    control.id = id;
    label.htmlFor = id;
    control.style.font = "inherit";
    control.style.justifySelf = "start";
    form.append(label, control);
    return control;
  };
  const select = (name: string, choices: readonly (readonly [value: string, label: string])[]) => {
    const control = row(name, document.createElement("select"));
    control.append(...choices.map(([value, label]) => new Option(label, value)));
    return control;
  };
  const checkbox = (name: string) => {
    const control = row(name, document.createElement("input"));
    control.type = "checkbox";
    return control;
  };

  const delimiter = select(labels.importDelimiterStringProperty.value, [
    [AUTOMATIC, labels.importAutomaticStringProperty.value],
    [",", labels.importCommaStringProperty.value],
    ["\t", labels.importTabStringProperty.value],
    [";", labels.importSemicolonStringProperty.value],
    [" ", labels.importSpacesStringProperty.value],
  ]);
  const decimal = select(labels.importDecimalStringProperty.value, [
    [AUTOMATIC, labels.importAutomaticStringProperty.value],
    ["point", labels.importPointStringProperty.value],
    ["comma", labels.importDecimalCommaStringProperty.value],
  ]);
  const skipped = row(labels.importSkipStringProperty.value, document.createElement("input"));
  skipped.type = "number";
  skipped.min = "0";
  skipped.step = "1";
  skipped.style.width = "5em";
  const header = checkbox(labels.importHeaderStringProperty.value);
  const units = checkbox(labels.importUnitsStringProperty.value);

  const previewTitle = document.createElement("strong");
  previewTitle.textContent = labels.importPreviewStringProperty.value;
  const scroller = document.createElement("div");
  scroller.style.cssText = "overflow: auto; max-height: 14em;";
  const preview = document.createElement("table");
  preview.style.cssText = "border-collapse: collapse; font-size: 0.85em;";
  scroller.append(preview);
  body.append(previewTitle, scroller);

  // The first reading is fully automatic; its guesses fill the controls, and from
  // then on each control is an instruction.
  let parsed = parseTable(text, { defaultColumnName });
  skipped.value = String(parsed.skippedLines);
  header.checked = parsed.hasHeader;
  units.checked = parsed.hasUnitsRow;

  const draw = () => {
    const cell = (tag: "th" | "td", content: string, valid = true) => {
      const element = document.createElement(tag);
      element.textContent = content;
      element.style.cssText = `border: 1px solid currentColor; padding: 2px 6px; text-align: ${tag === "th" ? "center" : "right"}; ${valid ? "" : "opacity: 0.55; font-style: italic;"}`;
      return element;
    };
    const { dataset } = parsed;
    const head = document.createElement("tr");
    head.append(...dataset.columns.map((column) => cell("th", columnLabel(column))));
    const rows = Array.from({ length: Math.min(dataset.rowCount, IMPORT.PREVIEW_ROWS) }, (_, r) => {
      const tr = document.createElement("tr");
      tr.append(
        ...dataset.columns.map((column) => cell("td", column.texts[r] ?? "", Number.isFinite(column.values[r]))),
      );
      return tr;
    });
    preview.replaceChildren(head, ...rows);
    importButton.disabled = dataset.columns.length === 0 || dataset.rowCount === 0;
  };
  const reread = () => {
    const options: { -readonly [K in keyof ParseOptions]: ParseOptions[K] } = {
      defaultColumnName,
      skippedLines: Math.max(0, Math.floor(Number(skipped.value) || 0)),
      hasHeader: header.checked,
      hasUnitsRow: units.checked,
    };
    if (delimiter.value !== AUTOMATIC) {
      options.delimiter = delimiter.value as Delimiter;
    }
    if (decimal.value !== AUTOMATIC) {
      options.decimalComma = decimal.value === "comma";
    }
    parsed = parseTable(text, options);
    draw();
  };
  for (const control of [delimiter, decimal, skipped, header, units]) {
    control.addEventListener("change", reread);
  }

  const importButton = button(labels.importConfirmStringProperty.value, () => {
    onImport(parsed.dataset);
    close();
  });
  button(labels.cancelFormulaStringProperty.value, close);
  draw();
  show();
  importButton.focus();
}
