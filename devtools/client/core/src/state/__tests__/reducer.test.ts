import { describe, expect, test } from "vitest";
import type {
  ExtensionState,
  Transaction,
  DevtoolsDataChangeEvent,
  PlayerInitEvent,
  DevtoolsFlowChangeEvent,
  DevtoolsEventsBatchEvent,
  PlayerStoppedEvent,
  ExtensionSelectedPlayerEvent,
  ExtensionSelectedPluginEvent,
} from "@player-devtools/types";
import type { Flow } from "@player-ui/player";
import { reducer } from "../reducer";
import { INITIAL_EXTENSION_STATE } from "../../constants";

/** Minimal flow fixture used to exercise the reducer's flow handling. */
const INITIAL_FLOW: Flow = {
  id: "initial-flow",
  views: [
    {
      id: "view-1",
      type: "text",
      value: "connecting...",
    },
  ],
  navigation: {
    BEGIN: "FLOW_1",
    FLOW_1: {
      startState: "VIEW_1",
      VIEW_1: {
        state_type: "VIEW",
        ref: "view-1",
        transitions: {},
      },
    },
  },
};

const mockPlayerInitTransaction: Transaction<PlayerInitEvent> = {
  id: 1,
  timestamp: Date.now(),
  sender: "sender-id",
  target: "target-id",
  context: "player",
  _messenger_: true,
  type: "PLAYER_DEVTOOLS_PLAYER_INIT",
  payload: {
    plugins: {
      "plugin-id": {
        id: "plugin-id",
        description: "Plugin Description",
        flow: INITIAL_FLOW,
        name: "Plugin Name",
        version: "1.0.0",
      },
    },
  },
};

const mockPlayerFlowChangeTransaction: Transaction<DevtoolsFlowChangeEvent> = {
  id: 2,
  timestamp: Date.now(),
  sender: "sender-id",
  target: "target-id",
  context: "player",
  _messenger_: true,
  type: "PLAYER_DEVTOOLS_PLUGIN_FLOW_CHANGE",
  payload: {
    flow: {
      ...INITIAL_FLOW,
      data: {
        key: "value",
      },
    },
    pluginID: "plugin-id",
  },
};

const mockPluginDataChangeTransaction: Transaction<DevtoolsDataChangeEvent> = {
  id: 2,
  timestamp: Date.now(),
  sender: "sender-id",
  target: "target-id",
  context: "player",
  _messenger_: true,
  type: "PLAYER_DEVTOOLS_PLUGIN_DATA_CHANGE",
  payload: {
    data: {
      key: "value",
    },
    pluginID: "plugin-id",
  },
};

const mockEventBatchTransaction: Transaction<DevtoolsEventsBatchEvent> = {
  id: 4,
  timestamp: Date.now(),
  sender: "sender-id",
  target: "target-id",
  context: "player",
  _messenger_: true,
  type: "MESSENGER_EVENT_BATCH",
  payload: {
    events: [
      mockPlayerInitTransaction,
      mockPlayerFlowChangeTransaction,
      mockPluginDataChangeTransaction,
    ],
  },
};

const mockPlayerStoppedTransaction: Transaction<PlayerStoppedEvent> = {
  id: 5,
  timestamp: Date.now(),
  sender: "sender-id",
  target: "target-id",
  context: "player",
  _messenger_: true,
  type: "PLAYER_DEVTOOLS_PLAYER_STOPPED",
  payload: null,
};

const mockPlayerSelectedTransaction: Transaction<ExtensionSelectedPlayerEvent> =
  {
    id: 6,
    timestamp: Date.now(),
    sender: "sender-id",
    target: "target-id",
    context: "player",
    _messenger_: true,
    type: "PLAYER_DEVTOOLS_PLAYER_SELECTED",
    payload: {
      playerID: "player-id",
    },
  };

const mockPluginSelectedTransaction: Transaction<ExtensionSelectedPluginEvent> =
  {
    id: 7,
    timestamp: Date.now(),
    sender: "sender-id",
    target: "target-id",
    context: "player",
    _messenger_: true,
    type: "PLAYER_DEVTOOLS_PLUGIN_SELECTED",
    payload: {
      pluginID: "plugin-id",
    },
  };

describe("reducer", () => {
  test("PLAYER_DEVTOOLS_PLAYER_INIT", () => {
    const newState = reducer(
      INITIAL_EXTENSION_STATE,
      mockPlayerInitTransaction,
    );

    expect(newState).toMatchInlineSnapshot(`
      {
        "current": {
          "player": "sender-id",
          "plugin": "plugin-id",
        },
        "players": {
          "sender-id": {
            "active": true,
            "plugins": {
              "plugin-id": {
                "description": "Plugin Description",
                "flow": {
                  "id": "initial-flow",
                  "navigation": {
                    "BEGIN": "FLOW_1",
                    "FLOW_1": {
                      "VIEW_1": {
                        "ref": "view-1",
                        "state_type": "VIEW",
                        "transitions": {},
                      },
                      "startState": "VIEW_1",
                    },
                  },
                  "views": [
                    {
                      "id": "view-1",
                      "type": "text",
                      "value": "connecting...",
                    },
                  ],
                },
                "id": "plugin-id",
                "name": "Plugin Name",
                "version": "1.0.0",
              },
            },
          },
        },
      }
    `);
  });

  test("PLAYER_DEVTOOLS_PLUGIN_FLOW_CHANGE", () => {
    const newState = reducer(
      INITIAL_EXTENSION_STATE,
      mockPlayerFlowChangeTransaction,
    );

    expect(newState).toMatchInlineSnapshot(`
      {
        "current": {
          "player": null,
          "plugin": null,
        },
        "players": {
          "sender-id": {
            "plugins": {
              "plugin-id": {
                "flow": {
                  "data": {
                    "key": "value",
                  },
                  "id": "initial-flow",
                  "navigation": {
                    "BEGIN": "FLOW_1",
                    "FLOW_1": {
                      "VIEW_1": {
                        "ref": "view-1",
                        "state_type": "VIEW",
                        "transitions": {},
                      },
                      "startState": "VIEW_1",
                    },
                  },
                  "views": [
                    {
                      "id": "view-1",
                      "type": "text",
                      "value": "connecting...",
                    },
                  ],
                },
              },
            },
          },
        },
      }
    `);
  });

  test("PLAYER_DEVTOOLS_PLUGIN_DATA_CHANGE", () => {
    const newState = reducer(
      INITIAL_EXTENSION_STATE,
      mockPluginDataChangeTransaction,
    );

    expect(newState).toMatchInlineSnapshot(`
      {
        "current": {
          "player": null,
          "plugin": null,
        },
        "players": {
          "sender-id": {
            "plugins": {
              "plugin-id": {
                "flow": {
                  "data": {
                    "key": "value",
                  },
                },
              },
            },
          },
        },
      }
    `);
  });

  test("MESSENGER_EVENT_BATCH", () => {
    const newState = reducer(
      INITIAL_EXTENSION_STATE,
      mockEventBatchTransaction,
    );

    expect(newState).toMatchInlineSnapshot(`
      {
        "current": {
          "player": "sender-id",
          "plugin": "plugin-id",
        },
        "players": {
          "sender-id": {
            "active": true,
            "plugins": {
              "plugin-id": {
                "description": "Plugin Description",
                "flow": {
                  "data": {
                    "key": "value",
                  },
                  "id": "initial-flow",
                  "navigation": {
                    "BEGIN": "FLOW_1",
                    "FLOW_1": {
                      "VIEW_1": {
                        "ref": "view-1",
                        "state_type": "VIEW",
                        "transitions": {},
                      },
                      "startState": "VIEW_1",
                    },
                  },
                  "views": [
                    {
                      "id": "view-1",
                      "type": "text",
                      "value": "connecting...",
                    },
                  ],
                },
                "id": "plugin-id",
                "name": "Plugin Name",
                "version": "1.0.0",
              },
            },
          },
        },
      }
    `);
  });

  describe("PLAYER_DEVTOOLS_PLAYER_STOPPED", () => {
    const initWith = (...ids: Array<string>) =>
      ids.reduce(
        (state, id) =>
          reducer(state, { ...mockPlayerInitTransaction, sender: id }),
        INITIAL_EXTENSION_STATE,
      );

    test("removes the player", () => {
      const state = reducer(
        initWith("sender-id"),
        mockPlayerStoppedTransaction,
      );

      expect(state.players).toEqual({});
    });

    test("leaves other players alone", () => {
      const state = reducer(
        initWith("sender-id", "other-id"),
        mockPlayerStoppedTransaction,
      );

      expect(Object.keys(state.players)).toEqual(["other-id"]);
    });

    test("moves the selection off a removed player", () => {
      const before = initWith("other-id", "sender-id");
      expect(before.current.player).toBe("sender-id");

      const state = reducer(before, mockPlayerStoppedTransaction);

      expect(state.current.player).toBe("other-id");
      expect(state.current.plugin).toBe("plugin-id");
    });

    test("selects a plugin the new player actually has", () => {
      const withPlugin = (
        state: ExtensionState,
        id: string,
        pluginID: string,
      ) =>
        reducer(state, {
          ...mockPlayerInitTransaction,
          sender: id,
          payload: {
            plugins: {
              [pluginID]: {
                ...mockPlayerInitTransaction.payload.plugins["plugin-id"]!,
                id: pluginID,
              },
            },
          },
        });
      // The selected player only has "basic". The other one only has "profiler".
      let before = withPlugin(INITIAL_EXTENSION_STATE, "other-id", "profiler");
      before = withPlugin(before, "sender-id", "basic");
      expect(before.current).toEqual({
        player: "sender-id",
        plugin: "profiler",
      });
      before = reducer(before, {
        ...mockPlayerSelectedTransaction,
        payload: { playerID: "sender-id" },
      });
      before = reducer(before, {
        ...mockPluginSelectedTransaction,
        payload: { pluginID: "basic" },
      });

      const state = reducer(before, mockPlayerStoppedTransaction);

      expect(state.current).toEqual({ player: "other-id", plugin: "profiler" });
    });

    test("clears the selection when the last player is removed", () => {
      const state = reducer(
        initWith("sender-id"),
        mockPlayerStoppedTransaction,
      );

      expect(state.current).toEqual({ player: null, plugin: null });
    });

    test("keeps the selection when a different player is removed", () => {
      const state = reducer(
        initWith("sender-id", "other-id"),
        mockPlayerStoppedTransaction,
      );

      expect(state.current.player).toBe("other-id");
    });

    test("is a no-op for an unknown player", () => {
      const state = reducer(
        INITIAL_EXTENSION_STATE,
        mockPlayerStoppedTransaction,
      );

      expect(state).toEqual(INITIAL_EXTENSION_STATE);
    });

    describe("with a pluginID", () => {
      const stopped = (pluginID: string) => ({
        ...mockPlayerStoppedTransaction,
        payload: { pluginID },
      });
      const initPlugin = (state: ExtensionState, pluginID: string) =>
        reducer(state, {
          ...mockPlayerInitTransaction,
          payload: {
            plugins: {
              [pluginID]: {
                ...mockPlayerInitTransaction.payload.plugins["plugin-id"]!,
                id: pluginID,
              },
            },
          },
        });
      const twoPlugins = () =>
        initPlugin(initPlugin(INITIAL_EXTENSION_STATE, "plugin-a"), "plugin-b");

      test("keeps the player while other plugins remain", () => {
        const state = reducer(twoPlugins(), stopped("plugin-a"));

        expect(Object.keys(state.players["sender-id"]!.plugins)).toEqual([
          "plugin-b",
        ]);
        expect(state.current.player).toBe("sender-id");
      });

      test("removes the player when its last plugin stops", () => {
        const state = reducer(
          reducer(twoPlugins(), stopped("plugin-a")),
          stopped("plugin-b"),
        );

        expect(state.players).toEqual({});
        expect(state.current).toEqual({ player: null, plugin: null });
      });

      test("moves the selected plugin off a removed one", () => {
        const before = twoPlugins();
        expect(before.current.plugin).toBe("plugin-a");

        const state = reducer(before, stopped("plugin-a"));

        expect(state.current.plugin).toBe("plugin-b");
      });
    });

    test("a re-announce after removal re-adds the player (same ID reuse)", () => {
      const stopped = reducer(
        initWith("sender-id"),
        mockPlayerStoppedTransaction,
      );
      const state = reducer(stopped, mockPlayerInitTransaction);

      expect(Object.keys(state.players)).toEqual(["sender-id"]);
      expect(state.current.player).toBe("sender-id");
    });
  });

  test("PLAYER_DEVTOOLS_PLAYER_SELECTED", () => {
    const newState = reducer(
      INITIAL_EXTENSION_STATE,
      mockPlayerSelectedTransaction,
    );

    expect(newState).toMatchInlineSnapshot(`
      {
        "current": {
          "player": "player-id",
          "plugin": null,
        },
        "players": {},
      }
    `);
  });

  test("PLAYER_DEVTOOLS_PLUGIN_SELECTED", () => {
    const newState = reducer(
      INITIAL_EXTENSION_STATE,
      mockPluginSelectedTransaction,
    );

    expect(newState).toMatchInlineSnapshot(`
      {
        "current": {
          "player": null,
          "plugin": "plugin-id",
        },
        "players": {},
      }
    `);
  });
});
