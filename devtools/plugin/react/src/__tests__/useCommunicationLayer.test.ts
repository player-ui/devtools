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

const FLIPPER_PROXY_KEY = Symbol.for("player-ui-devtools/flipper-proxy");

describe("startFlipperConnection", () => {
  beforeEach(() => {
    vi.resetModules();
    start.mockReset();
    addPlugin.mockReset();
    // globalThis mutex survives resetModules(), so clear it manually too
    delete (globalThis as Record<symbol, unknown>)[FLIPPER_PROXY_KEY];
  });

  it("calls flipperClient.start and addPlugin exactly once no matter how many concurrent callers race the bootstrap", async () => {
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

    const { startFlipperConnection, ensureFlipperConnectionStarted } =
      await import("../useCommunicationLayer");

    // capture before it settles - re-calling after reset would restart the bootstrap
    const firstBootstrap = ensureFlipperConnectionStarted();

    startFlipperConnection(vi.fn());

    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => {
      expect(addPlugin).not.toHaveBeenCalled();
    });

    // must resolve, not reject, so an unchecked caller never sees an unhandled rejection
    await expect(firstBootstrap).resolves.toMatchObject({
      status: "failed",
    });

    start.mockResolvedValueOnce(undefined);

    startFlipperConnection(vi.fn());

    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(1));
  });

  it("reconnects via a second onConnect() on the same registered plugin, without re-running start()/addPlugin()", async () => {
    // js-flipper never removes the plugin from its registry on disconnect,
    // so reconnect is just another onConnect() call on the same plugin.
    start.mockResolvedValue(undefined);

    const { startFlipperConnection } = await import("../useCommunicationLayer");

    const messages: unknown[] = [];
    startFlipperConnection((updater) => {
      const result = updater({
        sendMessage: [],
        addListener: [],
        removeListener: [],
      });
      result.addListener.forEach((add) =>
        add((message) => messages.push(message)),
      );
    });

    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(1));

    const registeredPlugin = addPlugin.mock.calls[0][0] as FakePlugin;
    const first = fakeConnection();
    registeredPlugin.onConnect(first.connection);

    registeredPlugin.onDisconnect();

    const second = fakeConnection();
    registeredPlugin.onConnect(second.connection);

    expect(start).toHaveBeenCalledTimes(1);
    expect(addPlugin).toHaveBeenCalledTimes(1);

    // listener registered before the disconnect must survive it
    second.emit({ payload: "hello" });
    expect(messages).toEqual([{ payload: "hello" }]);
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

    // addListener/removeListener resolve on a microtask now, not synchronously
    await Promise.resolve();
    await Promise.resolve();

    emit({ payload: "hello" });

    expect(firstListeners).toEqual([]);
    expect(secondListeners).toEqual([{ payload: "hello" }]);
  });

  it("dedupes the bootstrap across duplicated copies of this module, not just concurrent callers within one copy", async () => {
    // simulates two bundled copies of this module (e.g. two Player plugin
    // versions) via resetModules() + fresh import(); globalThis is what
    // must dedupe them since each has its own module-local state.
    let resolveStart: () => void;
    start.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      }),
    );

    const firstBundle = await import("../useCommunicationLayer");

    vi.resetModules();
    const secondBundle = await import("../useCommunicationLayer");

    expect(secondBundle.startFlipperConnection).not.toBe(
      firstBundle.startFlipperConnection,
    );

    firstBundle.startFlipperConnection(vi.fn());
    secondBundle.startFlipperConnection(vi.fn());

    // only the winner of the global mutex race ever calls start()/addPlugin()
    expect(start).toHaveBeenCalledTimes(1);

    resolveStart!();
    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(1));

    expect(start).toHaveBeenCalledTimes(1);
    expect(addPlugin).toHaveBeenCalledTimes(1);
  });
});
