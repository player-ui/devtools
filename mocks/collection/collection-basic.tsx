import React from "react";
import {
  Collection,
  Text,
  Info,
  Action,
} from "@player-ui/reference-assets-plugin-components";
import type { DSLFlow } from "@player-tools/dsl";

const view1 = (
  <Info id="collection-view">
    <Info.Title>Collection Example</Info.Title>
    <Info.PrimaryInfo>
      <Collection id="collection-field">
        <Collection.Label>Items</Collection.Label>
        <Collection.Values>
          <Text id="item-1">Item 1</Text>
          <Text id="item-2">Item 2</Text>
          <Text id="item-3">Item 3</Text>
        </Collection.Values>
      </Collection>
    </Info.PrimaryInfo>
    <Info.Actions>
      <Action value="done">
        <Action.Label>Done</Action.Label>
      </Action>
    </Info.Actions>
  </Info>
);

const flow: DSLFlow = {
  id: "collection-basic",
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
