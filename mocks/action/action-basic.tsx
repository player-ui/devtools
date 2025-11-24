import React from "react";
import { Action, Info } from "@player-ui/reference-assets-plugin-components";
import type { DSLFlow } from "@player-tools/dsl";

const view1 = (
  <Info id="action-view">
    <Info.Title>Action Example</Info.Title>
    <Info.Actions>
      <Action value="next">
        <Action.Label>Continue</Action.Label>
      </Action>
    </Info.Actions>
  </Info>
);

const flow: DSLFlow = {
  id: "action-basic",
  views: [view1],
  navigation: {
    BEGIN: "FLOW_1",
    FLOW_1: {
      startState: "VIEW_1",
      VIEW_1: {
        state_type: "VIEW",
        ref: view1,
        transitions: {
          "*": "END_Done",
        },
      },
      END_Done: {
        state_type: "END",
        outcome: "DONE",
      },
    },
  },
};

export default flow;

// Generated with Cursor by Koriann South - 2025-11-11

