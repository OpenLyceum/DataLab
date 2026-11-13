/**
 * DataLabColors.ts
 *
 * Defines all dynamic colors for the simulation using ProfileColorProperty.
 *
 * Each color has two profiles:
 *   - "default"   — used in standard (dark) mode
 *   - "projector" — used when the user enables Projector Mode in Preferences
 *
 * SceneryStack switches profiles automatically; no manual toggling is needed.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 * Import DataLabColors and pass properties directly to Node's fillProperty or
 * strokeProperty options:
 *
 *   import DataLabColors from "../../DataLabColors.js";
 *
 *   new Rectangle( 0, 0, 100, 50, {
 *     fillProperty: DataLabColors.backgroundColorProperty,
 *   });
 *
 * ── How to add a color ────────────────────────────────────────────────────────
 * Add a new ProfileColorProperty entry to the DataLabColors object below.
 * Always provide both "default" and "projector" values.
 */
import { ProfileColorProperty } from "scenerystack/scenery";
import DataLabNamespace from "./DataLabNamespace.js";

const DataLabColors = {
  /**
   * Background color for the simulation screen.
   * Deep navy in default mode; white in projector mode.
   */
  backgroundColorProperty: new ProfileColorProperty(DataLabNamespace, "background", {
    default: "#1a1a2e",
    projector: "#ffffff",
  }),

  /**
   * Primary accent color for highlights, selected items, and key UI elements.
   * Sky blue in default mode; dark navy in projector mode.
   */
  accentColorProperty: new ProfileColorProperty(DataLabNamespace, "accent", {
    default: "#4fc3f7",
    projector: "#1a1a2e",
  }),

  /**
   * Background fill for control panels and dialogs.
   * Deep blue in default mode; light gray in projector mode.
   */
  panelBackgroundColorProperty: new ProfileColorProperty(DataLabNamespace, "panelBackground", {
    default: "#16213e",
    projector: "#f5f5f5",
  }),

  /**
   * Border/stroke color for control panels and dialogs.
   * Teal-navy in default mode; medium gray in projector mode.
   */
  panelBorderColorProperty: new ProfileColorProperty(DataLabNamespace, "panelBorder", {
    default: "#0f3460",
    projector: "#999999",
  }),

  /**
   * Text color for labels, readouts, and general UI text.
   * Near-white in default mode; near-black in projector mode.
   */
  textColorProperty: new ProfileColorProperty(DataLabNamespace, "text", {
    default: "#e0e0e0",
    projector: "#1a1a1a",
  }),

  // ── Light control surfaces ───────────────────────────────────────────────────
  // White chrome (combo boxes, flat push buttons, editable input fields) stays light
  // in both profiles; its text stays dark. Same values in default and projector mode,
  // but defined here so every color lives in one themeable place.

  /** Fill of light control surfaces: combo-box button/list, editable input fields. */
  controlSurfaceColorProperty: new ProfileColorProperty(DataLabNamespace, "controlSurface", {
    default: "#ffffff",
    projector: "#ffffff",
  }),

  /** Fill of a disabled control surface (grayed-out editable input field). */
  controlSurfaceDisabledColorProperty: new ProfileColorProperty(DataLabNamespace, "controlSurfaceDisabled", {
    default: "#cccccc",
    projector: "#cccccc",
  }),

  /** Text on light control surfaces: combo items, flat-button labels, field values, preferences. */
  controlSurfaceTextColorProperty: new ProfileColorProperty(DataLabNamespace, "controlSurfaceText", {
    default: "#1a1a1a",
    projector: "#1a1a1a",
  }),
  // ── Graphs ───────────────────────────────────────────────────────────────────

  /** Fill of the plot area of both graphs. */
  chartBackgroundColorProperty: new ProfileColorProperty(DataLabNamespace, "chartBackground", {
    default: "#10182f",
    projector: "#ffffff",
  }),

  /** Grid lines inside the plot area. */
  chartGridColorProperty: new ProfileColorProperty(DataLabNamespace, "chartGrid", {
    default: "#33415f",
    projector: "#d9d9d9",
  }),

  /** Data points the fit uses (drawn filled). */
  pointColorProperty: new ProfileColorProperty(DataLabNamespace, "point", {
    default: "#4fc3f7",
    projector: "#0b62a4",
  }),

  /** Data points outside the selected range (drawn hollow). */
  excludedPointColorProperty: new ProfileColorProperty(DataLabNamespace, "excludedPoint", {
    default: "#7d8aa6",
    projector: "#8a8a8a",
  }),

  /** The fitted curve and the edges of the selected range. */
  fitLineColorProperty: new ProfileColorProperty(DataLabNamespace, "fitLine", {
    default: "#ffb74d",
    projector: "#c2410c",
  }),

  /** Translucent band over the selected range. */
  rangeBandColorProperty: new ProfileColorProperty(DataLabNamespace, "rangeBand", {
    default: "rgba(255,183,77,0.16)",
    projector: "rgba(194,65,12,0.12)",
  }),

  // ── Data table (real HTML, so these are read as CSS strings) ─────────────────

  tableHeaderBackgroundColorProperty: new ProfileColorProperty(DataLabNamespace, "tableHeaderBackground", {
    default: "#e3e8f2",
    projector: "#e6e6e6",
  }),

  tableGridColorProperty: new ProfileColorProperty(DataLabNamespace, "tableGrid", {
    default: "#b8c0d0",
    projector: "#b3b3b3",
  }),

  /** Tint of table rows the fit uses. */
  tableIncludedRowColorProperty: new ProfileColorProperty(DataLabNamespace, "tableIncludedRow", {
    default: "#fff1dc",
    projector: "#fde8d8",
  }),

  /** Text of a cell that is not a number. */
  tableInvalidTextColorProperty: new ProfileColorProperty(DataLabNamespace, "tableInvalidText", {
    default: "#b3261e",
    projector: "#b3261e",
  }),
};

export default DataLabColors;
