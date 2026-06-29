import type { PluginData } from "@player-devtools/types";
import { PLUGIN_ID } from "./constants";

// Generated via dsl_compile target
import flow from "../_generated/flow.json";

declare global {
  const __VERSION__: string;
}

const PLUGIN_VERSION =
  typeof __VERSION__ !== "undefined" ? __VERSION__ : "unstamped";

export const ProfilerPluginData: PluginData = {
  id: PLUGIN_ID,
  name: "Player UI Profiler",
  description: "Standard Player UI Profiler",
  version: PLUGIN_VERSION,
  flow,
};

export * from "./constants";
