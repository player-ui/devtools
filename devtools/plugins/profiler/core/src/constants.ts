import type { PluginData } from "@player-devtools/types";

export const PLUGIN_ID = "player-ui-profiler-plugin";

export const PLUGIN_NAME = "Player UI Profiler";

export const PLUGIN_DESCRIPTION = "Standard Player UI Profiler";

export const PLUGIN_VERSION = "__VERSION__";

export const VIEWS_IDS = {
  PROFILER: "Profiler",
};

export const INTERACTIONS = {
  START_PROFILING: "start-profiling",
  STOP_PROFILING: "stop-profiling",
};

export const BASE_PLUGIN_DATA: Omit<PluginData, "flow"> = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  description: PLUGIN_DESCRIPTION,
  version: PLUGIN_VERSION,
};
