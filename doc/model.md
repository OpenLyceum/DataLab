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


## Higher polynomials and transformed predictors

The cubic and quartic models extend the polynomial design matrix to degrees
three and four. The natural logarithm fits `y = A·ln(x) + B` using the same
solver with `ln(x)` as the predictor. In `A·ln(k·x) + y₀`, the two constants
contribute only through `B = A·ln(k) + y₀`, so the fit estimates that combined
background.
The inverse and inverse-square models use the same linear solver with
predictors \(1/x\) and \(1/x^2\), respectively, and a free intercept.
The residuals and RMSE remain in the original y units. Measurements whose
reciprocal predictor is undefined remain in the table and scatter plot.
The fit and residual plot omit those rows, and CSV leaves both prediction
and residual blank for them.

## Weighted fits

Weighted linear requires a y-uncertainty column. The same column can be
selected to weight any of the other models. It contains positive standard uncertainties in
the same units as y. Each design row and its y value are scaled by
`min(σ) / σᵢ` before QR, which gives the same solution as weights `1 / σᵢ²`.
Rows with missing, zero or negative uncertainties do not enter a weighted fit.
The graph draws y ± σ where the uncertainty is valid.

Parameter uncertainties use the supplied σ as absolute standard deviations.
They are not scaled by the reduced χ². Reduced χ² is the sum of squared
standardized residuals divided by n − p, and is reported only when n > p.
RMSE and exported residuals stay in y units.

## Exponential fit

Data Lab fits `y = A·exp(k·(x − x₀))`, with x₀ fixed at the smallest included
x. The amplitude A is the modeled y at that reference, and k has inverse x
units. Levenberg–Marquardt minimizes the original-y residuals using damped QR
steps. The log of the magnitude of y provides only a starting estimate, so
zero and negative observations still enter the objective. The final Jacobian
provides local parameter uncertainties. If an uncertainty column is selected,
the same absolute-σ convention and reduced χ² as for weighted linear fits apply.

## Additional nonlinear fits

| Model | Equation |
|---|---|
| Power | y = A·x^n + B |
| Power (no offset) | y = A·x^n |
| Inverse (shifted x) | y = A/(x − x₀) + B |
| Inverse square (shifted x) | y = A/(x − x₀)² + B |
| Exponential with background | y = A·exp(k·x) + y₀ |
| Inverse exponential | y = A·(1 − exp(−k·x)) + y₀ |
| Sine | y = A·sin(ω·x + φ) + C |
| Damped sine | y = A·exp(−k·x)·sin(ω·x + φ) + C |
| Sine series | y = C + Σₕ Aₕ·sin(h·ω·x + φₕ), for h = 1, 2, 3 |
| Gaussian | y = A·exp(−½·((x − μ)/σ)²) + y₀ |

Power and logarithmic fits use rows with strictly positive x. The power
exponent is estimated from the measurements, with the residuals still
computed in the original y units. The shifted reciprocal fits estimate
the position of the pole and draw each side as a separate curve.

The added nonlinear fits use variable projection. At each trial value of
the nonlinear parameters, weighted QR gives the least-squares amplitudes
and background. Data Lab ranks multiple trial values and refines several
with Nelder–Mead. The final Jacobian gives local standard errors. The
frequency search uses the median spacing between distinct x values to
estimate a Nyquist limit, applied to the highest harmonic in the model.
It also caps the frequency grid at 128 fundamental cycles across the
selected range. Equations in the results use the selected axis names.
