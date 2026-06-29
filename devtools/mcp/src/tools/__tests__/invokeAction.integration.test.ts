import { describe, it, expect, vi, beforeEach } from "vitest";
import { Messenger } from "@player-devtools/messenger";
import { DevtoolsPlugin, type DevtoolsHandler } from "@player-devtools/plugin";
import type {
  CommunicationLayerMethods,
  ExtensionSupportedEvents,
  MessengerOptions,
  PluginData,
  Transaction,
} from "@player-devtools/types";

// NOTE: this test drives the devtools/MCP side with a real Messenger rather
// than `createExtensionClient`, because that factory currently lives in the
// `@player-devtools/client` barrel alongside the React `Panel`, which can't be
// imported in this node test env (it pulls in UI-only CJS deps). The MCP
// handler's playerId→target resolution is unit-tested in select.test.ts; what
// THIS test proves is the other half: real DevtoolsPlugins on a shared bus only
// handle actions addressed to their own playerID. The frame built below is
// exactly what `client.handleInteraction({ target })` emits.

vi.useFakeTimers();

type Frame = Transaction<ExtensionSupportedEvents>;

const PLUGIN_ID = "test-plugin";

function pluginData(): PluginData {
  return {
    id: PLUGIN_ID,
    version: "1.0.0",
    name: "Test Plugin",
    description: "test",
    flow: {
      id: "flow",
      views: [],
      navigation: {},
    } as unknown as PluginData["flow"],
    capabilities: {
      description: "test",
      actions: { next: { description: "advance" } },
      data: {},
    },
  };
}

/**
 * An in-memory message bus shared by every Messenger created against it.
 * Mirrors how the browser extension / Flipper relay every frame to all
 * connected parties — the transport is a dumb broadcast; addressing is the
 * Messenger's job.
 */
function createBus() {
  const listeners = new Set<(event: Frame) => void>();
  const layer: CommunicationLayerMethods = {
    sendMessage: async (message) =>
      listeners.forEach((l) => l(message as Frame)),
    addListener: (cb) => listeners.add(cb as (event: Frame) => void),
    removeListener: (cb) => listeners.delete(cb as (event: Frame) => void),
  };
  return layer;
}

/**
 * Stand up a real DevtoolsPlugin for a player, wired to a real Messenger
 * (id = playerID) on the shared bus — exactly as the platform layer does. The
 * handler's processInteraction is a spy so we can assert which player actually
 * handled an action.
 */
function createPlayer(playerID: string, layer: CommunicationLayerMethods) {
  const processInteraction = vi.fn();
  const handler: DevtoolsHandler = {
    processInteraction,
    checkIfDevtoolsIsActive: () => true,
  };

  const corePlugin = new DevtoolsPlugin({
    playerID,
    pluginData: pluginData(),
    handler,
  });

  const options: MessengerOptions<ExtensionSupportedEvents> = {
    id: playerID,
    context: "player",
    messageCallback: (message) =>
      corePlugin.store.dispatch(
        message as Parameters<typeof corePlugin.store.dispatch>[0],
      ),
    ...layer,
    logger: console,
  };
  const messenger = new Messenger<ExtensionSupportedEvents>(options);
  corePlugin.registerMessenger(messenger);

  // Announce this player to the devtools side so the MCP client knows it
  // exists (handleInvokeAction validates the player is known).
  corePlugin["dispatchPlayerInit"]();

  return { processInteraction, corePlugin, messenger };
}

describe("invoke_action end-to-end routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Messenger.reset();
  });

  function setup() {
    const layer = createBus();
    const playerA = createPlayer("player-a", layer);
    const playerB = createPlayer("player-b", layer);

    // The devtools/MCP-side Messenger. This is the same Messenger that
    // `createExtensionClient` builds internally; we drive it directly to avoid
    // the UI-coupled client barrel.
    const devtools = new Messenger<ExtensionSupportedEvents>({
      id: "devtools",
      context: "devtools",
      messageCallback: () => {},
      ...layer,
      logger: console,
    });

    // Let beacons/handshakes settle so connections are established both ways.
    vi.advanceTimersByTime(2000);

    /**
     * Emit the exact frame `client.handleInteraction({ type, target })` sends
     * for an `invoke_action` resolved to `target`.
     */
    const invokeOn = (target: string) =>
      devtools.sendMessage({
        type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
        payload: { type: "next" },
        target,
      } as unknown as ExtensionSupportedEvents);

    /**
     * Emit the broadcast `player-selected` interaction that `client.selectPlayer`
     * sends (no target — goes to every player).
     */
    const selectPlayer = (playerID: string) =>
      devtools.sendMessage({
        type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
        payload: { type: "player-selected", payload: playerID },
      } as unknown as ExtensionSupportedEvents);

    return { devtools, invokeOn, selectPlayer, playerA, playerB };
  }

  it("delivers an action only to the targeted player", () => {
    const { invokeOn, playerA, playerB } = setup();

    invokeOn("player-b");
    vi.advanceTimersByTime(1000);

    expect(playerB.processInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ type: "next" }),
      }),
    );
    expect(playerA.processInteraction).not.toHaveBeenCalled();
  });

  it("delivers to the other player when it is the target (mirror)", () => {
    const { invokeOn, playerA, playerB } = setup();

    invokeOn("player-a");
    vi.advanceTimersByTime(1000);

    expect(playerA.processInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ type: "next" }),
      }),
    );
    expect(playerB.processInteraction).not.toHaveBeenCalled();
  });

  // Regression for the original failing scenario: select a player (a broadcast
  // interaction), then invoke an action on that same player. Before the
  // messenger sequencing fixes, the broadcast advanced the receiver's counter
  // and the follow-up action was dropped as a duplicate. The selected player
  // must receive BOTH, and the other player only the broadcast select.
  it("delivers a follow-up action after selecting the same player", () => {
    const { invokeOn, selectPlayer, playerA, playerB } = setup();

    selectPlayer("player-a");
    invokeOn("player-a");
    vi.advanceTimersByTime(1000);

    const aTypes = playerA.processInteraction.mock.calls.map(
      (c) => (c[0] as { payload?: { type?: string } })?.payload?.type,
    );
    expect(aTypes).toContain("player-selected");
    expect(aTypes).toContain("next");
    // player-selected handled exactly once (no re-entrant double-fire)
    expect(aTypes.filter((t) => t === "player-selected")).toHaveLength(1);

    // player-b saw only the broadcast select, never the targeted action
    const bTypes = playerB.processInteraction.mock.calls.map(
      (c) => (c[0] as { payload?: { type?: string } })?.payload?.type,
    );
    expect(bTypes).not.toContain("next");
  });

  // The MCP handler's playerId→target resolution (including the "no playerId →
  // currently selected player" fallback) is unit-tested in select.test.ts.
});
