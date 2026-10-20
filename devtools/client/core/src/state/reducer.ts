import type {
  ExtensionState,
  ExtensionSupportedEvents,
  Transaction,
} from "@player-devtools/types";
import { dsetAssign } from "@player-devtools/utils";
import { produce } from "immer";

/** Extension state reducer */
export const reducer = (
  state: ExtensionState,
  transaction: Transaction<ExtensionSupportedEvents>,
): ExtensionState => {
  switch (transaction.type) {
    case "PLAYER_DEVTOOLS_PLAYER_INIT":
      return produce(state, (draft) => {
        const {
          sender,
          payload: { plugins },
        } = transaction;

        const [plugin] = Object.values(plugins);
        if (!plugin) return;

        draft.current.player = sender;
        draft.current.plugin = draft.current.plugin || plugin.id;

        // TODO: Verify this works with multiple plugins
        dsetAssign(draft, ["players", sender, "plugins"], plugins, true);
        dsetAssign(draft.players, [sender, "active"], true);
      });
    case "PLAYER_DEVTOOLS_PLUGIN_FLOW_CHANGE":
      return produce(state, (draft) => {
        const {
          sender,
          payload: { flow, pluginID },
        } = transaction;

        dsetAssign(
          draft,
          ["players", sender, "plugins", pluginID, "flow"],
          flow,
        );
      });
    case "PLAYER_DEVTOOLS_PLUGIN_DATA_CHANGE":
      return produce(state, (draft) => {
        const {
          sender,
          payload: { data, pluginID },
        } = transaction;
        dsetAssign(
          draft,
          ["players", sender, "plugins", pluginID, "flow", "data"],
          data,
        );
      });
    case "MESSENGER_EVENT_BATCH":
      return transaction.payload.events.reduce(reducer, state);
    case "PLAYER_DEVTOOLS_PLAYER_STOPPED":
      return produce(state, (draft) => {
        const { sender, payload } = transaction;
        const player = draft.players[sender];
        if (!player) return;

        // Only drop the player once its last plugin has stopped
        const stoppedPluginID = payload?.pluginID;
        if (stoppedPluginID && player.plugins) {
          delete player.plugins[stoppedPluginID];

          const [remaining] = Object.keys(player.plugins);
          if (remaining) {
            if (
              draft.current.player === sender &&
              draft.current.plugin === stoppedPluginID
            ) {
              draft.current.plugin = remaining;
            }
            return;
          }
        }

        delete draft.players[sender];

        // Move the selection off the removed player
        if (draft.current.player === sender) {
          const nextPlayer = Object.keys(draft.players)[0] ?? null;
          draft.current.player = nextPlayer;

          const nextPlugins = Object.keys(
            (nextPlayer && draft.players[nextPlayer]?.plugins) || {},
          );
          const { plugin } = draft.current;
          if (!plugin || !nextPlugins.includes(plugin)) {
            draft.current.plugin = nextPlugins[0] ?? null;
          }
        }
      });
    case "PLAYER_DEVTOOLS_PLAYER_SELECTED":
      return produce(state, (draft) => {
        const { playerID } = transaction.payload;
        draft.current.player = playerID;
      });
    case "PLAYER_DEVTOOLS_PLUGIN_SELECTED":
      return produce(state, (draft) => {
        const { pluginID } = transaction.payload;
        draft.current.plugin = pluginID;
      });
    default:
      return state;
  }
};
