import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FlipperPluginConnection } from "js-flipper";

type FakePlugin = {
  getId: () => string;
  onConnect: (conn: FlipperPluginConnection) => void;
  onDisconnect: () => void;
};

const start = vi.fn();
const addPlugin = vi.fn();

vi.mock("js-flipper", () => ({
  flipperClient: {
    start: (...args: unknown[]) => start(...args),
    addPlugin: (plugin: FakePlugin) => addPlugin(plugin),
  },
}));

/** Fake FlipperPluginConnection driving the registered plugin's onConnect/receive. */
function fakeConnection(): {
  connection: FlipperPluginConnection;
  emit: (message: unknown) => void;
} {
  let receiveHandler: ((message: unknown) => void) | undefined;
  const connection = {
    send: vi.fn(),
    receive: vi.fn((_event: string, handler: (message: unknown) => void) => {
      receiveHandler = handler;
    }),
  } as unknown as FlipperPluginConnection;

  return {
    connection,
    emit: (message: unknown) => receiveHandler?.(message),
  };
}

describe("startFlipperConnection", () => {
  beforeEach(() => {
    vi.resetModules();
    start.mockReset();
    addPlugin.mockReset();
  });

  it("calls flipperClient.start and addPlugin exactly once no matter how many concurrent callers race the bootstrap", async () => {
    // mimics the real timing hazard: start() resolves asynchronously, so a second
    // caller can invoke startFlipperConnection() before the first bootstrap settles
    let resolveStart: () => void;
    start.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      }),
    );

    const { startFlipperConnection } = await import("../useCommunicationLayer");

    startFlipperConnection(vi.fn());
    startFlipperConnection(vi.fn());
    startFlipperConnection(vi.fn());

    expect(start).toHaveBeenCalledTimes(1);

    resolveStart!();
    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(1));

    // a caller arriving after the bootstrap already resolved must not restart it
    startFlipperConnection(vi.fn());
    expect(start).toHaveBeenCalledTimes(1);
    expect(addPlugin).toHaveBeenCalledTimes(1);
  });

  it("wires every caller's addListener to the single shared connection, regardless of bootstrap order", async () => {
    start.mockResolvedValue(undefined);

    const { startFlipperConnection } = await import("../useCommunicationLayer");

    const firstListeners: unknown[] = [];
    const secondListeners: unknown[] = [];

    startFlipperConnection((updater) => {
      const result = updater({
        sendMessage: [],
        addListener: [],
        removeListener: [],
      });
      result.addListener.forEach((add) =>
        add((message) => firstListeners.push(message)),
      );
    });

    startFlipperConnection((updater) => {
      const result = updater({
        sendMessage: [],
        addListener: [],
        removeListener: [],
      });
      result.addListener.forEach((add) =>
        add((message) => secondListeners.push(message)),
      );
    });

    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(1));

    const { emit, connection } = fakeConnection();
    const registeredPlugin = addPlugin.mock.calls[0][0] as FakePlugin;
    registeredPlugin.onConnect(connection);

    emit({ payload: "hello" });

    expect(firstListeners).toEqual([{ payload: "hello" }]);
    expect(secondListeners).toEqual([{ payload: "hello" }]);
  });
});
