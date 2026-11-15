import { FORMULA } from "../../DataLabConstants.js";

/**
 * A small arithmetic grammar for calculated columns. Column references are C1, C2, …
 *
 * Most of the grammar works one row at a time. `derivative(y, x)` and
 * `integral(y, x)` look at neighbouring rows, so an expression is evaluated
 * against a context that can read any row of the earlier columns.
 */
export type FormulaContext = {
  /** The row being calculated. Column-wide functions move it while they work. */
  row: number;
  readonly rowCount: number;
  /** Value of an earlier column at a row; NaN for a blank or non-numeric cell. */
  readonly read: (columnIndex: number, row: number) => number;
  /** Set when a cell that was read is not a number, so `C1^0` of a blank is blank. */
  invalid: boolean;
  /** Column-wide results, computed once per pass over the table. */
  readonly cache: Map<unknown, readonly number[]>;
};

type Expression = (context: FormulaContext) => number;

export function createFormulaContext(
  rowCount: number,
  read: (columnIndex: number, row: number) => number,
): FormulaContext {
  return { row: 0, rowCount, read, invalid: false, cache: new Map() };
}

/** The value of an expression at one row, or NaN when it used a missing cell or is undefined. */
export function evaluateFormula(expression: Expression, context: FormulaContext, row: number): number {
  context.row = row;
  context.invalid = false;
  const value = expression(context);
  return !context.invalid && Number.isFinite(value) ? value : Number.NaN;
}

const FUNCTIONS = new Map<string, (value: number) => number>([
  ["abs", Math.abs],
  ["sqrt", Math.sqrt],
  ["ln", Math.log],
  ["log10", Math.log10],
  ["exp", Math.exp],
  ["sin", Math.sin],
  ["cos", Math.cos],
  ["tan", Math.tan],
]);

/** The expression's value at every row, NaN where it cannot be evaluated. */
function columnOf(expression: Expression, context: FormulaContext): number[] {
  const row = context.row;
  const invalid = context.invalid;
  const values = Array.from({ length: context.rowCount }, (_, i) => evaluateFormula(expression, context, i));
  context.row = row;
  context.invalid = invalid;
  return values;
}

/** One row of a column-wide result; a blank there makes the whole row blank. */
function columnValue(values: readonly number[], context: FormulaContext): number {
  const value = values[context.row] ?? Number.NaN;
  context.invalid ||= !Number.isFinite(value);
  return value;
}

/**
 * dy/dx at each row from its two neighbours (a central difference); the first
 * and last rows use their single neighbour. A row is blank when it or a
 * neighbour is missing, or when the neighbours share an x.
 */
function derivative(y: Expression, x: Expression): Expression {
  const key = {};
  return (context) => {
    let values = context.cache.get(key);
    if (!values) {
      const ys = columnOf(y, context);
      const xs = columnOf(x, context);
      const last = context.rowCount - 1;
      values = ys.map((_, i) => {
        const before = Math.max(i - 1, 0);
        const after = Math.min(i + 1, last);
        const run = (xs[after] as number) - (xs[before] as number);
        // A blank neighbour makes the difference NaN, which reads as blank.
        return Number.isFinite(ys[i]) && Number.isFinite(xs[i]) && run !== 0
          ? ((ys[after] as number) - (ys[before] as number)) / run
          : Number.NaN;
      });
      context.cache.set(key, values);
    }
    return columnValue(values, context);
  };
}

/**
 * Running trapezoid area under y against x, from the first usable row, in table
 * order. Rows with a missing x or y are blank and do not break the running total.
 */
function integral(y: Expression, x: Expression): Expression {
  const key = {};
  return (context) => {
    let values = context.cache.get(key);
    if (!values) {
      const ys = columnOf(y, context);
      const xs = columnOf(x, context);
      let total = 0;
      let previous = -1;
      values = ys.map((value, i) => {
        const position = xs[i] as number;
        if (!(Number.isFinite(value) && Number.isFinite(position))) {
          return Number.NaN;
        }
        if (previous >= 0) {
          total += ((position - (xs[previous] as number)) * (value + (ys[previous] as number))) / 2;
        }
        previous = i;
        return total;
      });
      context.cache.set(key, values);
    }
    return columnValue(values, context);
  };
}

const COLUMN_FUNCTIONS = new Map<string, (y: Expression, x: Expression) => Expression>([
  ["derivative", derivative],
  ["integral", integral],
]);

export function compileFormula(formula: string, columnCount: number): Expression | null {
  // Limit recursion and parsing work for pasted input.
  if (formula.length > FORMULA.MAX_LENGTH) {
    return null;
  }
  const tokens = formula.match(/\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?|[a-z][a-z0-9]*|[^\s]/gi) ?? [];
  let cursor = 0;
  const take = (token: string): boolean => {
    if (tokens[cursor] !== token) {
      return false;
    }
    cursor++;
    return true;
  };
  const expect = (token: string) => {
    if (!take(token)) {
      throw new Error(`Expected ${token}`);
    }
  };

  const atom = (): Expression => {
    if (take("(")) {
      const expression = sum();
      expect(")");
      return expression;
    }
    const token = tokens[cursor++]?.toLowerCase() ?? "";
    if (/^c[1-9]\d*$/.test(token)) {
      const index = Number(token.slice(1)) - 1;
      if (index >= columnCount) {
        throw new Error("Unavailable column");
      }
      return (context) => {
        const value = context.read(index, context.row);
        context.invalid ||= !Number.isFinite(value);
        return value;
      };
    }
    if (token === "pi") {
      return () => Math.PI;
    }
    const fn = FUNCTIONS.get(token);
    if (fn && take("(")) {
      const argument = sum();
      expect(")");
      return (context) => fn(argument(context));
    }
    const columnFunction = COLUMN_FUNCTIONS.get(token);
    if (columnFunction && take("(")) {
      const y = sum();
      expect(",");
      const x = sum();
      expect(")");
      return columnFunction(y, x);
    }
    if (token !== "" && Number.isFinite(Number(token))) {
      return () => Number(token);
    }
    throw new Error("Expected a number, column or function");
  };
  const unary = (): Expression => {
    if (take("-")) {
      const operand = unary();
      return (context) => -operand(context);
    }
    if (take("+")) {
      return unary();
    }
    const base = atom();
    if (take("^")) {
      const exponent = unary();
      return (context) => base(context) ** exponent(context);
    }
    return base;
  };
  const product = (): Expression => {
    let expression = unary();
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const multiply = take("*");
      if (!multiply) {
        cursor++;
      }
      const left = expression;
      const right = unary();
      expression = multiply ? (context) => left(context) * right(context) : (context) => left(context) / right(context);
    }
    return expression;
  };
  const sum = (): Expression => {
    let expression = product();
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      const add = take("+");
      if (!add) {
        cursor++;
      }
      const left = expression;
      const right = product();
      expression = add ? (context) => left(context) + right(context) : (context) => left(context) - right(context);
    }
    return expression;
  };

  try {
    const expression = sum();
    return cursor === tokens.length ? expression : null;
  } catch {
    return null;
  }
}

export function formulaReferences(formula: string): number[] {
  return Array.from(formula.matchAll(/\bc([1-9]\d*)\b/gi), (match) => Number(match[1]) - 1);
}

export function shiftFormulaAfterDeletion(formula: string, deletedIndex: number): string {
  return formula.replace(/\bc([1-9]\d*)\b/gi, (reference, position: string) =>
    Number(position) - 1 > deletedIndex ? `C${Number(position) - 1}` : reference,
  );
}
