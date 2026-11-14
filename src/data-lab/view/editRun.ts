import { StringManager } from "../../i18n/StringManager.js";
import type { RunWorkspace } from "../model/RunWorkspace.js";
import { MAX_RUN_NAME_LENGTH } from "../model/sessionFile.js";
import { fillPattern } from "./fillPattern.js";

export function editRun(runs: RunWorkspace, refresh: () => void): void {
  const labels = StringManager.getInstance().getLabels();
  const activeName = runs.names[runs.selectedIndex] ?? "";
  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.dataset["sceneryAllowInput"] = "true";
  dialog.setAttribute("aria-label", labels.manageRunStringProperty.value);
  dialog.style.cssText = "max-width:min(90vw,28rem);font:1rem system-ui";
  const title = document.createElement("h2");
  title.textContent = labels.manageRunStringProperty.value;

  const label = document.createElement("label");
  label.textContent = labels.runNameStringProperty.value;
  label.style.cssText = "display:grid;gap:0.25em;margin-bottom:1em";
  const name = document.createElement("input");
  name.value = activeName;
  name.maxLength = MAX_RUN_NAME_LENGTH;
  name.required = true;
  name.pattern = ".*\\S.*";
  label.append(name);

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:0.5em;flex-wrap:wrap";
  const button = (text: string, action: () => void) => {
    const control = document.createElement("button");
    control.textContent = text;
    control.type = "button";
    control.addEventListener("click", action);
    actions.append(control);
    return control;
  };
  const finish = () => {
    refresh();
    dialog.close();
  };
  const rename = () => {
    if (name.reportValidity()) {
      runs.rename(name.value.trim());
      finish();
    }
  };
  button(labels.saveFormulaStringProperty.value, rename);
  const remove = button(labels.deleteRunStringProperty.value, () => {
    title.textContent = fillPattern(labels.confirmDeleteRunStringProperty.value, { name: activeName });
    label.hidden = true;
    label.style.display = "none";
    actions.replaceChildren();
    button(labels.cancelFormulaStringProperty.value, () => dialog.close()).focus();
    button(labels.deleteRunStringProperty.value, () => {
      runs.remove();
      finish();
    });
  });
  remove.disabled = runs.names.length <= 1;
  button(labels.cancelFormulaStringProperty.value, () => dialog.close());
  name.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      rename();
    }
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  });
  dialog.append(title, label, actions);
  document.body.append(dialog);
  dialog.showModal();
  name.select();
}
