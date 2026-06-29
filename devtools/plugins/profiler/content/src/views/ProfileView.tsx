import React from "react";
import { FlameGraph } from "@devtools-ui/plugin";
import { expression as e, binding as b } from "@player-tools/dsl";
import type {
  BindingTemplateInstance,
  ExpressionTemplateInstance,
} from "@player-tools/dsl";
import { VIEWS_IDS } from "../constants";
import { Screen, ProfilerFooter } from "../common";
import { bindings } from "../schema";

// `rootNode.value` is populated at runtime by the transform, so reference it
// directly rather than through the schema-derived bindings.
const width = e`${b`rootNode.value`} / 200`;

export const ProfileView = (
  <Screen
    id={VIEWS_IDS.PROFILE}
    main={
      <FlameGraph
        binding={bindings.rootNode as BindingTemplateInstance}
        width={width as ExpressionTemplateInstance<number>}
      />
    }
    footer={ProfilerFooter}
  />
);
