import { describe, it, expect, vi } from "vitest";
import type { Messenger } from "@player-devtools/messenger";
import type { Player } from "@player-ui/player";
import type {
  DevtoolsPluginInteractionEvent,
  ExtensionSupportedEvents,
  PluginData,
  Transaction,
} from "@player-devtools/types";

import { DevtoolsPlugin, type DevtoolsHandler } from "../plugin";

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
  };
}

function setup(playerID = "player-a") {
  const processInteraction = vi.fn();
  const handler: DevtoolsHandler = {
    processInteraction,
    checkIfDevtoolsIsActive: () => true,
  };
  const plugin = new DevtoolsPlugin({
    playerID,
    pluginData: pluginData(),
    handler,
  });
  return { plugin, processInteraction };
}

/** Build an inbound interaction transaction as the messenger would deliver it. */
function interaction(
  type: string,
  payload?: string,
): Transaction<ExtensionSupportedEvents> {
  const event: DevtoolsPluginInteractionEvent = {
    type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
    payload: { type, payload },
  };
  return {
    ...event,
    id: -1,
    sender: "devtools",
    context: "devtools",
    target: "player-a",
    timestamp: 0,
    _messenger_: true,
  } as Transaction<ExtensionSupportedEvents>;
}

describe("DevtoolsPlugin.processInteraction", () => {
  it("processes a plain interaction exactly once", () => {
    const { plugin, processInteraction } = setup();

    plugin.store.dispatch(interaction("next"));

    expect(processInteraction).toHaveBeenCalledTimes(1);
  });

  // Regression: `player-selected` re-enters the store subscriber because it
  // synchronously dispatches SELECTED_PLAYER_CHANGE. Previously the interaction
  // cursor advanced AFTER that dispatch, so the same interaction was processed
  // a second time on re-entry.
  it("processes a player-selected interaction exactly once (no re-entrant double-fire)", () => {
    const { plugin, processInteraction } = setup();

    plugin.store.dispatch(interaction("player-selected", "player-a"));

    expect(processInteraction).toHaveBeenCalledTimes(1);
  });

  it("processes a following interaction after a player-selected (cursor not over-advanced)", () => {
    const { plugin, processInteraction } = setup();

    plugin.store.dispatch(interaction("player-selected", "player-a"));
    plugin.store.dispatch(interaction("next"));

    expect(processInteraction).toHaveBeenCalledTimes(2);
    expect(processInteraction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ type: "next" }),
      }),
    );
  });
});

describe("DevtoolsPlugin.teardown", () => {
  const player = {} as Player;

  /** A fake messenger that records the event types it is sent. */
  function setupWithMessenger() {
    const ctx = setup();
    const sent: Array<string> = [];
    ctx.plugin.registerMessenger({
      sendMessage: (message: { type: string }) => sent.push(message.type),
    } as unknown as Messenger<ExtensionSupportedEvents>);
    return { ...ctx, sent };
  }

  it("sends PLAYER_STOPPED over the messenger after PLAYER_INIT", () => {
    const { plugin, sent } = setupWithMessenger();

    plugin.apply(player);
    plugin.teardown();

    expect(sent).toEqual([
      "PLAYER_DEVTOOLS_PLAYER_INIT",
      "PLAYER_DEVTOOLS_PLAYER_STOPPED",
    ]);
  });

  it("only sends PLAYER_STOPPED once", () => {
    const { plugin, sent } = setupWithMessenger();

    plugin.apply(player);
    plugin.teardown();
    plugin.teardown();

    expect(sent.filter((t) => t === "PLAYER_DEVTOOLS_PLAYER_STOPPED")).toEqual([
      "PLAYER_DEVTOOLS_PLAYER_STOPPED",
    ]);
  });

  it("does nothing if the plugin never announced itself", () => {
    const { plugin, sent } = setupWithMessenger();

    plugin.teardown();

    expect(sent).toEqual([]);
  });

  it("does nothing if devtools was inactive when applied", () => {
    const plugin = new DevtoolsPlugin({
      playerID: "player-a",
      pluginData: pluginData(),
      handler: {
        processInteraction: vi.fn(),
        checkIfDevtoolsIsActive: () => false,
      },
    });
    const sent: Array<string> = [];
    plugin.registerMessenger({
      sendMessage: (message: { type: string }) => sent.push(message.type),
    } as unknown as Messenger<ExtensionSupportedEvents>);

    plugin.apply(player);
    plugin.teardown();

    expect(sent).toEqual([]);
  });

  it("can announce and retire again if re-applied", () => {
    const { plugin, sent } = setupWithMessenger();

    plugin.apply(player);
    plugin.teardown();
    plugin.apply(player);
    plugin.teardown();

    expect(
      sent.filter((t) => t === "PLAYER_DEVTOOLS_PLAYER_STOPPED"),
    ).toHaveLength(2);
  });
});
