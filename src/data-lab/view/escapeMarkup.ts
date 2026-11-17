/**
 * escapeMarkup.ts
 *
 * Plain text made safe for a RichText. Spaces stay ordinary spaces (phet-core's
 * escapeHTML turns them into &nbsp;), so the text can still wrap.
 */

export function escapeMarkup(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
