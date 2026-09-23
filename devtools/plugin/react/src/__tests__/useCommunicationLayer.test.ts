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
    // the bootstrap mutex now lives on globalThis (by design - it must
    // survive module duplication across bundles), so vi.resetModules()
    // alone no longer isolates tests from each other
    delete (globalThis as Record<symbol, unknown>)[FLIPPER_PROXY_KEY];
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

    const { startFlipperConnection, ensureFlipperConnectionStarted } =
      await import("../useCommunicationLayer");

    // capture the first (failing) bootstrap promise before it settles and
    // resets the global mutex - calling ensureFlipperConnectionStarted()
    // again after the reset would kick off a brand-new bootstrap attempt
    // instead of inspecting this one
    const firstBootstrap = ensureFlipperConnectionStarted();

    startFlipperConnection(vi.fn());

    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    // let the rejection's .catch() handler run and reset the mutex
    await vi.waitFor(() => {
      // addPlugin must never have been called for the failed attempt
      expect(addPlugin).not.toHaveBeenCalled();
    });

    // the shared promise must never reject - failure is surfaced as data so
    // a caller that never checks `status` still gets a safe no-op proxy
    // instead of an unhandled rejection
    await expect(firstBootstrap).resolves.toMatchObject({
      status: "failed",
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

    // addListener/removeListener are now proxied through the shared
    // bootstrap promise, so they settle on a microtask rather than
    // synchronously - flush pending microtasks before emitting
    await Promise.resolve();
    await Promise.resolve();

    emit({ payload: "hello" });

    expect(firstListeners).toEqual([]);
    expect(secondListeners).toEqual([{ payload: "hello" }]);
  });

  it("dedupes the bootstrap across duplicated copies of this module, not just concurrent callers within one copy", async () => {
    // Consumers can bundle multiple Player/plugin versions in the same app,
    // each carrying its own copy of useCommunicationLayer.ts (and potentially
    // its own js-flipper version). vi.resetModules() + a fresh dynamic
    // import() simulates that: each import() below is a distinct module
    // registry entry, standing in for a separate bundle, while globalThis -
    // shared across all realms in the same window - is what the mutex must
    // live on for this test to pass.
    let resolveStart: () => void;
    start.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      }),
    );

    const firstBundle = await import("../useCommunicationLayer");

    // the top-level vi.mock("js-flipper", ...) above is hoisted and
    // automatically reapplies to the next fresh import after resetModules()
    vi.resetModules();
    const secondBundle = await import("../useCommunicationLayer");

    expect(secondBundle.startFlipperConnection).not.toBe(
      firstBundle.startFlipperConnection,
    );

    firstBundle.startFlipperConnection(vi.fn());
    secondBundle.startFlipperConnection(vi.fn());

    // only the bundle that wins the race against the shared global mutex
    // may ever call flipperClient.start()/addPlugin() - the second bundle's
    // own (possibly differently-versioned) flipperClient must never be
    // invoked independently
    expect(start).toHaveBeenCalledTimes(1);

    resolveStart!();
    await vi.waitFor(() => expect(addPlugin).toHaveBeenCalledTimes(1));

    expect(start).toHaveBeenCalledTimes(1);
    expect(addPlugin).toHaveBeenCalledTimes(1);
  });
});
