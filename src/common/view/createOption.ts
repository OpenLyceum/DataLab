/**
 * createOption.ts
 *
 * Builds an <option> through document.createElement rather than the legacy
 * `new Option()` constructor, which happy-dom (unit tests, headless soak) lacks.
 */

export function createOption(text: string, value: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.text = text;
  option.value = value;
  return option;
}
