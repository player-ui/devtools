import type { PluginData } from "@player-devtools/types";
import { PLUGIN_ID, INTERACTIONS } from "./constants";

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
  capabilities: {
    description:
      "Profiles Player hook execution timing and exposes the result as a flame graph. Supports starting, stopping, and resetting profiling.",
    data: {
      rootNode: {
        description:
          "The captured hook timings as a flame-graph tree (transformed for display)",
      },
      rawNodes: {
        description: "The untransformed captured profiler nodes",
      },
      profiling: {
        description: "Whether profiling is currently running",
      },
      displayFlameGraph: {
        description: "Whether the client should render the flame graph",
      },
    },
    actions: {
      [INTERACTIONS.START_PROFILING]: {
        description: "Start profiling Player hook execution",
      },
      [INTERACTIONS.STOP_PROFILING]: {
        description: "Stop profiling and publish the captured flame-graph data",
      },
      [INTERACTIONS.RESET_PROFILING]: {
        description: "Clear the captured profiler nodes",
      },
    },
  },
};

export * from "./constants";
