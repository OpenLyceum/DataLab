/**
 * openDialog.ts
 *
 * One native modal <dialog> for every pop-up of the tool: a title, a body the
 * caller fills, and a row of buttons. It takes the colors of the current profile,
 * accepts input inside a Scenery display, removes itself when closed and returns
 * focus to whatever had it.
 */

import DataLabColors from "../../DataLabColors.js";

export type DialogHandle = {
  readonly dialog: HTMLDialogElement;
  /** The <h2> naming the dialog; its text can be replaced, as for a confirmation. */
  readonly heading: HTMLHeadingElement;
  /** Where the caller puts its content. */
  readonly body: HTMLDivElement;
  /** The row of buttons under the body. */
  readonly actions: HTMLDivElement;
  /** Adds a button to the row. */
  readonly button: (text: string, action: () => void) => HTMLButtonElement;
  readonly show: () => void;
  readonly close: () => void;
};

export type DialogOptions = {
  /** CSS max-width of the dialog. */
  readonly maxWidth?: string;
  /** Runs once, when the dialog closes for any reason (button, Escape). */
  readonly onClose?: () => void;
};

export function openDialog(title: string, options: DialogOptions = {}): DialogHandle {
  const previousFocus = document.activeElement;
  const surface = DataLabColors.controlSurfaceColorProperty.value.toCSS();
  const text = DataLabColors.controlSurfaceTextColorProperty.value.toCSS();
  const border = DataLabColors.tableGridColorProperty.value.toCSS();

  const dialog = document.createElement("dialog");
  // Match Scenery DOM nodes with allowInput enabled for this native modal.
  dialog.dataset["sceneryAllowInput"] = "true";
  dialog.setAttribute("aria-label", title);
  dialog.style.cssText = `max-width: ${options.maxWidth ?? "min(90vw, 30rem)"}; max-height: 85vh; overflow: auto; box-sizing: border-box; font: 1rem system-ui, sans-serif; background: ${surface}; color: ${text}; border: 1px solid ${border}; border-radius: 6px; padding: 1rem 1.25rem;`;

  const heading = document.createElement("h2");
  heading.textContent = title;
  heading.style.cssText = "margin: 0 0 0.6em; font-size: 1.15rem;";
  const body = document.createElement("div");
  body.style.cssText = "display: grid; gap: 0.6em;";
  const actions = document.createElement("div");
  actions.style.cssText = "display: flex; flex-wrap: wrap; gap: 0.5em; margin-top: 1em;";

  const close = () => dialog.close();
  dialog.addEventListener("close", () => {
    options.onClose?.();
    dialog.remove();
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  });
  dialog.append(heading, body, actions);

  return {
    dialog,
    heading,
    body,
    actions,
    button: (label, action) => {
      const control = document.createElement("button");
      control.type = "button";
      control.textContent = label;
      control.style.font = "inherit";
      control.addEventListener("click", action);
      actions.append(control);
      return control;
    },
    show: () => {
      document.body.append(dialog);
      dialog.showModal();
    },
    close,
  };
}
