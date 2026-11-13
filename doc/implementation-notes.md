# Data Lab — implementation notes

## Shape

```
src/common/model/     pure TypeScript, no SceneryStack imports
  Dataset.ts          table + immutable edits
  parseTable.ts       CSV / paste → Dataset
  includedRows.ts     range → row indices
  leastSquares.ts     QR fit, statistics, failure reasons
  formatFit.ts        units and rounding
  exportCsv.ts        Dataset + fit → CSV
src/common/view/      ChartFrameNode (bamboo), PointsCanvasNode, fileIO
src/data-lab/model/   DataLabModel: Properties and the derived chain
src/data-lab/view/    PlotNode, ResidualPlotNode, DataTableNode, ResultsPanel,
                      fitText, DataLabScreenView
```

Data flows one way:

```
file / paste → parseTable → datasetProperty ← table edits
datasetProperty + x/y column + rangeProperty → inclusionProperty
inclusionProperty + fitModelProperty         → fitProperty
inclusionProperty, fitProperty → table marks, graphs, results, status, exports
```

## Scenery and HTML together

The graphs, buttons, radio buttons and results are Scenery nodes. The table, the
two column choosers and the two range fields are real HTML elements mounted with
`new DOM(element, { allowInput: true })`, following TrackLab's read-only table.
Native elements give text entry, selection, the clipboard and touch keyboards for
free. The cost is that they sit in the visual layer rather than the parallel DOM.

Table details worth knowing:

- The DOM is rebuilt only when the row or column count changes; otherwise cell
  text is patched in place and the focused input is left alone.
- A cell commits on `change` (blur or Enter). Enter and ↓ move down, ↑ moves up,
  Escape restores the model's text.
- A paste containing a tab or newline is treated as a block and written through
  `pasteBlock()`; a single value pastes natively.
- At most 1000 rows are rendered. All rows are still plotted and fitted.

## Graphs

`ChartFrameNode` wraps bamboo's `ChartTransform`, grid, ticks and labels, and
orders spacing and range updates so a tick set never lays out thousands of ticks.
Points are painted on a single canvas (`PointsCanvasNode`).

The x axis shows all valid data unless `xViewRangeProperty` (view state) is set by
"Zoom to range". The selected range lives in the model in data units, so the two
are independent.

Range gestures in `PlotNode`: drag on empty plot area sweeps a new range; drag an
edge resizes (the opposite bound is fixed for the whole gesture, so edges may
cross); drag the band moves it. Keyboard steps use the sorted distinct x values of
the valid points.

## Deviations from the original plan

- **No PapaParse.** A decimal-comma file needs the delimiter chosen before
  tokenizing, which left the library only the quote handling — about fifty lines.
  The fleet's single runtime dependency (`scenerystack`) is kept.
- **Own Householder QR** rather than `dot/Matrix`, so the fit engine has no
  SceneryStack import and with p ≤ 3 needs no general matrix class.

## Roadmap

Done: scaffold; CSV, paste and drag-and-drop import; units from headers; editable
table; column choosers; range by drag, handles, keyboard and numeric fields;
proportional, linear and quadratic fits with standard errors, RMSE and R²;
residual graph; CSV export; copy results; zoom to range.

Remaining for 0.1:

- PNG export of the graph.
- Wheel and pinch zoom, pan.
- Announce the status line through a live region; bring the HTML controls into
  the reading order.
- Delete-row control; column add/remove.
- Check the table in Firefox, Safari, on an iPad and with a screen reader
  (only Chromium has been exercised).
- Fleet onboarding: GitHub repo, catalog entry, screenshot, icon.

0.2: weighted fits, error bars and reduced χ²; calculated columns; per-row
exclusion; pinned fits (two ranges at once); inverse, inverse-square and cubic
models; log axes; restore the table after a reload.

0.3: nonlinear models (Levenberg–Marquardt); multiple runs; session files;
statistics, slope and area on a range.

Later: sensor capture over Web Bluetooth; rectangle selection; PDF report;
a shared fleet package for graph, table and fit code.
