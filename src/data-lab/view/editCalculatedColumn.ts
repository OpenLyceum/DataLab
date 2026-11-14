import { columnLabel } from "../../common/model/Dataset.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";

export function editCalculatedColumn(model: DataLabModel, columnIndex?: number): void {
  const labels = StringManager.getInstance().getLabels();
  const { columns } = model.datasetProperty.value;
  const index = columnIndex ?? columns.length;
  const column = columns[index];
  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  // Match Scenery DOM nodes with allowInput enabled for this native modal.
  dialog.dataset["sceneryAllowInput"] = "true";
  const form = document.createElement("form");
  form.style.cssText = "display:grid;gap:0.6em;max-width:26em;max-height:75vh;overflow:auto;font:1rem system-ui";
  const title = column ? labels.editFormulaStringProperty.value : labels.calculatedColumnStringProperty.value;
  const heading = document.createElement("strong");
  heading.textContent = title;
  dialog.setAttribute("aria-label", title);
  const help = document.createElement("div");
  help.textContent = labels.formulaHelpStringProperty.value;
  const references = document.createElement("ul");
  for (let i = 0; i < index; i++) {
    const source = columns[i];
    if (source) {
      const item = document.createElement("li");
      item.textContent = `C${i + 1} = ${columnLabel(source)}`;
      references.append(item);
    }
  }
  form.append(heading, help, references);

  const field = (text: string, value: string) => {
    const label = document.createElement("label");
    label.style.cssText = "display:grid;gap:0.2em";
    label.textContent = text;
    const input = document.createElement("input");
    input.value = value;
    label.append(input);
    form.append(label);
    return input;
  };
  const name = field(labels.formulaNameStringProperty.value, column?.name ?? "");
  name.required = true;
  name.pattern = ".*\\S.*";
  const unit = field(labels.formulaUnitStringProperty.value, column?.unit ?? "");
  const formula = field(labels.formulaStringProperty.value, column?.formula ?? "");
  formula.required = true;
  formula.maxLength = 256;
  formula.addEventListener("input", () => formula.setCustomValidity(""));
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:0.5em";
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = labels.saveFormulaStringProperty.value;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = labels.cancelFormulaStringProperty.value;
  cancel.addEventListener("click", () => dialog.close());
  actions.append(save, cancel);
  form.append(actions);
  const commit = () => {
    if (!form.reportValidity()) {
      return;
    }
    if (model.setCalculatedColumn(index, name.value.trim(), unit.value.trim(), formula.value.trim())) {
      dialog.close();
    } else {
      formula.setCustomValidity(labels.invalidFormulaStringProperty.value);
      formula.reportValidity();
    }
  };
  save.addEventListener("click", commit);
  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.isComposing) {
      event.preventDefault();
      commit();
    }
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  });
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
}
