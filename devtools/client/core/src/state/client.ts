import { Messenger } from "@player-devtools/messenger";
import type {
  CommunicationLayerMethods,
  ExtensionState,
  ExtensionSupportedEvents,
} from "@player-devtools/types";
import { useStateReducer } from "@player-devtools/utils";

import { INITIAL_EXTENSION_STATE } from "../constants";
import { reducer } from "./reducer";

const NOOP_ID = -1;

/**
 * Messenger diagnostics go to stderr, never stdout.
 *
 * This client also runs inside the MCP server process, where stdout is the
 * JSON-RPC channel — `console.log` there would corrupt the protocol stream.
 * `console.error` is stderr in Node and a normal console entry in browsers.
 */
const LOGGER = {
  log: (...args: Array<unknown>): void => console.error(...args),
};

export type ExtensionClient = {
  getState: () => ExtensionState;
  subscribe: (fn: (state: ExtensionState) => void) => () => void;
  selectPlayer: (playerID: string) => void;
  selectPlugin: (pluginID: string) => void;
  handleInteraction: (interaction: {
    type: string;
    payload?: string;
    target?: string;
  }) => void;
  destroy: () => void;
};

export const createExtensionClient = (
  communicationLayer: CommunicationLayerMethods,
): ExtensionClient => {
  const store = useStateReducer(reducer, INITIAL_EXTENSION_STATE);

  const messenger = new Messenger<ExtensionSupportedEvents>({
    context: "devtools",
    messageCallback: (message) => store.dispatch(message),
    ...communicationLayer,
    logger: LOGGER,
  });

  const selectPlayer = (playerID: string): void => {
    store.dispatch({
      id: NOOP_ID,
      sender: "internal",
      context: "devtools",
      _messenger_: false,
      timestamp: Date.now(),
      type: "PLAYER_DEVTOOLS_PLAYER_SELECTED",
      payload: { playerID },
    });

    messenger.sendMessage({
      type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
      payload: {
        type: "player-selected",
        payload: playerID,
      },
    });
  };

  const selectPlugin = (pluginID: string): void => {
    store.dispatch({
      id: NOOP_ID,
      sender: "internal",
      context: "devtools",
      _messenger_: false,
      timestamp: Date.now(),
      type: "PLAYER_DEVTOOLS_PLUGIN_SELECTED",
      payload: { pluginID },
    });
  };

  const handleInteraction = ({
    type,
    payload,
    target,
  }: {
    type: string;
    payload?: string;
    /** Player to address; defaults to the currently selected player. */
    target?: string;
  }): void => {
    const resolvedTarget = target ?? store.getState().current.player;
    messenger.sendMessage({
      type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
      payload: { type, payload },
      ...(resolvedTarget ? { target: resolvedTarget } : {}),
    });
  };

  return {
    getState: store.getState,
    subscribe: store.subscribe,
    selectPlayer,
    selectPlugin,
    handleInteraction,
    destroy: () => messenger.destroy(),
  };
};
