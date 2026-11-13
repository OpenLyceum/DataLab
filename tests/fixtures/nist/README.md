# NIST StRD linear least-squares reference datasets

Files from the NIST Statistical Reference Datasets project
(https://www.itl.nist.gov/div898/strd/lls/lls.shtml), downloaded 2026-11-12 from
`https://www.itl.nist.gov/div898/strd/lls/data/LINKS/DATA/<name>.dat`. Content is
unchanged; git normalizes the line endings to LF.

Each file carries its data and the certified parameter estimates, standard
deviations, residual standard deviation and R². `tests/common/model/leastSquares.test.ts`
reads both from the file, so nothing is retyped.

| File | Model | Used to check |
| --- | --- | --- |
| `Norris.dat` | y = B0 + B1·x | linear fit |
| `Pontius.dat` | y = B0 + B1·x + B2·x² | quadratic fit (x up to 3×10⁶) |
| `NoInt1.dat`, `NoInt2.dat` | y = B1·x | proportional fit |
