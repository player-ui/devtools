import type { PluginData } from "@player-devtools/types";
import { PLUGIN_ID, INTERACTIONS } from "./constants";

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
  capabilities: {
    description:
      "Exposes Player runtime state (flow, data, logs, config) and supports expression evaluation and flow overrides.",
    data: {
      flow: { description: "The currently active Player flow JSON" },
      data: { description: "The current Player data model" },
      logs: {
        description: "Accumulated log messages emitted by the Player runtime",
      },
      playerConfig: {
        description: "Player version and list of registered plugin names",
      },
      history: {
        description:
          "Results of previous expression evaluations in this session",
      },
    },
    actions: {
      [INTERACTIONS.EVALUATE_EXPRESSION]: {
        description:
          "Evaluate a Player expression string and return the result",
        params: {
          payload: {
            type: "string",
            description: "The expression to evaluate",
          },
        },
      },
      [INTERACTIONS.OVERRIDE_FLOW]: {
        description: "Replace the currently running flow with a new flow JSON",
        params: {
          payload: {
            type: "string",
            description: "Stringified flow JSON to load",
          },
        },
      },
    },
  },
};

export * from "./constants";
