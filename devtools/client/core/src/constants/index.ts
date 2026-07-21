import type { ExtensionState } from "@player-devtools/types";

export const INITIAL_EXTENSION_STATE: ExtensionState = {
  current: {
    player: null,
    plugin: null,
  },
  players: {},
};
