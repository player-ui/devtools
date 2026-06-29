import React from "react";
import { ObjectInspector } from "@devtools-ui/plugin";
import type { BindingTemplateInstance } from "@player-tools/dsl";
import { VIEWS_IDS } from "../constants";
import { Screen, ProfilerFooter } from "../common";
import { bindings } from "../schema";

export const RawView = (
  <Screen
    id={VIEWS_IDS.RAW}
    main={
      <ObjectInspector binding={bindings.rawNodes as BindingTemplateInstance} />
    }
    footer={ProfilerFooter}
  />
);
