/**
 * DataLabModel.ts
 *
 * The state of the Data Lab screen and the one-way chain that turns it into a fit:
 *
 *   dataset + x column + y column + range  →  inclusion (which rows are used)
 *   inclusion + model                      →  fit (parameters, residuals, statistics)
 *
 * The table, the plot, the residual plot, the results panel and the exports all
 * read `inclusionProperty` and `fitProperty`, so they cannot disagree.
 */

import { DerivedProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import type { TModel } from "scenerystack/joist";
import {
  addRow,
  type Column,
  type Dataset,
  deleteRow,
  isNumericColumn,
  pasteBlock,
  setCell,
  setColumnHeader,
} from "../../common/model/Dataset.js";
import { type Inclusion, includedRows, orderedRange, type XRange } from "../../common/model/includedRows.js";
import { FitModel, type FitModelValue, type FitResult, fitModel } from "../../common/model/leastSquares.js";
import { parseTable } from "../../common/model/parseTable.js";
import sampleCsv from "./samples/cart-ramp-then-level.csv?raw";

export class DataLabModel implements TModel {
  public readonly datasetProperty: Property<Dataset>;

  /** Index of the column on each axis; −1 when the table has no numeric column to offer. */
  public readonly xColumnIndexProperty = new NumberProperty(-1);
  public readonly yColumnIndexProperty = new NumberProperty(-1);

  /** The selected x interval in data units, or null to use every valid row. */
  public readonly rangeProperty = new Property<XRange | null>(null);

  public readonly fitModelProperty = new Property<FitModelValue>(FitModel.LINEAR);

  public readonly xColumnProperty: TReadOnlyProperty<Column | null>;
  public readonly yColumnProperty: TReadOnlyProperty<Column | null>;
  public readonly inclusionProperty: TReadOnlyProperty<Inclusion>;
  public readonly fitProperty: TReadOnlyProperty<FitResult>;

  public constructor() {
    this.datasetProperty = new Property<Dataset>(parseTable(sampleCsv).dataset);
    this.chooseDefaultColumns();

    const columnAt = (dataset: Dataset, index: number): Column | null => dataset.columns[index] ?? null;
    this.xColumnProperty = new DerivedProperty([this.datasetProperty, this.xColumnIndexProperty], columnAt);
    this.yColumnProperty = new DerivedProperty([this.datasetProperty, this.yColumnIndexProperty], columnAt);

    this.inclusionProperty = new DerivedProperty(
      [this.xColumnProperty, this.yColumnProperty, this.rangeProperty],
      (xColumn, yColumn, range) => includedRows(xColumn?.values ?? [], yColumn?.values ?? [], range),
    );

    this.fitProperty = new DerivedProperty(
      [this.inclusionProperty, this.fitModelProperty],
      (inclusion, model): FitResult => {
        const xValues = this.xColumnProperty.value?.values ?? [];
        const yValues = this.yColumnProperty.value?.values ?? [];
        return fitModel(
          model,
          inclusion.indices.map((i) => xValues[i] as number),
          inclusion.indices.map((i) => yValues[i] as number),
        );
      },
    );

    // A range is in the units of the x column, so it does not survive a change of x column.
    this.xColumnIndexProperty.lazyLink(() => {
      this.rangeProperty.value = null;
    });
  }

  /** Replaces the table with imported text. Returns false when the text holds no table. */
  public importText(text: string, defaultColumnName?: (position: number) => string): boolean {
    const { dataset } = parseTable(text, defaultColumnName ? { defaultColumnName } : {});
    if (dataset.columns.length === 0 || dataset.rowCount === 0) {
      return false;
    }
    this.rangeProperty.value = null;
    this.datasetProperty.value = dataset;
    this.chooseDefaultColumns();
    return true;
  }

  public loadSample(): void {
    this.importText(sampleCsv);
  }

  public setCell(rowIndex: number, columnIndex: number, text: string): void {
    this.datasetProperty.value = setCell(this.datasetProperty.value, rowIndex, columnIndex, text);
  }

  public setColumnHeader(columnIndex: number, name: string, unit: string): void {
    this.datasetProperty.value = setColumnHeader(this.datasetProperty.value, columnIndex, name, unit);
  }

  public pasteBlock(rowIndex: number, columnIndex: number, block: readonly (readonly string[])[]): void {
    this.datasetProperty.value = pasteBlock(this.datasetProperty.value, rowIndex, columnIndex, block);
  }

  public addRow(): void {
    this.datasetProperty.value = addRow(this.datasetProperty.value);
  }

  public deleteRow(rowIndex: number): void {
    this.datasetProperty.value = deleteRow(this.datasetProperty.value, rowIndex);
  }

  /** Sets the range from two bounds in either order. */
  public setRange(a: number, b: number): void {
    if (Number.isFinite(a) && Number.isFinite(b)) {
      this.rangeProperty.value = orderedRange(a, b);
    }
  }

  public clearRange(): void {
    this.rangeProperty.value = null;
  }

  /** The x values that carry a valid point, sorted and without repeats — the keyboard steps through these. */
  public distinctXValues(): number[] {
    const xValues = this.xColumnProperty.value?.values ?? [];
    const yValues = this.yColumnProperty.value?.values ?? [];
    const distinct = new Set<number>();
    xValues.forEach((x, i) => {
      if (Number.isFinite(x) && Number.isFinite(yValues[i])) {
        distinct.add(x);
      }
    });
    return [...distinct].sort((a, b) => a - b);
  }

  /** Puts the first two numeric columns on the axes. */
  private chooseDefaultColumns(): void {
    const numeric: number[] = [];
    this.datasetProperty.value.columns.forEach((column, index) => {
      if (isNumericColumn(column)) {
        numeric.push(index);
      }
    });
    this.xColumnIndexProperty.value = numeric[0] ?? -1;
    this.yColumnIndexProperty.value = numeric[1] ?? numeric[0] ?? -1;
  }

  /**
   * Reset All returns the analysis — range and model — to its starting state. It
   * deliberately keeps the table: a student's data must not vanish at one press.
   */
  public reset(): void {
    this.rangeProperty.reset();
    this.fitModelProperty.reset();
  }

  public step(_dt: number): void {
    // Nothing advances with time.
  }
}
