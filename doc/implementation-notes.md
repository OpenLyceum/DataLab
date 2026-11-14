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
- Each row has a delete button and each column header has a remove button. The
  table keeps at least one column so students can continue entering data.
- A cell commits on `change` (blur or Enter). Enter and ↓ move down, ↑ moves up,
  Escape restores the model's text.
- A paste containing a tab or newline is treated as a block and written through
  `pasteBlock()`; a single value pastes natively.
- At most 1000 rows are rendered. All rows are still plotted and fitted.

## Graphs

`ChartFrameNode` wraps bamboo's `ChartTransform`, grid, ticks and labels, and
orders spacing and range updates so a tick set never lays out thousands of ticks.
Points are painted on a single canvas (`PointsCanvasNode`).

`GraphView` holds the visible x and y intervals as view state; `null` means
automatic. An automatic x axis shows all valid data, and an automatic y axis fits
the points inside the visible x interval. The selected range lives in the model in
data units, so zooming and panning never change a fit.

Zoom and pan (`GraphGestures.ts`, used by both graphs):

| Gesture | Effect |
|---|---|
| Wheel over the plot | Zoom both axes about the cursor (x alone on the residual graph) |
| Wheel over an axis | Zoom that axis alone |
| Drag an axis | Pan that axis |
| Shift+drag on the plot | Pan both axes |
| Two fingers on the plot | Pinch to zoom, move to pan |
| Auto scale button | Both axes back to automatic |

A second finger abandons a one-finger range gesture and restores the range it
started from. The two pinch pointers are attached to the pinch listener so no
`DragListener` can snag them.

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
residual graph; CSV and graph PNG export; copy results; zoom to range; wheel
and pinch zoom, pan and auto scale on both axes; add and delete rows and
columns; fit status live region; GitHub repository, fleet catalog entry, screenshot and icon.

Remaining for 0.1:

- Bring the HTML controls into the reading order.
- Check the table in Firefox, Safari, on an iPad and with a screen reader
  (only Chromium has been exercised).

Done for 0.2: cubic, inverse and inverse-square fits, per-row exclusion, and
local table recovery after a reload. The reciprocal models include a fitted
constant offset. Undefined reciprocal x values are skipped and reported. Exclusions survive table edits and reloads, and are reflected in the
graph, fit, residuals and CSV export. Recovery includes committed cells, headers
and exclusions. The fit range and zoom start at their defaults on reload.

Also done for 0.2: weighted fits with a y-uncertainty column, vertical error bars,
and reduced χ².

Calculated columns accept arithmetic, powers and common functions. Formulas
reference earlier columns by position (`C1`, `C2`, …), recalculate after table
edits, and survive reload. Calculated cells are read-only and export as values.
A source column stays protected while a formula references it.

A successful fit over a selected range can be pinned while a second range or
model is fitted. The pin is a snapshot shown as a dashed curve and included in
the comparison and copied results. Table edits, axis changes and Reset All clear
the pin. The residual plot and CSV describe the current fit.

Log x and Log y independently change the main plot to base-10 scales. Nonpositive
points on a logarithmic axis are hidden from the graph and counted in the status
announcement. Fit selection, regression, and CSV export still use the original
measurements. The residual plot follows the x scale and keeps its residual axis
linear. Error bars that cross zero on log y are clipped at the graph edge.

All 0.2 features are implemented.

Done for 0.3: versioned JSON session files and range statistics, slope, and
signed area. Sessions restore table data, formulas, exclusions, axes, log
scales, residual visibility, fit configuration, range, and the pinned fit.
Graph zoom is recalculated on open. Range analysis uses valid x–y pairs in
the selected range, omits manually excluded rows, and uses an unweighted
linear slope independent of the fit settings. Trapezoids join consecutive
measured x values after averaging measurements with repeated x.

Nonlinear fitting starts with an exponential growth or decay model. It uses
Levenberg–Marquardt on the original y measurements and supports the optional y
uncertainty column. The reference x₀ is fixed to the smallest x in the fit.

Multiple named runs keep independent tables, axes, ranges, model settings, and
pinned fits. New runs start with a blank table and can be renamed or deleted.
The graph, range analysis, and individual CSV/PNG exports use the active run.
Version 2 session files include all runs and the active run. Version 1 files
open as a single run. Browser reload recovery restores the active table.
Save a session file to reopen the whole workspace.

All 0.3 roadmap items are implemented.

Later: sensor capture over Web Bluetooth; rectangle selection; PDF report;
a shared fleet package for graph, table and fit code.
