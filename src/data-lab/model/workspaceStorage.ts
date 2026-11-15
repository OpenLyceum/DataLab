/**
 * workspaceStorage.ts
 *
 * Local recovery of the whole workspace — every run with its table and analysis
 * settings — on this browser and origin, in the same format as a session file.
 */

import { forgetDataset } from "./datasetStorage.js";
import { decodeSession, encodeSession, type RunSession } from "./sessionFile.js";

const STORAGE_KEY = "openlyceum.data-lab.workspace.v1";

/** The stored workspace, or null when there is none or it cannot be read. */
export function restoreWorkspace(legacyName: string): RunSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : decodeSession(raw, legacyName);
  } catch {
    return null;
  }
}

/**
 * Stores the workspace and reports whether it was stored. When it does not fit
 * (storage is full or disabled) the previous copy is removed too: restoring an
 * out-of-date table after a reload would be worse than restoring none.
 */
export function saveWorkspace(session: RunSession): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, encodeSession(session));
    forgetDataset();
    return true;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage is disabled. The live workspace remains usable.
    }
    return false;
  }
}
