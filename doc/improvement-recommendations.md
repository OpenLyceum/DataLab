# Improvement Recommendations — SceneryStack Template

Remaining non-test recommendations for `SceneryStackTemplate/`. Numbering is
preserved for earlier references. Items 1, 4–8, 10–15 are implemented and removed:
`scripts/rename-sim.ts` now documents its token-order invariant and uses word-boundary
identifier replacements; `StringManager` exposes explicit accessibility/preferences
return types; `SimScreenView` includes a listener/disposal example; and
`SimKeyboardHelpContent` includes commented slider/time-control sections. The release
script also runs the existing unit suite before bumping the version.

Former item 3 proposed pinning reusable workflows independently of Baton. The fleet
instead deliberately uses `OpenLyceum/Baton/.github/workflows/*@main`, enforced by
[Baton's conventions](https://github.com/OpenLyceum/Baton/blob/main/CONVENTIONS.md).
Any change to that policy belongs in Baton and its compliance rules before propagation.

## Local Node and npm policy

### 2. Align local Node selection with CI's Node 26 (done)

The template declares `engines.node: ">=26"` (matching CI's Node 26) and a
`devEngines.runtime` entry with `onFail: "error"`, so npm refuses to install or run
scripts on an older local Node. Baton's compliance rule and template manifest require
both, so propagate any change through Baton first. No `.nvmrc` is needed; select the
version locally with `nvm alias default 26`.

### 9. Decide whether to add a fleet `.npmrc`

The template has no root `.npmrc`. `devEngines` (#2) already enforces the local Node version, so
`engine-strict` is unnecessary; make an explicit decision on `fund` and `save-exact` before introducing defaults.
A new template-owned file also needs Baton's root-file allowlist and template manifest
updated before it can be propagated. Keep the decision centralized rather than
adding different npm policies in individual simulations.
