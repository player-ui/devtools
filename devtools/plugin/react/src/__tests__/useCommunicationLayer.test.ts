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

  it("retries the bootstrap on a later call after flipperClient.start() rejects", async () => {
    start.mockRejectedValueOnce(new Error("boom"));

    const { startFlipperConnection } = await import("../useCommunicationLayer");

    startFlipperConnection(vi.fn());

    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    // let the rejection's .catch() handler run and reset the mutex
    await vi.waitFor(() => {
      // addPlugin must never have been called for the failed attempt
      expect(addPlugin).not.toHaveBeenCalled();
    });

    start.mockResolvedValueOnce(undefined);

    startFlipperConnection(vi.fn());

    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(1));
  });

  it("re-bootstraps after onDisconnect fires, allowing reconnection", async () => {
    start.mockResolvedValue(undefined);

    const { startFlipperConnection } = await import("../useCommunicationLayer");

    startFlipperConnection(vi.fn());

    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(1));

    const registeredPlugin = addPlugin.mock.calls[0][0] as FakePlugin;
    const { connection } = fakeConnection();
    registeredPlugin.onConnect(connection);

    // simulate Flipper desktop closing / the device connection dropping
    registeredPlugin.onDisconnect();

    // a later call must re-run the full start()/addPlugin() bootstrap
    startFlipperConnection(vi.fn());

    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(2));
  });

  it("re-registers the plugin via addPlugin() after onDisconnect even when start() no-ops because the websocket never dropped", async () => {
    // js-flipper's real FlipperClient.start() is `if (this.ws) { return; }` -
    // the most common disconnect (Flipper desktop sending a plugin-level
    // "deinit") never tears down the websocket, so start() short-circuits on
    // every call after the first and does no reconnect work of its own. The
    // bootstrap must not rely on start() to do anything on retry - it only
    // needs to resolve so addPlugin() runs again and re-registers a fresh
    // plugin object under the shared id.
    start.mockImplementation(() => Promise.resolve());

    const { startFlipperConnection } = await import("../useCommunicationLayer");

    startFlipperConnection(vi.fn());

    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(1));

    const firstPlugin = addPlugin.mock.calls[0][0] as FakePlugin;
    const { connection } = fakeConnection();
    firstPlugin.onConnect(connection);

    // Flipper desktop sends "deinit" for this plugin id; the underlying ws
    // stays open, so a subsequent start() call will short-circuit.
    firstPlugin.onDisconnect();

    startFlipperConnection(vi.fn());

    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    // addPlugin must fire again even though start() did no reconnect work,
    // otherwise the stale plugin object (closed over the disconnected
    // state) stays registered and the plugin never comes back online.
    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(2));

    const secondPlugin = addPlugin.mock.calls[1][0] as FakePlugin;
    expect(secondPlugin.getId()).toBe(firstPlugin.getId());
    expect(secondPlugin).not.toBe(firstPlugin);
  });

  it("removeListener stops a listener from receiving further messages", async () => {
    start.mockResolvedValue(undefined);

    const { startFlipperConnection } = await import("../useCommunicationLayer");

    const firstListeners: unknown[] = [];
    const secondListeners: unknown[] = [];
    let removeFirst: (() => void) | undefined;

    startFlipperConnection((updater) => {
      const result = updater({
        sendMessage: [],
        addListener: [],
        removeListener: [],
      });
      const listener = (message: unknown) => firstListeners.push(message);
      result.addListener.forEach((add) => add(listener));
      removeFirst = () =>
        result.removeListener.forEach((remove) => remove(listener));
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

    removeFirst?.();

    emit({ payload: "hello" });

    expect(firstListeners).toEqual([]);
    expect(secondListeners).toEqual([{ payload: "hello" }]);
  });
});
