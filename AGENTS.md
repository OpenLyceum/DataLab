# AGENTS.md — Data Lab

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenLyceum/.github/AGENTS.md](https://github.com/OpenLyceum/.github/blob/main/AGENTS.md).

## Project

A browser tool for students to plot and analyze **their own** lab data: import a CSV or paste a
table → choose the x and y columns → drag across the graph to select a range of x → fit a
proportional, linear or quadratic model to the rows in that range → read the parameters with
their uncertainties and the residuals → export. No account, no hardware, no server: everything
runs in the page. It is a tool rather than a simulation — there is no clock and nothing to
"play" — but it is built and cataloged as a fleet sim so the shared tooling applies.

The roadmap (first release, later releases, open decisions) is in
[`doc/implementation-notes.md`](doc/implementation-notes.md); the numerical method is in
[`doc/model.md`](doc/model.md).

## Key files

| File | Purpose |
|---|---|
| `src/common/model/Dataset.ts` | The table: columns of cell text plus its numeric reading (NaN = blank or not a number); immutable edit operations |
| `src/common/model/parseTable.ts` | CSV / spreadsheet-paste parser: delimiter sniffing, quoted fields, header and unit detection, decimal commas |
| `src/common/model/includedRows.ts` | Which rows a fit uses: valid x and y, x inside the selected range (bounds inclusive) |
| `src/common/model/leastSquares.ts` | Householder-QR least squares for the three models, standard errors, RMSE, R², failure reasons |
| `src/common/model/formatFit.ts` | Parameter units built from column units; rounding a value to its uncertainty |
| `src/common/model/exportCsv.ts` | CSV export with `in_fit`, `fit_value`, `residual` columns |
| `src/data-lab/model/DataLabModel.ts` | Screen state and the derived chain dataset → inclusion → fit |
| `src/data-lab/model/samples/cart-ramp-then-level.csv` | Bundled sample (synthetic; written by `scripts/generate-sample.ts`) |
| `src/common/view/ChartFrameNode.ts` | Shared bamboo frame: plot rectangle, grid, ticks, labels, clipped data layer |
| `src/common/view/axisRange.ts` | Zoom-about-an-anchor and pan arithmetic for one axis |
| `src/common/view/GraphGestures.ts` | Wheel, pinch and axis-drag zoom/pan for a `ChartFrameNode` |
| `src/data-lab/view/GraphView.ts` | View state: visible x and y intervals (`null` = automatic), auto scale, zoom to range |
| `src/common/view/PointsCanvasNode.ts` | All points of a graph on one canvas (filled = in the fit, hollow = not) |
| `src/common/view/fileIO.ts` | File picker, drop target, Blob download |
| `src/data-lab/view/PlotNode.ts` | Main graph, fitted curve, range band with pointer and keyboard handles |
| `src/data-lab/view/ResidualPlotNode.ts` | Residuals on the same x axis |
| `src/data-lab/view/DataTableNode.ts` | Editable HTML table in a Scenery `DOM` node |
| `src/data-lab/view/fitText.ts` | One source for the status line, results panel, copied summary and screen-reader details |
| `src/data-lab/view/DataLabScreenView.ts` | Layout, import/export buttons, column choosers, range fields |

## Model notes

- **Everything under `src/common/model/` is pure TypeScript** with no SceneryStack imports. Keep it
  that way: it is what the unit tests exercise, and it is what would survive a change of view layer.
- **One chain, read by everything.** `inclusionProperty` and `fitProperty` are `DerivedProperty`s.
  The table highlighting, both graphs, the results panel, the status line and the exports all read
  them, so they cannot disagree. Do not compute inclusion or a fit anywhere else.
- **The range is in data units**, stored as `{min, max}` or `null`. `null` means *every valid row*,
  not "the visible rows": zooming must never change a fit. Changing the x column clears the range
  (its bounds are in the old column's units); changing the y column keeps it.
- **Zoom and pan are view state** (`GraphView`), never model state. Each axis is automatic (`null`)
  or set by hand; an automatic y axis fits the points inside the visible x interval. The residual
  graph shares the x interval and always fits its own y.
- **Pinch attaches both pointers** to its own listener (`pointer.addInputListener(listener, true)`).
  Without that, a `DragListener` snags a finger sliding over it (`allowTouchSnag`) and starts a
  range sweep in the middle of the pinch.
- **Reset All keeps the table.** It clears the range, the fit model and the zoom. A student's data
  must not vanish at one press.
- **Fit method** (`leastSquares.ts`): x is shifted to its mean and scaled to [−1, 1], the design
  matrix is factored by Householder QR, and coefficients and covariance are mapped back to powers of
  x. The proportional model is not shifted. Never switch to the normal equations — NIST's Pontius
  data (x up to 3×10⁶) then fails the nine-digit check.
- **Statistics that are deliberately absent:** standard errors, RMSE and R² are `null` when n = p;
  R² is `null` for the proportional model (its definition without an intercept is ambiguous) and
  when y is constant. The view prints nothing for a `null`, never 0 or NaN.
- **Decimal commas** are read only when the table's delimiter is not a comma; cells typed or pasted
  into the table accept either mark.

## Accessibility

Follows the fleet pattern: `DataLabScreenSummaryContent` (live `currentDetailsContent` built from
`fitText.ts`), a `pdomOrder` wrapper in the screen view, `DataLabKeyboardHelpContent`, and a11y
strings under `a11y.dataLab` in each locale.

- The two range edges are focusable `div`s with a `KeyboardListener`: ←/→ step to the neighbouring
  data point, Shift+←/→ move 1/100 of the axis, Page Up/Down move ten points, Home/End go to the
  ends of the data. Set each handle's `visible` once per update — hiding and re-showing a focused
  handle drops its focus.
- The range fields are the exact, non-pointer path to the same selection.
- Inclusion is never shown by color alone: included points are filled and excluded ones hollow;
  included table rows carry a check mark as well as a tint.
- **Known gap:** the HTML controls (table, column choosers, range fields) live in the visual DOM
  layer, not the PDOM, so they are reachable by Tab but sit outside `pdomOrder`, and the status
  line is not yet announced through a live region. See the roadmap.

## Compliance carve-outs

- **HTML form controls:** `DataTableNode.ts` and `DataLabScreenView.ts` build `<table>`, `<input>`
  and `<select>` elements and style them with inline CSS. Colors still come from `DataLabColors`
  (read as `.value.toCSS()`); font and geometry are CSS strings because Scenery options do not
  apply to DOM elements. Precedent: TrackLab's `TableRenderer.ts`.
- **Mathematical notation is not translated:** the model equations and parameter symbols in
  `formatFit.ts` (`y = m·x + b`) and the CSV column names in `exportCsv.ts` (`in_fit`) are
  literals, the same in every language, so an exported file opens the same way everywhere.
- `assets/screenshot.png`: captured with a real browser screenshot (Playwright `page.screenshot()` at
  1154×753), not Baton's `generate-screenshots.sh`. That tool rasterizes the Scenery display through
  joist's `ScreenshotGenerator`, which cannot see HTML elements, so the table, column choosers and
  range fields come out blank. Re-capture by hand after a `refresh-screenshots` run.
- `scripts/generate-sample.ts`: sim-specific script that writes the bundled sample dataset.
- `tests/memory-leak.test.ts`: the disposal list is empty — the model and view are built once and
  live for the page's lifetime.
- `doc/multi-screen.md`, `doc/improvement-recommendations.md`: removed; single-screen tool, and the
  roadmap lives in `doc/implementation-notes.md`.

## Testing

| Path | Purpose |
|---|---|
| `tests/common/model/leastSquares.test.ts` | Fit engine against NIST StRD certified values (Norris, Pontius, NoInt1, NoInt2) to nine significant digits, plus every failure case |
| `tests/fixtures/nist/` | NIST `.dat` files; the test reads data and certified values from the same file |
| `tests/common/model/parseTable.test.ts` | Parser and table-editing cases |
| `tests/common/model/includedRows.test.ts` | Inclusive bounds, unsorted x, repeated x, missing values |
| `tests/common/model/formatFit.test.ts` | Units and rounding to the uncertainty |
| `tests/common/view/axisRange.test.ts` | Zoom keeps its anchor, refuses to collapse; pan; padding |
| `tests/common/model/exportCsv.test.ts` | Sample-dataset expectations, export columns, export → import round trip |
| `tests/browser/workflow.spec.ts` | End-to-end in Chromium: typed range, dragged range, keyboard range, wheel zoom, axis-drag pan, pinch (CDP touch events), auto scale, table edit and paste, CSV download, clipboard. Page positions are computed from the screen view's transform, because the sim is not at scale 1 in the test viewport |

Run the browser specs with `npx playwright test tests/browser` (set `FUZZ_PORT` if 5173 is taken).
A new fit model needs a NIST or independently computed reference before it ships.

## Commands

```bash
npm run lint && npm run check && npm test && npm run build && npm run test:fuzz:quick
```

`node scripts/generate-sample.ts` rewrites the sample dataset (seeded, so the output is stable).
