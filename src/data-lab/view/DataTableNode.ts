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
 *
 * A long table is shown a page of rows at a time, with a line under it saying
 * which rows are on show; every row is plotted and fitted whether shown or not.
 * Pressing Enter in the last row adds a row, so a column can be typed in one go.
 */

import { Multilink } from "scenerystack/axon";
import { DOM, Node } from "scenerystack/scenery";
import { canDeleteColumn, columnLabel, type Dataset } from "../../common/model/Dataset.js";
import { splitHeader, tokenize } from "../../common/model/parseTable.js";
import DataLabColors from "../../DataLabColors.js";
import { TABLE } from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";
import { editCalculatedColumn } from "./editCalculatedColumn.js";
import { fillPattern } from "./fillPattern.js";

const CHECK_MARK = "✓";

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
    const scroller = document.createElement("div");
    const pager = document.createElement("div");
    const pageText = document.createElement("span");
    const table = document.createElement("table");
    const caption = document.createElement("caption");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(caption, thead, tbody);
    scroller.appendChild(table);
    wrapper.append(scroller, pager);
    table.style.cssText = `border-collapse: collapse; font: ${TABLE.FONT};`;
    caption.style.cssText =
      "position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;";

    let renderedRowCount = -1;
    let renderedColumnCount = -1;
    /** Index of the first row on show. The arrays of row elements below start there. */
    let pageStart = 0;
    let renderedPageStart = -1;
    let formulaButtons = new Map<number, HTMLButtonElement>();
    let removeColumns: HTMLButtonElement[] = [];
    let headerInputs: HTMLInputElement[] = [];
    let cellInputs: HTMLInputElement[][] = [];
    let rows: HTMLTableRowElement[] = [];
    let markers: HTMLTableCellElement[] = [];
    let exclusionInputs: HTMLInputElement[] = [];

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
    let cellWidth: number = TABLE.MIN_CELL_WIDTH;

    const styleInput = (input: HTMLInputElement, bold: boolean) => {
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.style.cssText = `width: ${cellWidth}px; box-sizing: border-box; border: none; background: transparent; font: ${TABLE.FONT}; padding: ${TABLE.CELL_PADDING}; text-align: ${bold ? "center" : "right"}; ${bold ? "font-weight: bold;" : ""}`;
    };

    const pageOf = (rowIndex: number) => Math.floor(rowIndex / TABLE.ROWS_PER_PAGE) * TABLE.ROWS_PER_PAGE;
    const showPage = (start: number) => {
      pageStart = Math.max(0, start);
      refresh();
      scroller.scrollTop = 0;
    };
    const focusCell = (rowIndex: number, columnIndex: number) => {
      if (pageOf(rowIndex) !== pageStart) {
        showPage(pageOf(rowIndex));
      }
      const input = cellInputs[rowIndex - pageStart]?.[columnIndex];
      if (input) {
        input.focus();
        input.select();
      }
    };

    const removeButton = (name: string, action: () => void) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "×";
      button.title = name;
      button.setAttribute("aria-label", name);
      button.style.cssText = `min-width: ${TABLE.REMOVE_BUTTON_WIDTH}px; font: ${TABLE.FONT};`;
      button.addEventListener("click", action);
      return button;
    };

    const build = (dataset: Dataset) => {
      const colors = css();
      const pageEnd = Math.min(dataset.rowCount, pageStart + TABLE.ROWS_PER_PAGE);
      const available =
        options.width -
        TABLE.MARKER_WIDTH -
        TABLE.ROW_NUMBER_WIDTH -
        TABLE.REMOVE_BUTTON_WIDTH -
        TABLE.EXCLUSION_WIDTH -
        TABLE.SCROLLBAR_ALLOWANCE;
      cellWidth = Math.max(
        TABLE.MIN_CELL_WIDTH,
        Math.floor(available / Math.max(dataset.columns.length, 1)) - TABLE.REMOVE_BUTTON_WIDTH,
      );
      wrapper.style.background = colors.surface;
      wrapper.style.border = `1px solid ${colors.grid}`;
      thead.replaceChildren();
      tbody.replaceChildren();
      headerInputs = [];
      removeColumns = [];
      formulaButtons = new Map();
      cellInputs = [];
      rows = [];
      markers = [];
      exclusionInputs = [];

      const headerCellStyle = `position: sticky; top: 0; z-index: 1; background: ${colors.header}; color: ${colors.text}; border: 1px solid ${colors.grid}; padding: 0; font-weight: bold;`;
      const headerRow = document.createElement("tr");
      const markerHeader = document.createElement("th");
      markerHeader.textContent = CHECK_MARK;
      markerHeader.title = labels.inFitStringProperty.value;
      markerHeader.setAttribute("aria-label", labels.inFitStringProperty.value);
      markerHeader.scope = "col";
      markerHeader.style.cssText = `${headerCellStyle} width: ${TABLE.MARKER_WIDTH}px;`;
      const numberHeader = document.createElement("th");
      numberHeader.textContent = "#";
      numberHeader.title = labels.rowStringProperty.value;
      numberHeader.setAttribute("aria-label", labels.rowStringProperty.value);
      numberHeader.scope = "col";
      numberHeader.style.cssText = `${headerCellStyle} width: ${TABLE.ROW_NUMBER_WIDTH}px;`;
      const actionsHeader = document.createElement("th");
      actionsHeader.scope = "col";
      actionsHeader.style.cssText = headerCellStyle;
      actionsHeader.setAttribute("aria-label", labels.deleteRowStringProperty.value);
      const exclusionHeader = document.createElement("th");
      exclusionHeader.scope = "col";
      exclusionHeader.style.cssText = `${headerCellStyle} min-width: ${TABLE.EXCLUSION_WIDTH}px;`;
      exclusionHeader.textContent = labels.excludeStringProperty.value;
      headerRow.append(markerHeader, numberHeader, actionsHeader, exclusionHeader);

      dataset.columns.forEach((column, c) => {
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
        th.style.whiteSpace = "nowrap";
        const remove = removeButton(
          fillPattern(a11y.controls.deleteColumnStringProperty.value, { position: c + 1 }),
          () => {
            // Read the current size after the synchronous rebuild and keep focus in the table.
            model.deleteColumn(c);
            headerInputs[Math.min(c, headerInputs.length - 1)]?.focus();
          },
        );
        removeColumns.push(remove);
        th.append(input, remove);
        if (column.formula !== undefined) {
          const edit = document.createElement("button");
          edit.type = "button";
          edit.textContent = "ƒx";
          edit.title = labels.editFormulaStringProperty.value;
          formulaButtons.set(c, edit);
          edit.addEventListener("click", () => editCalculatedColumn(model, c));
          th.append(edit);
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);

      const cellStyle = `border: 1px solid ${colors.grid}; padding: 0;`;
      for (let r = pageStart; r < pageEnd; r++) {
        const tr = document.createElement("tr");
        const marker = document.createElement("td");
        marker.style.cssText = `${cellStyle} text-align: center; color: ${colors.text};`;
        const number = document.createElement("th");
        number.scope = "row";
        number.textContent = String(r + 1);
        number.style.cssText = `${cellStyle} text-align: right; padding: ${TABLE.CELL_PADDING}; font-weight: normal; color: ${colors.text}; background: ${colors.header};`;
        const actions = document.createElement("td");
        actions.style.cssText = cellStyle;
        actions.appendChild(
          removeButton(fillPattern(a11y.controls.deleteRowStringProperty.value, { row: r + 1 }), () => {
            model.deleteRow(r);
            const remaining = model.datasetProperty.value.rowCount;
            if (remaining === 0) {
              headerInputs[0]?.focus();
            } else {
              focusCell(Math.min(r, remaining - 1), 0);
            }
          }),
        );
        const exclusion = document.createElement("td");
        exclusion.style.cssText = `${cellStyle} text-align: center;`;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("aria-label", fillPattern(a11y.controls.excludeRowStringProperty.value, { row: r + 1 }));
        checkbox.addEventListener("change", () => model.setRowExcluded(r, checkbox.checked));
        exclusion.appendChild(checkbox);
        exclusionInputs.push(checkbox);
        tr.append(marker, number, actions, exclusion);
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
              // Enter in the last row carries on into a new one.
              if (event.key === "Enter" && r === model.datasetProperty.value.rowCount - 1) {
                model.addRow();
              }
              focusCell(Math.min(r + 1, model.datasetProperty.value.rowCount - 1), c);
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
            if (!input.readOnly && /[\t\n]/.test(text.trim())) {
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
      renderedPageStart = pageStart;
    };

    /** Writes the model's text into the inputs, leaving the one being typed in alone. */
    const fill = (dataset: Dataset) => {
      const colors = css();
      const excluded = new Set(dataset.excludedRows);
      exclusionInputs.forEach((input, index) => {
        input.checked = excluded.has(pageStart + index);
      });
      pager.style.display = dataset.rowCount > TABLE.ROWS_PER_PAGE ? "flex" : "none";
      pager.style.color = colors.text;
      pager.style.borderTop = `1px solid ${colors.grid}`;
      pageText.textContent = fillPattern(labels.tableRowsStringProperty.value, {
        first: pageStart + 1,
        last: pageStart + cellInputs.length,
        total: dataset.rowCount,
      });
      previousPage.disabled = pageStart === 0;
      nextPage.disabled = pageStart + TABLE.ROWS_PER_PAGE >= dataset.rowCount;
      previousPage.setAttribute("aria-label", labels.previousRowsStringProperty.value);
      nextPage.setAttribute("aria-label", labels.nextRowsStringProperty.value);
      caption.textContent = a11y.controls.dataTableStringProperty.value;
      dataset.columns.forEach((column, c) => {
        formulaButtons
          .get(c)
          ?.setAttribute("aria-label", `${labels.editFormulaStringProperty.value} · ${columnLabel(column)}`);
        const remove = removeColumns[c];
        if (remove) {
          const blocked = !canDeleteColumn(dataset, c);
          remove.disabled = blocked || dataset.columns.length === 1;
          remove.title = blocked
            ? labels.formulaDependencyStringProperty.value
            : (remove.getAttribute("aria-label") ?? "");
        }
        const header = headerInputs[c];
        if (header && header !== document.activeElement) {
          header.value = columnLabel(column);
        }
        cellInputs.forEach((rowInputs, index) => {
          const r = pageStart + index;
          const input = rowInputs[c];
          if (!input) {
            return;
          }
          const text = column.texts[r] ?? "";
          input.readOnly = column.formula !== undefined;
          if ((input.readOnly || input !== document.activeElement) && input.value !== text) {
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
      rows.forEach((tr, index) => {
        const included = flags[pageStart + index] === true;
        tr.style.background = included ? colors.included : "transparent";
        (markers[index] as HTMLTableCellElement).textContent = included ? CHECK_MARK : "";
      });
    };

    wrapper.style.cssText = `width: ${options.width}px; height: ${options.height}px; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box; border-radius: 3px;`;
    scroller.style.cssText = "flex: 1 1 auto; overflow: auto; min-height: 0;";
    pager.style.cssText = `flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 6px; padding: 2px 4px; font: ${TABLE.FONT};`;
    const pageButton = (text: string, step: number) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.style.font = TABLE.FONT;
      button.addEventListener("click", () => showPage(pageStart + step * TABLE.ROWS_PER_PAGE));
      return button;
    };
    const previousPage = pageButton("◀", -1);
    const nextPage = pageButton("▶", 1);
    pageText.setAttribute("role", "status");
    pager.append(previousPage, pageText, nextPage);

    const domNode = new DOM(wrapper, { allowInput: true });
    this.addChild(domNode);

    const refresh = () => {
      const dataset = model.datasetProperty.value;
      // Deleting rows can leave the page on show past the end of the table.
      pageStart = Math.min(pageStart, pageOf(Math.max(dataset.rowCount - 1, 0)));
      if (
        dataset.rowCount !== renderedRowCount ||
        dataset.columns.length !== renderedColumnCount ||
        pageStart !== renderedPageStart
      ) {
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
    Multilink.lazyMultilinkAny(
      [
        DataLabColors.tableHeaderBackgroundColorProperty,
        DataLabColors.tableIncludedRowColorProperty,
        labels.inFitStringProperty,
        labels.rowStringProperty,
        a11y.controls.dataTableStringProperty,
        a11y.controls.cellStringProperty,
        a11y.controls.columnHeaderStringProperty,
        a11y.controls.deleteColumnStringProperty,
        a11y.controls.deleteRowStringProperty,
        labels.deleteRowStringProperty,
        labels.excludeStringProperty,
        labels.editFormulaStringProperty,
        labels.formulaDependencyStringProperty,
        labels.tableRowsStringProperty,
        labels.previousRowsStringProperty,
        labels.nextRowsStringProperty,
        a11y.controls.excludeRowStringProperty,
      ],
      rebuild,
    );
  }
}
