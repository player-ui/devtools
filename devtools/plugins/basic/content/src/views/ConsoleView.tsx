import { expression as e } from "@player-lang/react-dsl";
import type {
  BindingTemplateInstance,
  ExpressionTemplateInstance,
} from "@player-lang/react-dsl";
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
        exp={evaluateExpression as ExpressionTemplateInstance<string>}
        binding={bindings.history as BindingTemplateInstance}
      />
    }
  />
);
