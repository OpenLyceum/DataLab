/**
 * fileIO.ts
 *
 * Getting text in and out of the page without a server: the browser's file
 * picker, files dropped on the window, and a download built from a Blob.
 *
 * The picker and drop target follow MolScope's FileOpener; the download follows
 * TrackLab's DataTableNode.
 */

export type TextHandler = (text: string, fileName: string) => void;

/** File types offered by the picker. */
const ACCEPTED_TYPES = ".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain";

/** Shows the browser's file picker and hands the chosen file's text to `handler`. */
export function openTextFile(handler: TextHandler): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ACCEPTED_TYPES;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) {
      file
        .text()
        .then((text) => handler(text, file.name))
        .catch(() => undefined);
    }
  });
  input.click();
}

/** Accepts a file dropped anywhere on the page. Returns a function that removes the listeners. */
export function installDropTarget(handler: TextHandler): () => void {
  const onDragOver = (event: DragEvent) => {
    if (event.dataTransfer?.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };
  const onDrop = (event: DragEvent) => {
    const file = event.dataTransfer?.files[0];
    if (!file) {
      return;
    }
    event.preventDefault();
    file
      .text()
      .then((text) => handler(text, file.name))
      .catch(() => undefined);
  };
  window.addEventListener("dragover", onDragOver);
  window.addEventListener("drop", onDrop);
  return () => {
    window.removeEventListener("dragover", onDragOver);
    window.removeEventListener("drop", onDrop);
  };
}

/** Saves `text` as a file through the browser's download mechanism. */
export function downloadText(text: string, fileName: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  // The anchor must be in the document for the click to start a download in
  // Firefox, and the object URL must outlive the click. Wall-clock setTimeout is
  // deliberate: this is browser plumbing, not simulation time.
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}
