import React from "react";
import { Action, Info, Text } from "@player-ui/reference-assets-plugin-components";
import type { DSLFlow } from "@player-tools/dsl";

const view1 = (
  <Info id="info-view">
    <Info.Title>Welcome to Player UI</Info.Title>
    <Info.PrimaryInfo>
      <Text>This is a basic info view demonstrating the Player UI framework</Text>
    </Info.PrimaryInfo>
    <Info.Actions>
      <Action value="continue">
        <Action.Label>Continue</Action.Label>
      </Action>
    </Info.Actions>
  </Info>
);

const flow: DSLFlow = {
  id: "info-basic",
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

