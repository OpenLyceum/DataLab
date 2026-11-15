/**
 * decodeText.ts
 *
 * Turns the bytes of a data file into text. Pure, no SceneryStack imports.
 *
 * Lab files are not always UTF-8: Excel on Windows writes "CSV" in Windows-1252
 * and "Unicode text" in UTF-16. Read as UTF-8, their "°C" and "µs" headers come
 * out as replacement characters. The byte-order mark decides when there is one;
 * otherwise the bytes are UTF-8 if they are valid UTF-8 and Windows-1252 if not.
 */

export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
