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
        const { sender } = transaction;
        dsetAssign(draft, ["players", sender, "active"], false);
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
