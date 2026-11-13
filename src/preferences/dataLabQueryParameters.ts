/**
 * dataLabQueryParameters.ts
 *
 * Sim-specific startup query parameters. This is the single place where every
 * sim-specific query parameter is declared and documented. Public-facing
 * parameters (intended for end users / sharing links) must set `public: true`.
 *
 * ── How to add a query parameter ──────────────────────────────────────────────
 * 1. Add an entry below with a `type`, `defaultValue`, and (if user-facing)
 *    `public: true`. Add `isValidValue` to bound numeric ranges.
 * 2. If it should also be user-editable at runtime, surface it as a preference
 *    in DataLabPreferencesModel (initialize that Property from this query parameter).
 *
 * Usage: append e.g. `?showResiduals=false` to the sim URL.
 */

import { logGlobal } from "scenerystack/phet-core";
import { QueryStringMachine } from "scenerystack/query-string-machine";
import DataLabNamespace from "../DataLabNamespace.js";

const dataLabQueryParameters = QueryStringMachine.getAll({
  /**
   * Whether the residual graph is shown under the main graph. Residuals are on by
   * default; an instructor can link to `?showResiduals=false` for a first lab.
   */
  showResiduals: {
    type: "boolean",
    defaultValue: true,
    public: true,
  },
});

DataLabNamespace.register("dataLabQueryParameters", dataLabQueryParameters);

// Log query parameters (for the console / PhET-iO).
logGlobal("phet.chipper.queryParameters");

export default dataLabQueryParameters;
