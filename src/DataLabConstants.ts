/**
 * DataLabConstants.ts
 *
 * Central repository for every named numeric constant used across the
 * simulation. Bare numbers that carry semantic meaning (sizes, margins,
 * physics defaults, ranges) belong here rather than inline in model or view
 * code, so they are named, documented, and changed in one place.
 *
 * Conventions
 * ───────────
 *  - Physics / model values use SI units (metres, seconds, kilograms, …);
 *    note the unit in a comment on each value.
 *  - Layout / chrome values are in screen pixels.
 *  - Colour strings live in DataLabColors.ts, not here.
 *  - Computed expressions (e.g. `2 * Math.PI`) may stay inline.
 *
 */

import DataLabNamespace from "./DataLabNamespace.js";

// ── Layout / chrome (screen pixels) ───────────────────────────────────────────

/** Margin between the screen edge and edge-anchored controls (e.g. Reset All). */
export const SCREEN_VIEW_MARGIN = 20;

/** Corner radius shared by control panels and dialogs. */
export const PANEL_CORNER_RADIUS = 6;

/** Vertical gap between panels stacked in a column. */
export const COLUMN_SPACING = 10;

/** Font size of buttons, labels and HTML form controls. */
export const CONTROL_FONT_SIZE = 12;

// ── Data table (left column) ──────────────────────────────────────────────────

export const TABLE_WIDTH = 290;
export const TABLE_HEIGHT = 500;

// ── Graphs (middle column) ────────────────────────────────────────────────────

/** x of the plot rectangle's left edge; the y tick labels and axis label sit to its left. */
export const PLOT_LEFT = 380;
export const PLOT_WIDTH = 385;
export const PLOT_HEIGHT = 270;

/** Gap between the main graph and the residual graph beneath it. */
export const RESIDUAL_PLOT_GAP = 20;
export const RESIDUAL_PLOT_HEIGHT = 110;

/** Fraction of the data's x extent left empty at each side of the graph. */
export const X_AXIS_PADDING = 0.04;

/** Fraction of the selected range left visible at each side after "Zoom to range". */
export const ZOOM_PADDING = 0.15;

// ── Controls (right column and range fields) ──────────────────────────────────

export const RIGHT_COLUMN_WIDTH = 212;
export const SELECT_WIDTH = 186;
export const RANGE_FIELD_WIDTH = 78;

// ── Export ────────────────────────────────────────────────────────────────────

export const EXPORT_FILE_NAME = "data-lab.csv";

DataLabNamespace.register("DataLabConstants", {
  SCREEN_VIEW_MARGIN,
  PANEL_CORNER_RADIUS,
  COLUMN_SPACING,
  CONTROL_FONT_SIZE,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  PLOT_LEFT,
  PLOT_WIDTH,
  PLOT_HEIGHT,
  RESIDUAL_PLOT_GAP,
  RESIDUAL_PLOT_HEIGHT,
  X_AXIS_PADDING,
  ZOOM_PADDING,
  RIGHT_COLUMN_WIDTH,
  SELECT_WIDTH,
  RANGE_FIELD_WIDTH,
  EXPORT_FILE_NAME,
});
