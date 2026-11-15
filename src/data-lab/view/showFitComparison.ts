import { openDialog } from "../../common/view/openDialog.js";
import { StringManager } from "../../i18n/StringManager.js";
import { type FitText, fitSummary } from "./fitText.js";

export function showFitComparison(current: FitText, pinned: FitText): void {
  const labels = StringManager.getInstance().getLabels();
  const { body, button, close, show } = openDialog(labels.compareFitsStringProperty.value, { maxWidth: "90vw" });
  body.style.cssText = "display: flex; flex-wrap: wrap; gap: 1.5rem;";
  for (const [title, result] of [
    [labels.currentFitStringProperty.value, current],
    [labels.pinnedFitStringProperty.value, pinned],
  ] as const) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.margin = "0 0 0.4em";
    const details = document.createElement("p");
    details.style.cssText = "white-space: pre-wrap; max-width: 28ch; margin: 0;";
    details.textContent = fitSummary(result);
    section.append(heading, details);
    body.append(section);
  }
  button(labels.closeComparisonStringProperty.value, close);
  show();
}
