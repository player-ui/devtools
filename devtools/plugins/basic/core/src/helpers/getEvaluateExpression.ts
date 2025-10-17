import { ExpressionEvaluator } from "@player-ui/player";
import { generateUUID } from "@player-devtools/plugin";
import { Evaluation } from "../types";

/**
 * Creates a function to evaluate expressions using an nullable Player-UI's ExpressionEvaluator.
 *
 * This function factory takes an nullable WeakRef to an ExpressionEvaluator and returns
 * a new function that can be used to evaluate expressions. If the ExpressionEvaluator is
 * not available, it returns an error Evaluation. Otherwise, it attempts to evaluate the
 * expression. If the evaluation is successful, it returns the result. If there's an error
 * during evaluation, it captures the error and returns it as part of the Evaluation object.
 */
export const getEvaluateExpression =
  (expressionEvaluator?: WeakRef<ExpressionEvaluator>) =>
  (expression: string): Evaluation => {
    if (!expressionEvaluator) {
      return {
        id: generateUUID(),
        severity: "error",
        result: "Expression evaluator not available",
        expression,
      };
    }

    let result: Evaluation = {
      id: generateUUID(),
      severity: "error",
      result: "Something went wrong",
      expression,
    };

    try {
      expressionEvaluator.deref()?.hooks.onError.intercept({
        call: (error: Error) => {
          throw error;
        },
      });

      const evaluatorResult = expressionEvaluator.deref()?.evaluate(expression);

      result = {
        id: generateUUID(),
        result: evaluatorResult,
        expression,
      };
    } catch (error) {
      if (error instanceof Error) {
        result = {
          id: generateUUID(),
          severity: "error",
          result: error.message,
          expression,
        };
      }
    }

    return result;
  };
