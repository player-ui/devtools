import React from "react";
import { Collection, Action, Text } from "@devtools-ui/plugin";
import { expression as e } from "@player-tools/dsl";
import type { Expression } from "@player-tools/dsl";
import { INTERACTIONS } from "../constants";
import { bindings } from "../schema";

const toggleProfiling = e`conditional(${bindings.profiling} === true, publish('${INTERACTIONS.STOP_PROFILING}'), publish('${INTERACTIONS.START_PROFILING}'))`;

const toggleLabel = e`conditional(${bindings.profiling} === true, 'Stop', 'Start')`;

const reset = e`publish('${INTERACTIONS.RESET_PROFILING}')`;

/** Shared footer with a Start/Stop toggle and a Reset action. */
export const ProfilerFooter = (
  <Collection>
    <Collection.Values>
      <Action exp={toggleProfiling as Expression}>
        <Action.Label>
          <Text>{toggleLabel}</Text>
        </Action.Label>
      </Action>
      <Action exp={reset as Expression}>
        <Action.Label>
          <Text>Reset</Text>
        </Action.Label>
      </Action>
    </Collection.Values>
  </Collection>
);
