import type { PluginData } from "@player-devtools/types";
import { PLUGIN_ID } from "./constants";

// Generated via dsl_compile target
import flow from "../_generated/flow.json";

declare global {
  const __VERSION__: string;
}

const PLUGIN_VERSION =
  typeof __VERSION__ !== "undefined" ? __VERSION__ : "unstamped";

export const BasicPluginData: PluginData = {
  id: PLUGIN_ID,
  name: "Standard Devtools",
  description: "Standard Player UI Devtools",
  version: PLUGIN_VERSION,
  flow,
};

export * from "./constants";
