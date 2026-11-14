/** QR operations shared by linear and nonlinear least squares. */

const RANK_TOLERANCE = 1e-10;

/**
 * Householder QR of the n×p matrix `a` (row-major, modified in place) applied to
 * the right-hand side `b` (modified in place). Afterwards the upper triangle of
 * `a` holds R and the first p entries of `b` hold Qᵀb.
 */
export function householder(a: number[][], b: number[], n: number, p: number): void {
  for (let k = 0; k < p; k++) {
    let norm = 0;
    for (let i = k; i < n; i++) {
      norm = Math.hypot(norm, (a[i] as number[])[k] as number);
    }
    if (norm === 0) {
      continue;
    }
    const pivotRow = a[k] as number[];
    const alpha = (pivotRow[k] as number) > 0 ? -norm : norm;
    // v = column k below the diagonal, with alpha subtracted from its head.
    const v = new Array<number>(n - k);
    for (let i = k; i < n; i++) {
      v[i - k] = (a[i] as number[])[k] as number;
    }
    v[0] = (v[0] as number) - alpha;
    let vDotV = 0;
    for (const value of v) {
      vDotV += value * value;
    }
    if (vDotV === 0) {
      continue;
    }
    for (let j = k; j < p; j++) {
      let dot = 0;
      for (let i = k; i < n; i++) {
        dot += (v[i - k] as number) * ((a[i] as number[])[j] as number);
      }
      const scale = (2 * dot) / vDotV;
      for (let i = k; i < n; i++) {
        const row = a[i] as number[];
        row[j] = (row[j] as number) - scale * (v[i - k] as number);
      }
    }
    let dot = 0;
    for (let i = k; i < n; i++) {
      dot += (v[i - k] as number) * (b[i] as number);
    }
    const scale = (2 * dot) / vDotV;
    for (let i = k; i < n; i++) {
      b[i] = (b[i] as number) - scale * (v[i - k] as number);
    }
  }
}

/** Inverse of the upper-triangular p×p block of `r`. */
function invertUpperTriangular(r: number[][], p: number): number[][] {
  const inverse: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let j = 0; j < p; j++) {
    (inverse[j] as number[])[j] = 1 / ((r[j] as number[])[j] as number);
    for (let i = j - 1; i >= 0; i--) {
      let sum = 0;
      for (let k = i + 1; k <= j; k++) {
        sum += ((r[i] as number[])[k] as number) * ((inverse[k] as number[])[j] as number);
      }
      (inverse[i] as number[])[j] = -sum / ((r[i] as number[])[i] as number);
    }
  }
  return inverse;
}

/** Solves R·β = Qᵀy by back-substitution, R being the upper triangle of `r`. */
export function backSubstitute(r: number[][], qty: number[], p: number): number[] {
  const solution = new Array<number>(p).fill(0);
  for (let j = p - 1; j >= 0; j--) {
    let sum = qty[j] as number;
    for (let k = j + 1; k < p; k++) {
      sum -= ((r[j] as number[])[k] as number) * (solution[k] as number);
    }
    solution[j] = sum / ((r[j] as number[])[j] as number);
  }
  return solution;
}

/** True when a diagonal entry of R is negligible beside the largest: the columns are dependent. */
export function isRankDeficient(r: number[][], p: number): boolean {
  let largest = 0;
  for (let j = 0; j < p; j++) {
    largest = Math.max(largest, Math.abs((r[j] as number[])[j] as number));
  }
  for (let j = 0; j < p; j++) {
    if (Math.abs((r[j] as number[])[j] as number) <= RANK_TOLERANCE * largest) {
      return true;
    }
  }
  return false;
}

/**
 * Standard errors of the parameters: Cov(β) = σ²·R⁻¹R⁻ᵀ, so
 * Cov(parameters) = σ²·(T·R⁻¹)(T·R⁻¹)ᵀ, T being the map back to powers of x.
 */
export function standardErrorsOf(transform: number[][], r: number[][], p: number, variance: number): number[] {
  const rInverse = invertUpperTriangular(r, p);
  return transform.map((row) => {
    let sumSquares = 0;
    for (let m = 0; m < p; m++) {
      let entry = 0;
      for (let k = 0; k < p; k++) {
        entry += (row[k] as number) * ((rInverse[k] as number[])[m] as number);
      }
      sumSquares += entry * entry;
    }
    return Math.sqrt(variance * sumSquares);
  });
}
