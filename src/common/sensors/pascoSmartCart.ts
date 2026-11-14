/** Smart Cart position channel, per PASCO's pasco_python device library and datasheet. */
const POSITION_SERVICE = "4a5c0003-0000-0000-0000-5c1e741f1c00";
const POSITION_WRITE = "4a5c0003-0002-0000-0000-5c1e741f1c00";
const POSITION_NOTIFY = "4a5c0003-0003-0000-0000-5c1e741f1c00";
const METRES_PER_COUNT = 0.09895 / 816;
const RESPONSE_TIMEOUT_MS = 2000;

interface CartCharacteristic extends EventTarget {
  readonly value?: DataView;
  readonly properties: { readonly write: boolean };
  startNotifications(): Promise<unknown>;
  writeValueWithResponse(bytes: Uint8Array<ArrayBuffer>): Promise<void>;
  writeValueWithoutResponse(bytes: Uint8Array<ArrayBuffer>): Promise<void>;
}

interface CartServer {
  connect(): Promise<CartServer>;
  disconnect(): void;
  getPrimaryService(id: string): Promise<{ getCharacteristic(id: string): Promise<CartCharacteristic> }>;
}

interface CartDevice extends EventTarget {
  readonly name?: string;
  readonly gatt?: CartServer;
}

interface CartBluetooth {
  requestDevice(options: { filters: { namePrefix: string }[]; optionalServices: string[] }): Promise<CartDevice>;
}

function bluetooth(): CartBluetooth | undefined {
  return (navigator as Navigator & { bluetooth?: CartBluetooth }).bluetooth;
}

export function canCapturePasco(): boolean {
  return typeof bluetooth()?.requestDevice === "function";
}

export function decodePositionDelta(value: DataView): number | null {
  if (value.byteLength < 3 || value.getUint8(0) !== 0xc0 || value.getUint8(2) !== 5) {
    return null;
  }
  if (value.getUint8(1) !== 0 || value.byteLength !== 5) {
    throw new Error("PASCO rejected the position request or sent an invalid sample");
  }
  return value.getInt16(3, true) * METRES_PER_COUNT;
}

export async function connectSmartCart(signal: AbortSignal, disconnected: () => void) {
  const api = bluetooth();
  if (!api) {
    throw new Error("Web Bluetooth unavailable");
  }
  const device = await api.requestDevice({
    filters: [{ namePrefix: "Smart Cart" }],
    optionalServices: [POSITION_SERVICE],
  });
  signal.throwIfAborted();
  const server = device.gatt;
  if (!server) {
    throw new Error("No GATT server");
  }
  const close = () => {
    device.removeEventListener("gattserverdisconnected", disconnected);
    server.disconnect();
  };
  try {
    await server.connect();
    signal.throwIfAborted();
    const service = await server.getPrimaryService(POSITION_SERVICE);
    const writer = await service.getCharacteristic(POSITION_WRITE);
    const reader = await service.getCharacteristic(POSITION_NOTIFY);
    await reader.startNotifications();
    signal.throwIfAborted();
    device.addEventListener("gattserverdisconnected", disconnected);
    return {
      close,
      name: device.name,
      sample: () =>
        new Promise<number>((resolve, reject) => {
          const cleanup = () => {
            clearTimeout(timeout);
            reader.removeEventListener("characteristicvaluechanged", onSample);
            signal.removeEventListener("abort", onAbort);
          };
          const fail = (error: unknown) => {
            cleanup();
            reject(error);
          };
          const onAbort = () => fail(signal.reason);
          const onSample = () => {
            try {
              const value = reader.value ? decodePositionDelta(reader.value) : null;
              if (value !== null) {
                cleanup();
                resolve(value);
              }
            } catch (error) {
              fail(error);
            }
          };
          const timeout = setTimeout(() => fail(new Error("PASCO sample timed out")), RESPONSE_TIMEOUT_MS);
          if (signal.aborted) {
            onAbort();
            return;
          }
          signal.addEventListener("abort", onAbort, { once: true });
          reader.addEventListener("characteristicvaluechanged", onSample);
          const command = Uint8Array.of(5, 2);
          (writer.properties.write
            ? writer.writeValueWithResponse(command)
            : writer.writeValueWithoutResponse(command)
          ).catch(fail);
        }),
    };
  } catch (error) {
    close();
    throw error;
  }
}
