import { expression as e } from "@player-lang/react-dsl";
import type { BindingTemplateInstance } from "@player-lang/react-dsl";
import type { Expression } from "@player-ui/types";
import { Console } from "@devtools-ui/plugin";
import React from "react";
import { VIEWS_IDS, INTERACTIONS } from "../constants";
import { Screen } from "../common";
import { bindings } from "../schema";

const evaluateExpression = e` publish('${INTERACTIONS.EVALUATE_EXPRESSION}', ${bindings.expression}) `;

export const ConsoleView = (
  <Screen
    id={VIEWS_IDS.CONSOLE}
    main={
      <Console
        exp={evaluateExpression as Expression}
        binding={bindings.history as BindingTemplateInstance}
      />
    }
  />
);
