import { FORMULA } from "../../DataLabConstants.js";

/** A small arithmetic grammar for calculated columns. Column references are C1, C2, … */
type Expression = (read: (index: number) => number) => number;

const FUNCTIONS = new Map<string, (value: number) => number>([
  ["abs", Math.abs],
  ["sqrt", Math.sqrt],
  ["ln", Math.log],
  ["log10", Math.log10],
  ["exp", Math.exp],
  ["sin", Math.sin],
  ["cos", Math.cos],
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
  const close = () => {
    if (!take(")")) {
      throw new Error("Expected closing parenthesis");
    }
  };

  const atom = (): Expression => {
    if (take("(")) {
      const expression = sum();
      close();
      return expression;
    }
    const token = tokens[cursor++]?.toLowerCase() ?? "";
    if (/^c[1-9]\d*$/.test(token)) {
      const index = Number(token.slice(1)) - 1;
      if (index >= columnCount) {
        throw new Error("Unavailable column");
      }
      return (read) => read(index);
    }
    const fn = FUNCTIONS.get(token);
    if (fn && take("(")) {
      const argument = sum();
      close();
      return (read) => fn(argument(read));
    }
    if (token !== "" && Number.isFinite(Number(token))) {
      return () => Number(token);
    }
    throw new Error("Expected a number, column or function");
  };
  const unary = (): Expression => {
    if (take("-")) {
      const operand = unary();
      return (read) => -operand(read);
    }
    if (take("+")) {
      return unary();
    }
    const base = atom();
    if (take("^")) {
      const exponent = unary();
      return (read) => base(read) ** exponent(read);
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
      expression = multiply ? (read) => left(read) * right(read) : (read) => left(read) / right(read);
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
      expression = add ? (read) => left(read) + right(read) : (read) => left(read) - right(read);
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
