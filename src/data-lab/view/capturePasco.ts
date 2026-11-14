import { createColumn, type Dataset } from "../../common/model/Dataset.js";
import { canCapturePasco, connectSmartCart } from "../../common/sensors/pascoSmartCart.js";
import { StringManager } from "../../i18n/StringManager.js";
import { fillPattern } from "./fillPattern.js";

const INTERVAL_MS = 100;
const MAX_SAMPLES = 6000;

export function capturePasco(onCapture: (data: Dataset, name: string) => void): void {
  const labels = StringManager.getInstance().getLabels();
  const dialog = document.createElement("dialog");
  dialog.dataset["sceneryAllowInput"] = "true";
  dialog.setAttribute("aria-label", labels.capturePascoStringProperty.value);
  const heading = document.createElement("h2");
  heading.textContent = labels.capturePascoStringProperty.value;
  const info = document.createElement("p");
  info.textContent = labels.pascoHelpStringProperty.value;
  info.style.maxWidth = "30rem";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const start = document.createElement("button");
  start.textContent = labels.pascoStartStringProperty.value;
  const stop = document.createElement("button");
  stop.textContent = labels.pascoStopStringProperty.value;
  stop.disabled = true;
  const save = document.createElement("button");
  save.textContent = labels.pascoSaveStringProperty.value;
  save.disabled = true;
  const close = document.createElement("button");
  close.textContent = labels.closeComparisonStringProperty.value;
  const previousFocus = document.activeElement;
  const times: string[] = [];
  const positions: string[] = [];
  let deviceName = labels.capturePascoStringProperty.value;
  let controller: AbortController | undefined;
  let captureStopped = false;
  let closed = false;
  const supported = canCapturePasco();
  start.disabled = !supported;
  if (!supported) {
    status.textContent = labels.pascoUnavailableStringProperty.value;
  }

  const record = async () => {
    const abort = new AbortController();
    controller = abort;
    captureStopped = false;
    let endedByDisconnect = false;
    let cart: Awaited<ReturnType<typeof connectSmartCart>> | undefined;
    start.disabled = true;
    stop.disabled = false;
    status.textContent = labels.pascoConnectingStringProperty.value;
    try {
      cart = await connectSmartCart(abort.signal, () => {
        endedByDisconnect = true;
        abort.abort();
      });
      deviceName = cart.name?.slice(0, 80) || deviceName;
      status.textContent = labels.pascoRecordingStringProperty.value;
      let position = 0;
      let origin: number | undefined;
      while (!abort.signal.aborted && times.length < MAX_SAMPLES) {
        const sent = performance.now();
        const delta = await cart.sample();
        const received = performance.now();
        // The first reading establishes the origin. Later readings are signed increments.
        if (origin === undefined) {
          origin = received;
        } else {
          position += delta;
        }
        times.push(String((received - origin) / 1000));
        positions.push(String(position));
        status.textContent = fillPattern(labels.pascoSamplesStringProperty.value, { count: times.length });
        await new Promise<void>((resolve) =>
          setTimeout(resolve, Math.max(0, INTERVAL_MS - (performance.now() - sent))),
        );
      }
    } catch {
      if (!(captureStopped || closed)) {
        status.textContent = labels.pascoFailedStringProperty.value;
      }
    } finally {
      cart?.close();
      stop.disabled = true;
      save.disabled = times.length === 0;
      if (endedByDisconnect) {
        status.textContent = labels.pascoFailedStringProperty.value;
      } else if (times.length > 0 && (captureStopped || times.length === MAX_SAMPLES)) {
        status.textContent = fillPattern(labels.pascoSamplesStringProperty.value, { count: times.length });
      }
      start.disabled = times.length > 0;
    }
  };

  start.addEventListener("click", record);
  stop.addEventListener("click", () => {
    captureStopped = true;
    controller?.abort();
  });
  save.addEventListener("click", () => {
    onCapture(
      {
        rowCount: times.length,
        columns: [
          createColumn(labels.pascoTimeStringProperty.value, "s", times),
          createColumn(labels.pascoPositionStringProperty.value, "m", positions),
        ],
      },
      deviceName,
    );
    dialog.close();
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    closed = true;
    controller?.abort();
    dialog.remove();
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  });
  dialog.append(heading, info, status, start, stop, save, close);
  document.body.append(dialog);
  dialog.showModal();
}
