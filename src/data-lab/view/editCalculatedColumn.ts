import { columnLabel } from "../../common/model/Dataset.js";
import { openDialog } from "../../common/view/openDialog.js";
import { FORMULA } from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";

export function editCalculatedColumn(model: DataLabModel, columnIndex?: number): void {
  const labels = StringManager.getInstance().getLabels();
  const { columns } = model.datasetProperty.value;
  const index = columnIndex ?? columns.length;
  const column = columns[index];
  const title = column ? labels.editFormulaStringProperty.value : labels.calculatedColumnStringProperty.value;
  const { body, button, close, show } = openDialog(title, { maxWidth: "min(90vw, 28em)" });

  const help = document.createElement("div");
  help.textContent = labels.formulaHelpStringProperty.value;
  const references = document.createElement("ul");
  references.style.margin = "0";
  for (let i = 0; i < index; i++) {
    const source = columns[i];
    if (source) {
      const item = document.createElement("li");
      item.textContent = `C${i + 1} = ${columnLabel(source)}`;
      references.append(item);
    }
  }
  const form = document.createElement("form");
  form.style.cssText = "display: grid; gap: 0.6em;";
  body.append(help, references, form);

  const field = (text: string, value: string) => {
    const label = document.createElement("label");
    label.style.cssText = "display: grid; gap: 0.2em;";
    label.textContent = text;
    const input = document.createElement("input");
    input.value = value;
    input.style.font = "inherit";
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
  formula.maxLength = FORMULA.MAX_LENGTH;
  formula.addEventListener("input", () => formula.setCustomValidity(""));

  const commit = () => {
    if (!form.reportValidity()) {
      return;
    }
    if (model.setCalculatedColumn(index, name.value.trim(), unit.value.trim(), formula.value.trim())) {
      close();
    } else {
      formula.setCustomValidity(labels.invalidFormulaStringProperty.value);
      formula.reportValidity();
    }
  };
  button(labels.saveFormulaStringProperty.value, commit);
  button(labels.cancelFormulaStringProperty.value, close);
  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.isComposing) {
      event.preventDefault();
      commit();
    }
  });
  show();
}
