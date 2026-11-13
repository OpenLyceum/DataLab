/**
 * Memory-leak regression suite (fleet standard).
 *
 * List every model/view object that links Properties, adds listeners, or owns child
 * nodes, with a factory that builds a fresh instance. The shared harness in
 * tests/helpers/memoryLeak.ts (template-owned) checks that each one is garbage
 * collected after dispose() and leaves no survivors across repeated cycles.
 *
 * Data Lab builds its model and view once and keeps them for the life of the page
 * (the ScreenView is `isDisposable: false`), so nothing is created and disposed at
 * run time. The list is empty until a short-lived object is added.
 */

import { describeDisposalLeaks } from "./helpers/memoryLeak.js";

describeDisposalLeaks([]);
