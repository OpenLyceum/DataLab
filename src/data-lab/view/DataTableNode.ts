/**
 * DataTableNode.ts
 *
 * The editable data table. It is real HTML — a <table> of <input> cells mounted
 * through Scenery's DOM node, as TrackLab's read-only table is — so typing,
 * selection, the clipboard, touch keyboards and screen readers behave natively.
 *
 * Editing: type in a cell and press Enter or leave it to commit; ↑/↓ and Enter move
 * between rows; Escape abandons the edit. Pasting a block copied from a spreadsheet
 * fills cells from the focused one, adding rows as needed. A header cell holds the
 * column's name and unit together, written "Time (s)".
 *
 * Rows the fit uses are tinted and carry a check mark in the first column, so
 * inclusion does not rest on color alone.
 */

import { Multilink } from "scenerystack/axon";
import { DOM, Node } from "scenerystack/scenery";
import { columnLabel, type Dataset } from "../../common/model/Dataset.js";
import { splitHeader, tokenize } from "../../common/model/parseTable.js";
import DataLabColors from "../../DataLabColors.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";
import { fillPattern } from "./fillPattern.js";

const FONT = "12px Arial, sans-serif";
const MIN_CELL_WIDTH = 86;

/** Room kept for the vertical scrollbar when sizing columns to fill the table. */
const SCROLLBAR_ALLOWANCE = 18;
const MARKER_WIDTH = 22;
const ROW_NUMBER_WIDTH = 30;
const CELL_PADDING = "3px 5px";
const CHECK_MARK = "✓";

/**
 * Rows drawn in the table. Every row is still plotted and fitted; a table this
 * long is not read row by row, and building more inputs would stall the page.
 */
const MAX_RENDERED_ROWS = 1000;

export type DataTableNodeOptions = {
  readonly width: number;
  readonly height: number;
};

export class DataTableNode extends Node {
  public constructor(model: DataLabModel, options: DataTableNodeOptions) {
    super();
    const labels = StringManager.getInstance().getLabels();
    const a11y = StringManager.getInstance().getDataLabA11yStrings();

    const wrapper = document.createElement("div");
    const table = document.createElement("table");
    const caption = document.createElement("caption");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(caption, thead, tbody);
    wrapper.appendChild(table);
    table.style.cssText = `border-collapse: collapse; font: ${FONT};`;
    caption.style.cssText =
      "position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;";

    let renderedRowCount = -1;
    let renderedColumnCount = -1;
    let headerInputs: HTMLInputElement[] = [];
    let cellInputs: HTMLInputElement[][] = [];
    let rows: HTMLTableRowElement[] = [];
    let markers: HTMLTableCellElement[] = [];

    const css = () => ({
      header: DataLabColors.tableHeaderBackgroundColorProperty.value.toCSS(),
      grid: DataLabColors.tableGridColorProperty.value.toCSS(),
      included: DataLabColors.tableIncludedRowColorProperty.value.toCSS(),
      invalid: DataLabColors.tableInvalidTextColorProperty.value.toCSS(),
      surface: DataLabColors.controlSurfaceColorProperty.value.toCSS(),
      text: DataLabColors.controlSurfaceTextColorProperty.value.toCSS(),
    });

    // Columns share the table's width; with many columns they keep a readable
    // minimum and the table scrolls sideways.
    let cellWidth = MIN_CELL_WIDTH;

    const styleInput = (input: HTMLInputElement, bold: boolean) => {
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.style.cssText = `width: ${cellWidth}px; box-sizing: border-box; border: none; background: transparent; font: ${FONT}; padding: ${CELL_PADDING}; text-align: ${bold ? "center" : "right"}; ${bold ? "font-weight: bold;" : ""}`;
    };

    const focusCell = (rowIndex: number, columnIndex: number) => {
      const input = cellInputs[rowIndex]?.[columnIndex];
      if (input) {
        input.focus();
        input.select();
      }
    };

    const build = (dataset: Dataset) => {
      const colors = css();
      const rowCount = Math.min(dataset.rowCount, MAX_RENDERED_ROWS);
      const available = options.width - MARKER_WIDTH - ROW_NUMBER_WIDTH - SCROLLBAR_ALLOWANCE;
      cellWidth = Math.max(MIN_CELL_WIDTH, Math.floor(available / Math.max(dataset.columns.length, 1)));
      wrapper.style.background = colors.surface;
      wrapper.style.border = `1px solid ${colors.grid}`;
      thead.replaceChildren();
      tbody.replaceChildren();
      headerInputs = [];
      cellInputs = [];
      rows = [];
      markers = [];

      const headerCellStyle = `position: sticky; top: 0; z-index: 1; background: ${colors.header}; color: ${colors.text}; border: 1px solid ${colors.grid}; padding: 0; font-weight: bold;`;
      const headerRow = document.createElement("tr");
      const markerHeader = document.createElement("th");
      markerHeader.textContent = CHECK_MARK;
      markerHeader.title = labels.inFitStringProperty.value;
      markerHeader.setAttribute("aria-label", labels.inFitStringProperty.value);
      markerHeader.scope = "col";
      markerHeader.style.cssText = `${headerCellStyle} width: ${MARKER_WIDTH}px;`;
      const numberHeader = document.createElement("th");
      numberHeader.textContent = "#";
      numberHeader.title = labels.rowStringProperty.value;
      numberHeader.setAttribute("aria-label", labels.rowStringProperty.value);
      numberHeader.scope = "col";
      numberHeader.style.cssText = `${headerCellStyle} width: ${ROW_NUMBER_WIDTH}px;`;
      headerRow.append(markerHeader, numberHeader);

      dataset.columns.forEach((_column, c) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.style.cssText = headerCellStyle;
        const input = document.createElement("input");
        styleInput(input, true);
        input.style.color = colors.text;
        input.setAttribute(
          "aria-label",
          fillPattern(a11y.controls.columnHeaderStringProperty.value, { position: c + 1 }),
        );
        input.addEventListener("change", () => {
          const { name, unit } = splitHeader(input.value);
          model.setColumnHeader(c, name, unit);
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            input.blur();
          }
        });
        headerInputs.push(input);
        th.appendChild(input);
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);

      const cellStyle = `border: 1px solid ${colors.grid}; padding: 0;`;
      for (let r = 0; r < rowCount; r++) {
        const tr = document.createElement("tr");
        const marker = document.createElement("td");
        marker.style.cssText = `${cellStyle} text-align: center; color: ${colors.text};`;
        const number = document.createElement("th");
        number.scope = "row";
        number.textContent = String(r + 1);
        number.style.cssText = `${cellStyle} text-align: right; padding: ${CELL_PADDING}; font-weight: normal; color: ${colors.text}; background: ${colors.header};`;
        tr.append(marker, number);
        const rowInputs: HTMLInputElement[] = [];
        dataset.columns.forEach((_column, c) => {
          const td = document.createElement("td");
          td.style.cssText = cellStyle;
          const input = document.createElement("input");
          styleInput(input, false);
          input.inputMode = "decimal";
          input.addEventListener("change", () => model.setCell(r, c, input.value.trim()));
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === "ArrowDown") {
              event.preventDefault();
              input.blur();
              focusCell(Math.min(r + 1, rowCount - 1), c);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              input.blur();
              focusCell(Math.max(r - 1, 0), c);
            } else if (event.key === "Escape") {
              input.value = model.datasetProperty.value.columns[c]?.texts[r] ?? "";
              input.blur();
            }
          });
          input.addEventListener("paste", (event) => {
            const text = event.clipboardData?.getData("text/plain") ?? "";
            // A single value pastes into the cell as usual; a block fills the table.
            if (/[\t\n]/.test(text.trim())) {
              event.preventDefault();
              const block = tokenize(text.replace(/\r\n?/g, "\n").replace(/\n+$/, ""), "\t");
              model.pasteBlock(r, c, block);
              focusCell(r, c);
            }
          });
          rowInputs.push(input);
          td.appendChild(input);
          tr.appendChild(td);
        });
        cellInputs.push(rowInputs);
        rows.push(tr);
        markers.push(marker);
        tbody.appendChild(tr);
      }
      renderedRowCount = dataset.rowCount;
      renderedColumnCount = dataset.columns.length;
    };

    /** Writes the model's text into the inputs, leaving the one being typed in alone. */
    const fill = (dataset: Dataset) => {
      const colors = css();
      caption.textContent = a11y.controls.dataTableStringProperty.value;
      dataset.columns.forEach((column, c) => {
        const header = headerInputs[c];
        if (header && header !== document.activeElement) {
          header.value = columnLabel(column);
        }
        cellInputs.forEach((rowInputs, r) => {
          const input = rowInputs[c];
          if (!input) {
            return;
          }
          const text = column.texts[r] ?? "";
          if (input !== document.activeElement && input.value !== text) {
            input.value = text;
          }
          const isInvalid = text !== "" && !Number.isFinite(column.values[r]);
          input.style.color = isInvalid ? colors.invalid : colors.text;
          input.setAttribute(
            "aria-label",
            fillPattern(a11y.controls.cellStringProperty.value, { column: columnLabel(column), row: r + 1 }),
          );
          input.setAttribute("aria-invalid", String(isInvalid));
        });
      });
    };

    const markIncluded = () => {
      const colors = css();
      const flags = model.inclusionProperty.value.flags;
      rows.forEach((tr, r) => {
        const included = flags[r] === true;
        tr.style.background = included ? colors.included : "transparent";
        (markers[r] as HTMLTableCellElement).textContent = included ? CHECK_MARK : "";
      });
    };

    wrapper.style.cssText = `width: ${options.width}px; height: ${options.height}px; overflow: auto; box-sizing: border-box; border-radius: 3px;`;

    const domNode = new DOM(wrapper, { allowInput: true });
    this.addChild(domNode);

    const refresh = () => {
      const dataset = model.datasetProperty.value;
      if (dataset.rowCount !== renderedRowCount || dataset.columns.length !== renderedColumnCount) {
        build(dataset);
      }
      fill(dataset);
      markIncluded();
      domNode.invalidateDOM();
    };
    const rebuild = () => {
      renderedRowCount = -1;
      refresh();
    };

    model.datasetProperty.link(refresh);
    model.inclusionProperty.lazyLink(markIncluded);
    // Colors and words are baked into the DOM, so a new profile or language rebuilds it.
    Multilink.lazyMultilink(
      [
        DataLabColors.tableHeaderBackgroundColorProperty,
        DataLabColors.tableIncludedRowColorProperty,
        labels.inFitStringProperty,
        labels.rowStringProperty,
        a11y.controls.dataTableStringProperty,
        a11y.controls.cellStringProperty,
        a11y.controls.columnHeaderStringProperty,
      ],
      rebuild,
    );
  }
}
