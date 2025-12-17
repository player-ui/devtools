import React from "react";
import {
  Input,
  Info,
  Action,
} from "@player-ui/reference-assets-plugin-components";
import { binding as b } from "@player-tools/dsl";
import type { DSLFlow } from "@player-tools/dsl";

const schema = {
  user: {
    type: "ObjectType",
    properties: {
      name: {
        type: "StringType",
      },
    },
  },
};

const view1 = (
  <Info id="input-view">
    <Info.Title>Input Example</Info.Title>
    <Info.PrimaryInfo>
      <Input id="input-field" binding={b`user.name`}>
        <Input.Label>Enter your name</Input.Label>
      </Input>
    </Info.PrimaryInfo>
    <Info.Actions>
      <Action value="submit">
        <Action.Label>Submit</Action.Label>
      </Action>
    </Info.Actions>
  </Info>
);

const flow: DSLFlow = {
  id: "input-basic",
  views: [view1],
  data: {
    user: {
      name: "",
    },
  },
  schema,
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
