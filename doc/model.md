# Data Lab — model

Data Lab has no physics of its own. Its "model" is the arithmetic between a
student's table and the numbers reported for a fit.

## The table

A table is a list of columns, each with a name, a unit and one text cell per row.
Each cell also has a numeric reading; a blank cell or one that is not a number
reads as *missing*. Units are text taken from the header (`Time (s)`, `Time [s]`)
and can be edited; they are never converted or checked.

## Which rows a fit uses

With x and y columns chosen and an optional range [x_min, x_max]:

- a row is **valid** when its x and y are both numbers;
- a valid row is **included** when x_min ≤ x ≤ x_max (both bounds included), or
  always when no range is set.

Rows with a missing x or y are skipped and counted. Rows need not be sorted by x,
and rows that share an x value are separate points — nothing is averaged.

## The models

| Model | Equation | Parameters and units |
|---|---|---|
| Proportional | y = A·x | A: [y]/[x] |
| Linear | y = m·x + b | m: [y]/[x]; b: [y] |
| Quadratic | y = A·x² + B·x + C | A: [y]/[x]²; B: [y]/[x]; C: [y] |

Units are composed as text (`m` and `s` give `m/s²`) without simplification.

## The fit

Ordinary least squares: the parameters minimize Σ rᵢ², where the residual is
rᵢ = yᵢ − f(xᵢ). Every point has equal weight and x is taken as exact.

Numerically, x is shifted to its mean and scaled to [−1, 1] (the proportional
model is only scaled), the design matrix is factored by Householder QR, and the
coefficients are mapped back to powers of x. The normal equations are not used.

With n points and p parameters:

| Quantity | Definition | Shown when |
|---|---|---|
| RMSE (residual standard deviation) | s = √(Σ rᵢ² / (n − p)), in y units | n > p |
| Standard error of a parameter | √ of the diagonal of s²·(XᵀX)⁻¹ | n > p |
| R² | 1 − Σ rᵢ² / Σ (yᵢ − ȳ)² | n > p, the model has an intercept, y is not constant |

Parameters are displayed rounded to two significant figures of their standard
error; exports carry full precision.

## When there is no fit

| Situation | Result |
|---|---|
| Fewer points than parameters | No fit: "Select at least p points" |
| Fewer distinct x values than parameters (linear, quadratic) | No fit: the parameters are not determined |
| Proportional fit with every x = 0 | No fit |
| Exactly p points | The curve passes through them; no uncertainties, RMSE or R² |

## What the uncertainties mean

The standard errors are inferred from the scatter of the residuals. They describe
the parameters well when the model suits the data (no pattern in the residual
graph), the errors in y are independent and of similar size, the errors in x are
negligible, and several points remain beyond the parameter count. A caution is
shown when fewer than three do. Closely sampled sensor data is often correlated
from one sample to the next, which makes these errors too small.

## The sample dataset

`cart-ramp-then-level.csv` is synthetic: a cart released from rest on a ramp,
x = 0.30·t² for 0 ≤ t ≤ 1.5 s (a = 0.60 m/s²), then coasting on a level track,
x = 0.675 + 0.90·(t − 1.5), sampled at 20 Hz with 2 mm Gaussian noise. One line
through all of it gives a slope that is neither speed, and a residual graph that
curves; a quadratic over 0–1.5 s returns A ≈ 0.30 m/s² and a line over 1.5–3 s
returns ≈ 0.90 m/s, each with flat residuals.

## Verification

The fit engine reproduces the certified parameter estimates, standard deviations
and residual standard deviation of four NIST Statistical Reference Datasets
(Norris, Pontius, NoInt1, NoInt2) to nine significant digits; see
`tests/fixtures/nist/README.md`.
