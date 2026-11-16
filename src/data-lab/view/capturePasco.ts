import { createColumn, type Dataset } from "../../common/model/Dataset.js";
import { canCapturePasco, connectSmartCart } from "../../common/sensors/pascoSmartCart.js";
import { openDialog } from "../../common/view/openDialog.js";
import { PASCO } from "../../DataLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import { fillPattern } from "./fillPattern.js";

export function capturePasco(onCapture: (data: Dataset, name: string) => void): void {
  const labels = StringManager.getInstance().getLabels();
  let controller: AbortController | undefined;
  let closed = false;
  const { body, button, close, show } = openDialog(labels.capturePascoStringProperty.value, {
    onClose: () => {
      closed = true;
      controller?.abort();
    },
  });
  const info = document.createElement("p");
  info.textContent = labels.pascoHelpStringProperty.value;
  info.style.margin = "0";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.style.margin = "0";
  body.append(info, status);
  const times: string[] = [];
  const positions: string[] = [];
  let deviceName = labels.capturePascoStringProperty.value;
  let captureStopped = false;

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
      deviceName = cart.name?.slice(0, PASCO.DEVICE_NAME_MAX_LENGTH) || deviceName;
      status.textContent = labels.pascoRecordingStringProperty.value;
      let position = 0;
      let origin: number | undefined;
      while (!abort.signal.aborted && times.length < PASCO.MAX_SAMPLES) {
        const sent = performance.now();
        const delta = await cart.sample();
        const received = performance.now();
        // The first reading establishes the origin. Later readings are signed increments.
        if (origin === undefined) {
          origin = received;
        } else {
          position += delta;
        }
        times.push(String((received - origin) / PASCO.MILLISECONDS_PER_SECOND));
        positions.push(String(position));
        status.textContent = fillPattern(labels.pascoSamplesStringProperty.value, { count: times.length });
        await new Promise<void>((resolve) =>
          setTimeout(resolve, Math.max(0, PASCO.INTERVAL_MS - (performance.now() - sent))),
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
      } else if (times.length > 0 && (captureStopped || times.length === PASCO.MAX_SAMPLES)) {
        status.textContent = fillPattern(labels.pascoSamplesStringProperty.value, { count: times.length });
      }
      start.disabled = times.length > 0;
    }
  };

  const start = button(labels.pascoStartStringProperty.value, () => {
    // record() reports its own failures in the status line.
    record().catch(() => undefined);
  });
  const stop = button(labels.pascoStopStringProperty.value, () => {
    captureStopped = true;
    controller?.abort();
  });
  stop.disabled = true;
  const save = button(labels.pascoSaveStringProperty.value, () => {
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
    close();
  });
  save.disabled = true;
  button(labels.closeComparisonStringProperty.value, close);
  const supported = canCapturePasco();
  start.disabled = !supported;
  if (!supported) {
    status.textContent = labels.pascoUnavailableStringProperty.value;
  }
  show();
}
