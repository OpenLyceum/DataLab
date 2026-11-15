import { openDialog } from "../../common/view/openDialog.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { RunWorkspace } from "../model/RunWorkspace.js";
import { MAX_RUN_NAME_LENGTH } from "../model/sessionFile.js";
import { fillPattern } from "./fillPattern.js";

export function editRun(runs: RunWorkspace, refresh: () => void): void {
  const labels = StringManager.getInstance().getLabels();
  const activeName = runs.names[runs.selectedIndex] ?? "";
  const { heading, body, actions, button, close, show } = openDialog(labels.manageRunStringProperty.value, {
    maxWidth: "min(90vw, 28rem)",
  });

  const label = document.createElement("label");
  label.textContent = labels.runNameStringProperty.value;
  label.style.cssText = "display: grid; gap: 0.25em;";
  const name = document.createElement("input");
  name.value = activeName;
  name.maxLength = MAX_RUN_NAME_LENGTH;
  name.required = true;
  name.pattern = ".*\\S.*";
  name.style.font = "inherit";
  label.append(name);
  body.append(label);

  const finish = () => {
    refresh();
    close();
  };
  const rename = () => {
    if (name.reportValidity()) {
      runs.rename(name.value.trim());
      finish();
    }
  };
  button(labels.saveFormulaStringProperty.value, rename);
  const remove = button(labels.deleteRunStringProperty.value, () => {
    heading.textContent = fillPattern(labels.confirmDeleteRunStringProperty.value, { name: activeName });
    body.replaceChildren();
    actions.replaceChildren();
    button(labels.cancelFormulaStringProperty.value, close).focus();
    button(labels.deleteRunStringProperty.value, () => {
      runs.remove();
      finish();
    });
  });
  remove.disabled = runs.names.length <= 1;
  button(labels.cancelFormulaStringProperty.value, close);
  name.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      rename();
    }
  });
  show();
  name.select();
}
