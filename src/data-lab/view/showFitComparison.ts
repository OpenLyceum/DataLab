import { StringManager } from "../../i18n/StringManager.js";
import { type FitText, fitSummary } from "./fitText.js";

export function showFitComparison(current: FitText, pinned: FitText): void {
  const labels = StringManager.getInstance().getLabels();
  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.dataset["sceneryAllowInput"] = "true";
  dialog.setAttribute("aria-label", labels.compareFitsStringProperty.value);
  dialog.style.cssText = "max-width:90vw;max-height:80vh;font:1rem system-ui";
  const comparison = document.createElement("div");
  comparison.style.cssText = "display:flex;flex-wrap:wrap;gap:1.5rem";
  for (const [title, result] of [
    [labels.currentFitStringProperty.value, current],
    [labels.pinnedFitStringProperty.value, pinned],
  ] as const) {
    const section = document.createElement("section");
    const heading = document.createElement("h2");
    heading.textContent = title;
    const details = document.createElement("p");
    details.style.cssText = "white-space:pre-wrap;max-width:28ch";
    details.textContent = fitSummary(result);
    section.append(heading, details);
    comparison.append(section);
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
  dialog.append(comparison, close);
  document.body.append(dialog);
  dialog.showModal();
}
