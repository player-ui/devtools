import React from "react";
import {
  Text,
  Info,
  Action,
} from "@player-ui/reference-assets-plugin-components";
import type { DSLFlow } from "@player-tools/dsl";

const view1 = (
  <Info id="text-view">
    <Info.Title>Text Asset Example</Info.Title>
    <Info.PrimaryInfo>
      <Text>
        This demonstrates the text asset component. You can use it to display
        formatted text content throughout your flows.
      </Text>
    </Info.PrimaryInfo>
    <Info.Actions>
      <Action value="done">
        <Action.Label>Done</Action.Label>
      </Action>
    </Info.Actions>
  </Info>
);

const flow: DSLFlow = {
  id: "text-basic",
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
