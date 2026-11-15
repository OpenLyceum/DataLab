import { formatSignificant, parameterUnit, withUnit } from "../../common/model/formatFit.js";
import { analyzeRange } from "../../common/model/rangeAnalysis.js";
import { openDialog } from "../../common/view/openDialog.js";
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

  const { body, button, close, show } = openDialog(labels.rangeAnalysisStringProperty.value, {
    maxWidth: "min(90vw, 32rem)",
  });
  const note = document.createElement("p");
  note.style.margin = "0";
  note.textContent = results
    ? labels.rangeAnalysisHelpStringProperty.value
    : labels.rangeAnalysisEmptyStringProperty.value;
  body.append(note);
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
    body.append(list);
  }
  button(labels.closeComparisonStringProperty.value, close);
  show();
}
