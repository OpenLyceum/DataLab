# Data Lab

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

Plot and analyze your own lab data in the browser. Import a CSV or paste a table,
choose the x and y columns, drag across the graph to select a range, fit a model to
the points in that range, and read the parameters, their uncertainties and the
residuals. Nothing is uploaded: the data stays in the page.

## Features

- Import a CSV file (picker or drag-and-drop) or paste cells from a spreadsheet; comma, tab and semicolon delimiters, decimal commas, units read from headers such as `Time (s)`
- Editable data table; rows used by the fit are marked
- Select a range of x by dragging on the graph, moving its edges with the pointer or keyboard, or typing the bounds
- Proportional, linear and quadratic least-squares fits with parameter uncertainties, units, RMSE and R²
- Residual graph on the same x axis
- Zoom with the wheel or a pinch, pan by dragging an axis, and return with Auto scale; zooming never changes a fit
- Export a CSV with `in_fit`, `fit_value` and `residual` columns; copy the fit results as text
- Bundled sample dataset: a cart that speeds up on a ramp and then coasts on a level track
- Fit engine checked against NIST Statistical Reference Datasets
- English, Spanish, and French; default and projector color profiles; installable and usable offline

## Quick Start

```bash
npm install
npm run icons    # generate PNG icons from public/icons/icon.svg
npm start        # dev server → http://localhost:5173
```

## Scripts

| Command | Description |
|---|---|
| `npm start` / `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run Vitest unit tests (includes memory-leak suite) |
| `npm run test:fuzz` | Optional Playwright fuzz smoke: pointer (`?fuzz`) + keyboard (`?fuzzBoard`), with `?ea`, 30s each |
| `npm run test:fuzz -- 90` | Same fuzz for 90 seconds (`--duration 90` or `FUZZ_DURATION=90` also work) |
| `npm run test:fuzz:quick` | Shorter fuzz smoke (10s) |
| `npm run test:fuzz:long` | Longer fuzz smoke (300s) |
| `npm run check` | TypeScript type check |
| `npm run lint` | Biome lint check |
| `npm run format` | Auto-format all files |
| `npm run fix` | Lint + auto-fix |
| `npm run icons` | Regenerate PNG icons from `public/icons/icon.svg` |
| `npm run release` | `check && lint && build && test`, then version patch + push tags |
| `npm run clean` | Remove `dist/` |
| `npx playwright test tests/browser` | End-to-end workflow tests in Chromium |
| `node scripts/generate-sample.ts` | Rewrite the bundled sample dataset |

New sims start at `version: "0.0.0"` in `package.json`. Bump only when cutting a release (for example `npm version patch` and a matching git tag). Keep `name` in kebab-case; it is separate from the SceneryStack sim identifier in `src/init.ts`, which reads its `version` from `package.json`.

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| [SceneryStack](https://scenerystack.org/) | ^3.0.0 | Simulation framework |
| [Vite](https://vitejs.dev/) | ^8 | Build tool + dev server |
| [TypeScript](https://www.typescriptlang.org/) | ^7 | Type-safe JavaScript |
| [Biome](https://biomejs.dev/) | ^2.5 | Linting + formatting |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | ^2 | PWA + service worker |

## License

GNU Affero General Public License v3.0 — see [OpenLyceum org license](https://github.com/OpenLyceum/.github/blob/main/LICENSE).

## Contributing

See [OpenLyceum contributing guidelines](https://github.com/OpenLyceum/.github/blob/main/CONTRIBUTING.md).
Report bugs via GitHub Issues; use org issue templates.
