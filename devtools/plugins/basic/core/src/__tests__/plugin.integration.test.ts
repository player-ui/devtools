// Integration test: runs the plugin against a real Player and context plugin, so nothing is mocked.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Player } from "@player-ui/player";
import {
  ContextPlugin,
  dataContextKey,
  getContextPlugin,
} from "@player-ui/context-plugin";
import type { Flow } from "@player-ui/player";
import { BasicDevtoolsPlugin } from "../plugin";
import { playerConfigContextKey } from "../context";

const makeFlow = (): Flow => ({
  id: "test-flow",
  views: [{ id: "view-1", type: "info" }],
  data: { name: "initial" },
  navigation: {
    BEGIN: "FLOW_1",
    FLOW_1: {
      startState: "VIEW_1",
      VIEW_1: {
        state_type: "VIEW",
        ref: "view-1",
        transitions: { "*": "END_Done" },
      },
      END_Done: { state_type: "END", outcome: "done" },
    },
  },
});

const getPluginData = (plugin: BasicDevtoolsPlugin) =>
  plugin.store.getState().plugins[plugin.pluginID]?.flow?.data as
    | Record<string, unknown>
    | undefined;

describe("BasicDevtoolsPlugin", () => {
  let plugin: BasicDevtoolsPlugin;
  let player: Player;

  beforeEach(() => {
    plugin = new BasicDevtoolsPlugin({
      playerID: "test-id",
      handler: {
        processInteraction: vi.fn(),
        checkIfDevtoolsIsActive: () => true,
      },
    });
    player = new Player({ plugins: [plugin] });
  });

  it("does not subscribe to the context plugin when devtools is inactive", () => {
    const inactive = new BasicDevtoolsPlugin({
      playerID: "inactive-id",
      handler: {
        processInteraction: vi.fn(),
        checkIfDevtoolsIsActive: () => false,
      },
    });
    const inactivePlayer = new Player({ plugins: [inactive] });

    expect(
      inactivePlayer.findPlugin<ContextPlugin>(ContextPlugin.Symbol),
    ).toBeUndefined();
    expect(getPluginData(inactive)).toBeUndefined();
  });

  it("publishes the player config to the context and the store before a flow starts", () => {
    const context = getContextPlugin(player);
    const config = context.get(playerConfigContextKey);

    expect(config?.version).toBe(player.getVersion());
    expect(config?.plugins).toContain("BasicDevtoolsPlugin");
    expect(getPluginData(plugin)?.playerConfig).toEqual(config);
  });

  it("reuses a context plugin that is already registered", () => {
    const existing = new ContextPlugin();
    const sharedPlayer = new Player({
      plugins: [
        existing,
        new BasicDevtoolsPlugin({
          playerID: "shared-id",
          handler: {
            processInteraction: vi.fn(),
            checkIfDevtoolsIsActive: () => true,
          },
        }),
      ],
    });

    expect(existing.get(playerConfigContextKey)?.version).toBe(
      sharedPlayer.getVersion(),
    );
    expect(
      sharedPlayer.getPlugins().filter((p) => p.name === "context"),
    ).toHaveLength(1);
  });

  it("only registers one state context plugin", () => {
    const names = player.getPlugins().map((p) => p.name);

    expect(names.filter((name) => name === "state-context")).toHaveLength(1);
  });

  it("republishes the player config for the next flow after a flow ends", async () => {
    const context = getContextPlugin(player);
    const completed = player.start(makeFlow());
    const state = player.getState();
    if (state.status !== "in-progress") throw new Error("flow not started");
    state.controllers.flow.transition("next");
    await completed;
    // Player fires onEnd in a `finally` after the flow result resolves
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The context store is reset when the flow ends
    expect(context.get(playerConfigContextKey)).toBeUndefined();

    player.start(makeFlow());

    expect(context.get(playerConfigContextKey)?.version).toBe(
      player.getVersion(),
    );
    expect(getPluginData(plugin)?.playerConfig).toEqual(
      context.get(playerConfigContextKey),
    );
  });

  it("does not freeze the flow data owned by Player", () => {
    const flow = makeFlow();
    player.start(flow);
    const state = player.getState();
    if (state.status !== "in-progress") throw new Error("flow not started");
    state.controllers.data.set([["name", "updated"]]);

    expect(Object.isFrozen(flow.data)).toBe(false);
    expect(Object.isFrozen(getPluginData(plugin)?.data)).toBe(true);
    expect(() => state.controllers.data.set([["name", "again"]])).not.toThrow();
  });

  it("stops publishing from a Player's context once applied to another Player", () => {
    const secondPlayer = new Player({ plugins: [plugin] });

    secondPlayer.start({
      ...makeFlow(),
      data: { name: "second" },
    });
    expect(getPluginData(plugin)?.data).toEqual({ data: { name: "second" } });

    // The first Player's context is no longer subscribed to by the plugin
    player.start(makeFlow());

    expect(getPluginData(plugin)?.data).toEqual({ data: { name: "second" } });
  });

  it("dispatches the data model from the context, including the initial data", () => {
    player.start(makeFlow());

    expect(getPluginData(plugin)?.data).toEqual({ data: { name: "initial" } });
  });

  it("dispatches data model updates", () => {
    player.start(makeFlow());
    const state = player.getState();
    if (state.status !== "in-progress") throw new Error("flow not started");

    state.controllers.data.set([["name", "updated"]]);

    expect(getPluginData(plugin)?.data).toEqual({ data: { name: "updated" } });
    expect(getContextPlugin(player).get(dataContextKey)).toEqual({
      name: "updated",
    });
  });

  it("dispatches a clone of the flow on start", () => {
    const flow = makeFlow();
    player.start(flow);

    expect(getPluginData(plugin)?.flow).toEqual(flow);
    expect(plugin.flow).not.toBe(flow);
  });

  it("dispatches logs", () => {
    player.logger.warn("something happened");

    expect(getPluginData(plugin)?.logs).toEqual([
      { severity: "warn", message: ["something happened"] },
    ]);
  });
});
