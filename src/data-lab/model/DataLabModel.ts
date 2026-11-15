/**
 * DataLabModel.ts
 *
 * The state of the Data Lab screen and the one-way chain that turns it into a fit:
 *
 *   dataset + x, y and σ columns + range + model  →  fit inputs
 *   fit inputs                                    →  inclusion (which rows are used)
 *   inclusion                                     →  fit (parameters, residuals, statistics)
 *
 * The table, the plot, the residual plot, the results panel and the exports all
 * read `inclusionProperty` and `fitProperty`, so they cannot disagree.
 *
 * Each link has exactly one input that changes per edit, so one edit costs one
 * fit. That matters for the iterative models, where a fit can take seconds: an
 * import changes the table and all three column choices, and must not fit four
 * times. Edits that touch several inputs run inside `batch()`.
 *
 * Every change to the table can be undone. A student's data is the one thing
 * here that cannot be regenerated.
 */

import { BooleanProperty, DerivedProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import type { TModel } from "scenerystack/joist";
import {
  addColumn,
  addRow,
  type Column,
  type Dataset,
  deleteColumn,
  deleteRow,
  isNumericColumn,
  pasteBlock,
  setCalculatedColumn,
  setCell,
  setColumnHeader,
  setRowExcluded,
} from "../../common/model/Dataset.js";
import { type Inclusion, includedRows, orderedRange, type XRange } from "../../common/model/includedRows.js";
import {
  FitModel,
  type FitModelValue,
  type FitResult,
  type FitSuccess,
  fitModel,
} from "../../common/model/leastSquares.js";
import { parseTable } from "../../common/model/parseTable.js";
import { HISTORY } from "../../DataLabConstants.js";
import { restoreDataset } from "./datasetStorage.js";
import sampleCsv from "./samples/cart-ramp-then-level.csv?raw";

import type { FitSettings, Session } from "./sessionFile.js";

export type PinnedFit = {
  readonly settings: FitSettings;
  readonly fit: FitSuccess;
  readonly range: XRange;
  readonly xValues: readonly number[];
  readonly xColumn: Column;
  readonly yColumn: Column;
};

/** Everything a fit depends on, gathered so that one edit publishes one change. */
type FitInputs = {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly sigmas: readonly number[] | undefined;
  readonly excludedRows: readonly number[];
  readonly range: XRange | null;
  readonly model: FitModelValue;
};

/** What Undo puts back: the table and the columns chosen from it. */
type TableSnapshot = {
  readonly dataset: Dataset;
  readonly xColumn: number;
  readonly yColumn: number;
  readonly uncertaintyColumn: number;
};

const NO_EXCLUSIONS: readonly number[] = [];

export class DataLabModel implements TModel {
  public readonly datasetProperty: Property<Dataset>;

  /** Index of the column on each axis; −1 when the table has no numeric column to offer. */
  public readonly xColumnIndexProperty = new NumberProperty(-1);
  public readonly yColumnIndexProperty = new NumberProperty(-1);

  public readonly uncertaintyColumnIndexProperty = new NumberProperty(-1);
  public readonly uncertaintyColumnProperty: TReadOnlyProperty<Column | null>;

  /** The selected x interval in data units, or null to use every valid row. */
  public readonly rangeProperty = new Property<XRange | null>(null);

  public readonly fitModelProperty = new Property<FitModelValue>(FitModel.LINEAR);

  public readonly xColumnProperty: TReadOnlyProperty<Column | null>;
  public readonly yColumnProperty: TReadOnlyProperty<Column | null>;
  public readonly inclusionProperty: TReadOnlyProperty<Inclusion>;
  public readonly fitProperty: TReadOnlyProperty<FitResult>;

  private readonly pinnedFit = new Property<PinnedFit | null>(null);
  public readonly pinnedFitProperty: TReadOnlyProperty<PinnedFit | null> = this.pinnedFit;

  private readonly canUndo = new BooleanProperty(false);
  private readonly canRedo = new BooleanProperty(false);
  public readonly canUndoProperty: TReadOnlyProperty<boolean> = this.canUndo;
  public readonly canRedoProperty: TReadOnlyProperty<boolean> = this.canRedo;
  private undoStack: TableSnapshot[] = [];
  private redoStack: TableSnapshot[] = [];

  private readonly fitInputsProperty: Property<FitInputs>;
  private batchDepth = 0;
  private reindexingXAxis = false;

  public constructor() {
    this.datasetProperty = new Property<Dataset>(restoreDataset() ?? parseTable(sampleCsv).dataset);
    this.chooseDefaultColumns();

    const columnAt = (dataset: Dataset, index: number): Column | null => dataset.columns[index] ?? null;
    this.xColumnProperty = new DerivedProperty([this.datasetProperty, this.xColumnIndexProperty], columnAt);
    this.yColumnProperty = new DerivedProperty([this.datasetProperty, this.yColumnIndexProperty], columnAt);

    this.uncertaintyColumnProperty = new DerivedProperty(
      [this.datasetProperty, this.uncertaintyColumnIndexProperty],
      columnAt,
    );

    this.fitInputsProperty = new Property<FitInputs>(this.currentFitInputs());
    const refreshFitInputs = () => this.refreshFitInputs();
    for (const source of [
      this.datasetProperty,
      this.xColumnIndexProperty,
      this.yColumnIndexProperty,
      this.uncertaintyColumnIndexProperty,
      this.rangeProperty,
      this.fitModelProperty,
    ]) {
      source.lazyLink(refreshFitInputs);
    }

    this.inclusionProperty = new DerivedProperty(
      [this.fitInputsProperty],
      ({ xs, ys, sigmas, excludedRows, range, model }) => includedRows(xs, ys, range, excludedRows, model, sigmas),
    );

    // The inputs are read here rather than listed as dependencies: the inclusion is
    // rebuilt whenever they change, so listing them would fit twice.
    this.fitProperty = new DerivedProperty([this.inclusionProperty], ({ indices }): FitResult => {
      const { xs, ys, sigmas, model } = this.fitInputsProperty.value;
      return fitModel(
        model,
        indices.map((i) => xs[i] as number),
        indices.map((i) => ys[i] as number),
        sigmas && indices.map((i) => sigmas[i] as number),
      );
    });

    this.datasetProperty.lazyLink(() => this.clearPinnedFit());
    this.xColumnIndexProperty.lazyLink(() => this.clearPinnedFit());
    this.yColumnIndexProperty.lazyLink(() => {
      this.clearPinnedFit();
      const range = this.rangeProperty.value;
      if (range?.y) {
        this.setRange(range.min, range.max);
      }
    });

    // A range is in the units of the x column, so it does not survive a change of x column.
    this.xColumnIndexProperty.lazyLink(() => {
      if (!this.reindexingXAxis) {
        this.clearRange();
      }
    });
  }

  public pinFit(): void {
    const fit = this.fitProperty.value;
    const range = this.rangeProperty.value;
    const xColumn = this.xColumnProperty.value;
    const yColumn = this.yColumnProperty.value;
    if (fit.ok && range && xColumn && yColumn) {
      this.pinnedFit.value = {
        settings: this.fitSettings(),
        fit,
        range,
        xColumn,
        yColumn,
        xValues: this.inclusionProperty.value.indices.map((index) => xColumn.values[index] as number),
      };
    }
  }

  public fitSettings(): FitSettings {
    return {
      uncertaintyColumn: this.uncertaintyColumnIndexProperty.value,
      range: this.rangeProperty.value,
      model: this.fitModelProperty.value,
    };
  }

  /** Opens a run. Its table is a different table, so the undo history starts again. */
  public loadSession(session: Session): void {
    const apply = (settings: FitSettings) => {
      this.batch(() => {
        this.uncertaintyColumnIndexProperty.value = settings.uncertaintyColumn;
        this.fitModelProperty.value = settings.model;
        this.rangeProperty.value = settings.range;
      });
    };
    this.batch(() => {
      this.reset();
      this.datasetProperty.value = session.dataset;
      this.xColumnIndexProperty.value = session.xColumn;
      this.yColumnIndexProperty.value = session.yColumn;
      // With a pin, its settings are applied first so the pinned fit can be computed.
      apply(session.pin ?? session);
    });
    if (session.pin) {
      this.pinFit();
      apply(session);
    }
    this.clearHistory();
  }

  /** Runs several changes to the table and the column choices as one edit: one inclusion, one fit. */
  private batch(change: () => void): void {
    this.batchDepth++;
    try {
      change();
    } finally {
      this.batchDepth--;
      this.refreshFitInputs();
    }
  }

  private currentFitInputs(): FitInputs {
    const dataset = this.datasetProperty.value;
    const values = (index: number) => dataset.columns[index]?.values;
    return {
      xs: values(this.xColumnIndexProperty.value) ?? [],
      ys: values(this.yColumnIndexProperty.value) ?? [],
      sigmas: values(this.uncertaintyColumnIndexProperty.value),
      excludedRows: dataset.excludedRows ?? NO_EXCLUSIONS,
      range: this.rangeProperty.value,
      model: this.fitModelProperty.value,
    };
  }

  /** Publishes new inputs only when one of them changed: editing an unplotted column costs no fit. */
  private refreshFitInputs(): void {
    if (this.batchDepth > 0) {
      return;
    }
    const next = this.currentFitInputs();
    const current = this.fitInputsProperty.value;
    if (
      next.xs !== current.xs ||
      next.ys !== current.ys ||
      next.sigmas !== current.sigmas ||
      next.excludedRows !== current.excludedRows ||
      next.range !== current.range ||
      next.model !== current.model
    ) {
      this.fitInputsProperty.value = next;
    }
  }

  // ── Undo ──────────────────────────────────────────────────────────────────

  private snapshot(): TableSnapshot {
    return {
      dataset: this.datasetProperty.value,
      xColumn: this.xColumnIndexProperty.value,
      yColumn: this.yColumnIndexProperty.value,
      uncertaintyColumn: this.uncertaintyColumnIndexProperty.value,
    };
  }

  /** Remembers the table as it is, before an edit replaces it. */
  private remember(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > HISTORY.MAX_UNDO_STEPS) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateHistoryFlags();
  }

  private restore(snapshot: TableSnapshot): void {
    this.batch(() => {
      this.datasetProperty.value = snapshot.dataset;
      // A range is in the units of the x column; it is cleared if that column changes.
      this.xColumnIndexProperty.value = snapshot.xColumn;
      this.yColumnIndexProperty.value = snapshot.yColumn;
      this.uncertaintyColumnIndexProperty.value = snapshot.uncertaintyColumn;
    });
  }

  private updateHistoryFlags(): void {
    this.canUndo.value = this.undoStack.length > 0;
    this.canRedo.value = this.redoStack.length > 0;
  }

  private clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.updateHistoryFlags();
  }

  /** Puts back the table as it was before the last edit, import or paste. */
  public undo(): void {
    const previous = this.undoStack.pop();
    if (previous) {
      this.redoStack.push(this.snapshot());
      this.restore(previous);
      this.updateHistoryFlags();
    }
  }

  public redo(): void {
    const next = this.redoStack.pop();
    if (next) {
      this.undoStack.push(this.snapshot());
      this.restore(next);
      this.updateHistoryFlags();
    }
  }

  public clearPinnedFit(): void {
    this.pinnedFit.value = null;
  }

  /** Replaces the table with imported text. Returns false when the text holds no table. */
  public importText(text: string, defaultColumnName?: (position: number) => string): boolean {
    return this.importDataset(parseTable(text, defaultColumnName ? { defaultColumnName } : {}).dataset);
  }

  /** Replaces the table with an already-parsed one, as an import dialog produces. */
  public importDataset(dataset: Dataset): boolean {
    if (dataset.columns.length === 0 || dataset.rowCount === 0) {
      return false;
    }
    this.remember();
    this.batch(() => {
      this.rangeProperty.value = null;
      this.uncertaintyColumnIndexProperty.reset();
      this.datasetProperty.value = dataset;
      this.chooseDefaultColumns();
    });
    return true;
  }

  public loadSample(): void {
    this.importText(sampleCsv);
  }

  public setCell(rowIndex: number, columnIndex: number, text: string): void {
    this.updateDataset(setCell(this.datasetProperty.value, rowIndex, columnIndex, text));
  }

  public setColumnHeader(columnIndex: number, name: string, unit: string): void {
    this.updateDataset(setColumnHeader(this.datasetProperty.value, columnIndex, name, unit));
  }

  public pasteBlock(rowIndex: number, columnIndex: number, block: readonly (readonly string[])[]): void {
    this.updateDataset(pasteBlock(this.datasetProperty.value, rowIndex, columnIndex, block));
  }

  public setRowExcluded(rowIndex: number, excluded: boolean): void {
    this.updateDataset(setRowExcluded(this.datasetProperty.value, rowIndex, excluded));
  }

  public addRow(): void {
    this.updateDataset(addRow(this.datasetProperty.value));
  }

  public deleteRow(rowIndex: number): void {
    this.updateDataset(deleteRow(this.datasetProperty.value, rowIndex));
  }

  public addColumn(name: string): void {
    this.updateDataset(addColumn(this.datasetProperty.value, name));
  }

  public setCalculatedColumn(index: number, name: string, unit: string, formula: string): boolean {
    const dataset = this.datasetProperty.value;
    const next = setCalculatedColumn(dataset, index, name, unit, formula);
    if (next === dataset) {
      return false;
    }
    this.updateDataset(next);
    return true;
  }

  public deleteColumn(columnIndex: number): void {
    const dataset = this.datasetProperty.value;
    if (dataset.columns.length <= 1) {
      return;
    }
    const next = deleteColumn(dataset, columnIndex);
    if (next === dataset) {
      return;
    }

    const shiftedIndex = (index: number) => (index === columnIndex ? -1 : index > columnIndex ? index - 1 : index);
    this.updateDataset(
      next,
      shiftedIndex(this.xColumnIndexProperty.value),
      shiftedIndex(this.yColumnIndexProperty.value),
      shiftedIndex(this.uncertaintyColumnIndexProperty.value),
    );
  }

  /**
   * Every table edit ends here: it is remembered for Undo and applied as one change.
   * Keeps the selected axes when possible, otherwise falls back to a numeric column.
   */
  private updateDataset(
    dataset: Dataset,
    xIndex = this.xColumnIndexProperty.value,
    yIndex = this.yColumnIndexProperty.value,
    uncertaintyIndex = this.uncertaintyColumnIndexProperty.value,
  ): void {
    if (dataset === this.datasetProperty.value) {
      return;
    }
    this.remember();
    this.batch(() => this.applyDataset(dataset, xIndex, yIndex, uncertaintyIndex));
  }

  private applyDataset(dataset: Dataset, xIndex: number, yIndex: number, uncertaintyIndex: number): void {
    this.uncertaintyColumnIndexProperty.value = uncertaintyIndex;
    const numeric = dataset.columns
      .map((column, index) => (isNumericColumn(column) ? index : -1))
      .filter((i) => i >= 0);
    const keepX = numeric.includes(xIndex);
    const nextX = keepX ? xIndex : (numeric[0] ?? -1);
    const nextY = numeric.includes(yIndex) ? yIndex : (numeric.find((i) => i !== nextX) ?? nextX);
    if (!keepX) {
      this.clearRange();
    }
    this.datasetProperty.value = dataset;
    this.reindexingXAxis = keepX;
    try {
      this.xColumnIndexProperty.value = nextX;
    } finally {
      this.reindexingXAxis = false;
    }
    this.yColumnIndexProperty.value = nextY;
  }

  /** Sets the range from two bounds in either order. */
  public setRange(a: number, b: number, y?: XRange): void {
    if (Number.isFinite(a) && Number.isFinite(b)) {
      this.rangeProperty.value = y ? { ...orderedRange(a, b), y } : orderedRange(a, b);
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
    this.batch(() => {
      this.clearPinnedFit();
      this.rangeProperty.reset();
      this.fitModelProperty.reset();
      this.uncertaintyColumnIndexProperty.reset();
    });
  }

  public step(_dt: number): void {
    // Nothing advances with time.
  }
}
