import { formatSignificant, parameterUnit, withUnit } from "../../common/model/formatFit.js";
import { analyzeRange } from "../../common/model/rangeAnalysis.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";

export function showRangeAnalysis(model: DataLabModel): void {
  const labels = StringManager.getInstance().getLabels();
  const x = model.xColumnProperty.value;
  const y = model.yColumnProperty.value;
  const results = analyzeRange(
    x?.values ?? [],
    y?.values ?? [],
    model.rangeProperty.value,
    model.datasetProperty.value.excludedRows ?? [],
  );

  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.dataset["sceneryAllowInput"] = "true";
  dialog.style.cssText = "max-width:min(90vw,32rem);max-height:80vh;font:1rem system-ui";
  dialog.setAttribute("aria-label", labels.rangeAnalysisStringProperty.value);
  const title = document.createElement("h2");
  title.textContent = labels.rangeAnalysisStringProperty.value;
  const note = document.createElement("p");
  note.textContent = results
    ? labels.rangeAnalysisHelpStringProperty.value
    : labels.rangeAnalysisEmptyStringProperty.value;
  dialog.append(title, note);
  if (results) {
    const list = document.createElement("dl");
    const unit = y?.unit ?? "";
    const rows = [
      [labels.rangeCountStringProperty.value, results.count, ""],
      [labels.rangeMeanStringProperty.value, results.mean, unit],
      [labels.rangeDeviationStringProperty.value, results.standardDeviation, unit],
      [labels.rangeMinimumStringProperty.value, results.minimum, unit],
      [labels.rangeMaximumStringProperty.value, results.maximum, unit],
      [labels.rangeSlopeStringProperty.value, results.slope, parameterUnit(x?.unit ?? "", unit, 1)],
      [labels.rangeAreaStringProperty.value, results.area, parameterUnit(x?.unit ?? "", unit, -1)],
    ] as const;
    for (const [label, value, units] of rows) {
      const name = document.createElement("dt");
      name.textContent = label;
      const entry = document.createElement("dd");
      entry.textContent =
        value === null || !Number.isFinite(value)
          ? labels.rangeUnavailableStringProperty.value
          : withUnit(
              units === "" && label === labels.rangeCountStringProperty.value
                ? String(value)
                : formatSignificant(value),
              units,
            );
      list.append(name, entry);
    }
    dialog.append(list);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = labels.closeComparisonStringProperty.value;
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  });
  dialog.append(close);
  document.body.append(dialog);
  dialog.showModal();
}
