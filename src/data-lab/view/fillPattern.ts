/**
 * fillPattern.ts
 *
 * Fills the `{{name}}` placeholders of a translated pattern string.
 */

export function fillPattern(pattern: string, values: Readonly<Record<string, string | number>>): string {
  return pattern.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) =>
    key in values ? String(values[key]) : placeholder,
  );
}
