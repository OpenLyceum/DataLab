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

import { PhetFont } from "scenerystack/scenery-phet";
import DataLabNamespace from "./DataLabNamespace.js";

// ── Layout / chrome (screen pixels) ───────────────────────────────────────────

/** Margin between the screen edge and edge-anchored controls (e.g. Reset All). */
export const SCREEN_VIEW_MARGIN = 20;

/** Corner radius shared by control panels and dialogs. */
export const PANEL_CORNER_RADIUS = 6;

/** Vertical gap between panels stacked in a column. */
export const COLUMN_SPACING = 10;

/** Font size of buttons, labels and HTML form controls. */
const CONTROL_FONT_SIZE = 12;

// ── Data table (left column) ──────────────────────────────────────────────────

/** The table's height is what the buttons above and below it leave (DataLabScreenView). */
export const TABLE_WIDTH = 300;

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

/** Fraction of the visible points' y extent left empty above and below them. */
export const Y_AXIS_PADDING = 0.08;

/** Fraction of the selected range left visible at each side after "Zoom to range". */
export const ZOOM_PADDING = 0.15;

// ── Controls (right column and range fields) ──────────────────────────────────

export const RIGHT_COLUMN_WIDTH = 212;
export const SELECT_WIDTH = 186;
export const RANGE_FIELD_WIDTH = 78;

// ── Export ────────────────────────────────────────────────────────────────────

export const EXPORT_FILE_NAME = "data-lab.csv";
export const GRAPH_EXPORT_FILE_NAME = "data-lab.png";
export const SESSION_FILE_NAME = "data-lab.session.json";

/** Fonts shared across Scenery text nodes. */
export const FONTS = {
  PREFERENCES_TITLE: new PhetFont({ size: 18, weight: "bold" }),
  PREFERENCES_LABEL: new PhetFont(14),
  CONTROL: new PhetFont(CONTROL_FONT_SIZE),
  CONTROL_BOLD: new PhetFont({ size: CONTROL_FONT_SIZE, weight: "bold" }),
  NOTE: new PhetFont(11),
  RESULTS_TITLE: new PhetFont({ size: 13, weight: "bold" }),
  RESULTS_LINE: new PhetFont(13),
  AXIS_LABEL: new PhetFont(12),
  TICK_LABEL: new PhetFont(10),
} as const;

/** Shared CSS font for HTML form controls that mirror CONTROL_FONT_SIZE. */
export const HTML_CONTROL_FONT = `${CONTROL_FONT_SIZE}px Arial, sans-serif`;

/** Panel margins (px). */
export const PANEL = {
  X_MARGIN: 12,
  Y_MARGIN: 10,
  /** Extra width beyond content so the panel does not hug the text. */
  CONTENT_WIDTH_INSET: 24,
} as const;

/** Screen-layout spacings and button chrome (px). */
export const LAYOUT = {
  /** Additional graph top inset (px). */
  PLOT_TOP_OFFSET: 4,
  /** Width of each rectangle y-range input (px). */
  Y_RANGE_FIELD_WIDTH: 56,
  /** Significant figures displayed in range inputs. */
  RANGE_FIELD_DIGITS: 6,
  /** Graph footer inset from plot left (px). */
  GRAPH_FOOTER_LEFT_INSET: 30,
  /** Gap below residual plot before footer (px). */
  GRAPH_FOOTER_TOP_GAP: 42,
  /** Gap between buttons in a row. */
  BUTTON_ROW_SPACING: 6,
  /** Gap between stacked control groups. */
  STACK_SPACING: 8,
  BUTTON_X_MARGIN: 8,
  BUTTON_Y_MARGIN: 5,
  COMBO_Y_MARGIN: 4,
  BUTTON_MAX_TEXT_WIDTH: 110,
  RUN_SELECT_WIDTH: 120,
  COMBO_LABEL_INSET: 40,
  PANEL_TITLE_INSET: 30,
  STATUS_EXTRA_WIDTH: 40,
  RANGE_UNIT_MAX_WIDTH: 50,
  RANGE_FROM_MAX_WIDTH: 90,
  RANGE_TO_MAX_WIDTH: 30,
  RANGE_Y_MAX_WIDTH: 25,
} as const;

/** Preferences dialog spacing (px). */
export const PREFERENCES_LAYOUT = {
  CONTROL_SPACING: 8,
  SECTION_SPACING: 12,
} as const;

/** Home-screen icon drawing frame (px). */
export const SCREEN_ICONS = {
  WIDTH: 548,
  HEIGHT: 373,
} as const;

/** Chart frame geometry (px) and tick-label limits. */
export const CHART_FRAME = {
  GRID_LINE_WIDTH: 0.5,
  Y_AXIS_STRIP_WIDTH: 56,
  X_LABEL_OFFSET: 20,
  Y_LABEL_OFFSET: 46,
  MAX_TICK_DECIMALS: 6,
  MAX_FIXED_TICK: 1e6,
  DEFAULT_Y_TICK_COUNT: 5,
  X_TICK_COUNT: 6,
} as const;

/** Nice-tick spacing thresholds (dimensionless). */
export const CHART_TICKS = {
  DEFAULT_DIVISIONS: 5,
  UNIT_THRESHOLD: 1.5,
  TWO_THRESHOLD: 3.5,
  FIVE_THRESHOLD: 7.5,
} as const;

/** Data-point drawing (px). */
export const POINTS = {
  RADIUS: 3,
  HOLLOW_LINE_WIDTH: 1,
} as const;

/** Main plot: curve sampling, range handles and keyboard steps. */
export const PLOT = {
  /** Samples along a fitted curve across the visible x span. */
  CURVE_SAMPLES: 120,
  MAX_CURVE_SAMPLES: 4096,
  /** Extra samples per oscillation for high-frequency sine fits. */
  SAMPLES_PER_CYCLE: 24,
  /** Height of the strip under the plot that takes x-axis gestures (px). */
  X_AXIS_STRIP_HEIGHT: 20,
  /** Half-width of the invisible grab strip on a range edge (px). */
  HANDLE_HALF_WIDTH: 11,
  HANDLE_GRIP_RADIUS: 6,
  /** Fit and handle stroke width (px). */
  CURVE_LINE_WIDTH: 2,
  /** Dash pattern for a pinned comparison curve (px). */
  PINNED_DASH: [6, 4] as const,
  /** Shift+arrow moves this fraction of the visible axis. */
  FINE_STEP_FRACTION: 0.01,
  /** Page Up/Down step this many data points. */
  PAGE_POINTS: 10,
  /**
   * With an iterative model and more valid points than this, a range drag is
   * previewed and the fit is made once, on release, instead of on every move.
   */
  LIVE_FIT_MAX_POINTS: 150,
  /** Scale of the exported PNG relative to the on-screen graph. */
  EXPORT_SCALE: 3,
} as const;

/** Residual plot geometry and scaling. */
export const RESIDUAL_PLOT = {
  /** Height of the strip under the residual graph for x-axis gestures (px). */
  X_AXIS_STRIP_HEIGHT: 38,
  /** Target tick count on the short residual y axis. */
  Y_TICK_COUNT: 3,
  /** Headroom above the largest residual, as a multiple of it. */
  Y_HEADROOM: 1.25,
  ZERO_LINE_WIDTH: 1.5,
} as const;

/** Editable HTML data table geometry (px) and limits. */
export const TABLE = {
  FONT: HTML_CONTROL_FONT,
  MIN_CELL_WIDTH: 68,
  SCROLLBAR_ALLOWANCE: 18,
  MARKER_WIDTH: 22,
  ROW_NUMBER_WIDTH: 30,
  REMOVE_BUTTON_WIDTH: 23,
  EXCLUSION_WIDTH: 42,
  CELL_PADDING: "3px 5px",
  /** Rows drawn in the table at a time; every row is still plotted and fitted. */
  ROWS_PER_PAGE: 1000,
} as const;

/** Results panel spacing (px). */
export const RESULTS = {
  LINE_SPACING: 5,
} as const;

/** Axis zoom / pan arithmetic. */
export const AXIS = {
  /** Zoom per wheel notch: the visible span shrinks or grows by this factor. */
  WHEEL_ZOOM_FACTOR: 1.1,
  /**
   * Narrowest span worth showing, relative to the size of the numbers on the axis.
   * Below it, neighbouring tick values are no longer distinct doubles.
   */
  MIN_RELATIVE_SPAN: 1e-9,
  /** Half-width used when padding a zero-width range around a nonzero value. */
  ZERO_SPAN_HALF_FRACTION: 0.5,
} as const;

/** Fit status / results display thresholds. */
export const FIT_DISPLAY = {
  /** Below this many leftover points (n − p), uncertainties come with a caution. */
  CAUTION_DEGREES_OF_FREEDOM: 3,
  /**
   * Reduced χ² outside this interval comes with a caution: the supplied
   * uncertainties are then too small (or the model wrong), or too large.
   */
  REDUCED_CHI_SQUARED_LOW: 0.2,
  REDUCED_CHI_SQUARED_HIGH: 3,
  R_SQUARED_DIGITS: 5,
} as const;

/** Numeric formatting for fit parameters. */
export const FORMAT = {
  /** ECMAScript Number.toFixed precision limit (digits). */
  MAX_FIXED_DECIMALS: 100,
  /** Significant figures kept in an uncertainty (and so in its value). */
  UNCERTAINTY_DIGITS: 2,
  /** Significant figures for a value shown without an uncertainty. */
  DEFAULT_DIGITS: 4,
  /** Outside this magnitude range a number is written with a power of ten. */
  FIXED_MIN: 1e-4,
  FIXED_MAX: 1e6,
} as const;

/** CSV / paste parser. */
export const PARSE = {
  /** Lines sniffed when guessing the delimiter. */
  SNIFF_LINE_COUNT: 20,
} as const;

/** Import dialog. */
export const IMPORT = {
  /** Rows of the parsed table shown in the preview. */
  PREVIEW_ROWS: 8,
} as const;

/** Calculated-column formula limits. */
export const FORMULA = {
  MAX_LENGTH: 256,
} as const;

/** Undo history of table edits. */
export const HISTORY = {
  MAX_UNDO_STEPS: 100,
} as const;

/** Session / run naming. */
export const SESSION = {
  MAX_RUN_NAME_LENGTH: 80,
} as const;

/** Householder QR rank test. */
export const QR = {
  RANK_TOLERANCE: 1e-10,
} as const;

/** Nonlinear exponential least-squares solver. */
export const EXPONENTIAL_FIT = {
  /** Extra exponential rate seeds in normalized x coordinates. */
  RATE_SEEDS: [-1, 1, -5, 5] as const,
  MAX_ITERATIONS: 80,
  STEP_TOLERANCE: 1e-10,
  COST_TOLERANCE: 1e-13,
  /** Cap on |rate| during Levenberg–Marquardt trials (1/data-x). */
  RATE_LIMIT: 350,
  INITIAL_DAMPING: 1e-3,
  MIN_DAMPING: 1e-12,
  DAMPING_DECREASE: 3,
  DAMPING_INCREASE: 10,
  /** Log-rate estimate is clamped to this window before seeding. */
  LOG_RATE_CLAMP: 300,
} as const;

/** Profiled (separable) nonlinear curve fits. */
export const PROFILED_FIT = {
  /** Absolute simplex convergence tolerance in normalized shape coordinates. */
  SIMPLEX_TOLERANCE: 1e-9,
  SEED_SAMPLE_SIZE: 256,
  REFINEMENT_STARTS: 4,
  MAX_ITERATIONS: 160,
  /** Finite-difference step relative to |parameter|. */
  DERIVATIVE_STEP: 1e-6,
  /** Stride scramble for thinning seeds (dimensionless). */
  SEED_STRIDE_SCRAMBLE: 89,
} as const;

/** Curve-model seed search limits. */
export const CURVE_FIT = {
  /** Shared initial simplex step for exponential/power rate shape parameters (dimensionless). */
  SIMPLEX_STEP: 0.09,
  /** Pole seed distances in normalized x coordinates. */
  POLE_OFFSETS: [0.0001, 0.001, 0.01, 0.03, 0.07, 0.15, 0.3, 0.6, 1, 2, 5, 15, 50] as const,
  /** Maximum internal-gap seeds (count). */
  MAX_GAP_SEEDS: 128,
  /** Initial pole step in normalized x coordinates. */
  POLE_STEP: 0.001,
  /** Minimum sinusoidal frequency seeds (count). */
  MIN_FREQUENCY_SEEDS: 8,
  /** Damped-sine decay seeds in normalized x coordinates. */
  DAMPING_SEEDS: [0, 2, 8, -2] as const,
  /** Initial damped-sine decay step (dimensionless). */
  DAMPING_STEP: 0.3,
  /** Gaussian centre seeds in normalized x coordinates. */
  GAUSSIAN_CENTRES: [-0.3, 0, 0.15, 0.3, 0.5, 0.7, 0.85, 1, 1.3] as const,
  /** Gaussian centre lower bound in normalized x coordinates. */
  GAUSSIAN_CENTRE_MIN: -20,
  /** Gaussian centre upper bound in normalized x coordinates. */
  GAUSSIAN_CENTRE_MAX: 21,
  /** Log Gaussian width lower bound (dimensionless). */
  GAUSSIAN_LOG_WIDTH_MIN: -25,
  /** Log Gaussian width upper bound (dimensionless). */
  GAUSSIAN_LOG_WIDTH_MAX: 5,
  /** Gaussian width seeds in normalized x coordinates. */
  GAUSSIAN_WIDTHS: [0.01, 0.025, 0.06, 0.15, 0.35, 0.8, 1.8] as const,
  /** Gaussian centre simplex step in normalized x coordinates. */
  GAUSSIAN_CENTRE_STEP: 0.025,
  /** Log Gaussian width simplex step (dimensionless). */
  GAUSSIAN_LOG_WIDTH_STEP: 0.2,
  /** Maximum normalized prediction error when restoring parameter units. */
  PREDICTION_TOLERANCE: 1e-6,
  MAX_FREQUENCY_SEEDS: 512,
  RATE_SEEDS: [-100, -40, -15, -6, -2, -0.5, -0.1, 0.1, 0.5, 2, 6, 15, 40, 100] as const,
} as const;

/** PASCO Smart Cart capture (SI where noted). */
export const PASCO = {
  /** Wall-clock milliseconds in one second. */
  MILLISECONDS_PER_SECOND: 1000,
  /** Sample interval while streaming (ms of wall clock). */
  INTERVAL_MS: 100,
  /** Hard cap on streamed samples in one capture. */
  MAX_SAMPLES: 6000,
  /** Position scale from encoder counts to metres (m/count). */
  METRES_PER_COUNT: 0.09895 / 816,
  /** GATT write/notify response timeout (ms). */
  RESPONSE_TIMEOUT_MS: 2000,
  /** Truncate Bluetooth device names for the UI (characters). */
  DEVICE_NAME_MAX_LENGTH: 80,
} as const;

/** Settings for data-lab/view/PlotNode.ts. Layout lengths are in px; counts and ratios are dimensionless. */
export const PLOT_NODE_SETTINGS = {
  HANDLE_LINE_WIDTH: 2,
} as const;

/** Component dimensions in px; ratios and control steps are dimensionless; precision counts digits. */
export const FIT_TEXT_SETTINGS = {
  RMSE_FORMAT_SIGNIFICANT_DIGITS: 3, // digits
} as const;

DataLabNamespace.register("DataLabConstants", {
  SCREEN_VIEW_MARGIN,
  PANEL_CORNER_RADIUS,
  COLUMN_SPACING,
  CONTROL_FONT_SIZE,
  TABLE_WIDTH,
  PLOT_LEFT,
  PLOT_WIDTH,
  PLOT_HEIGHT,
  RESIDUAL_PLOT_GAP,
  RESIDUAL_PLOT_HEIGHT,
  X_AXIS_PADDING,
  Y_AXIS_PADDING,
  ZOOM_PADDING,
  RIGHT_COLUMN_WIDTH,
  SELECT_WIDTH,
  RANGE_FIELD_WIDTH,
  EXPORT_FILE_NAME,
  GRAPH_EXPORT_FILE_NAME,
  SESSION_FILE_NAME,
  FONTS,
  HTML_CONTROL_FONT,
  PANEL,
  LAYOUT,
  PREFERENCES_LAYOUT,
  SCREEN_ICONS,
  CHART_FRAME,
  CHART_TICKS,
  POINTS,
  PLOT,
  RESIDUAL_PLOT,
  TABLE,
  RESULTS,
  AXIS,
  FIT_DISPLAY,
  FORMAT,
  PARSE,
  IMPORT,
  FORMULA,
  HISTORY,
  SESSION,
  QR,
  EXPONENTIAL_FIT,
  PROFILED_FIT,
  CURVE_FIT,
  PASCO,
});
