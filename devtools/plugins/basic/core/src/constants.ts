import type { PluginData } from "@player-devtools/types";

export const PLUGIN_ID = "player-ui-basic-devtools-plugin";

export const PLUGIN_NAME = "Standard Devtools";

export const PLUGIN_DESCRIPTION = "Standard Player UI Devtools";

// TODO: Ensure this is stamped
export const PLUGIN_VERSION = "__VERSION__";

export const VIEWS_IDS = {
  CONFIG: "Config",
  FLOW: "Flow",
  LOGS: "Logs",
  CONSOLE: "Console",
  EDITOR: "Editor",
};

export const INTERACTIONS = {
  EVALUATE_EXPRESSION: "evaluate-expression",
  OVERRIDE_FLOW: "override-flow",
};

export const BASE_PLUGIN_DATA: Omit<PluginData, "flow"> = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  description: PLUGIN_DESCRIPTION,
  version: PLUGIN_VERSION,
};
