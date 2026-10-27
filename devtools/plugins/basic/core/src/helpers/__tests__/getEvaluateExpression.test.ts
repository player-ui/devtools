import { describe, it, expect, vi } from "vitest";
import type { ExpressionEvaluator } from "@player-ui/player";
import { getEvaluateExpression } from "../getEvaluateExpression";
import type { Evaluation } from "../../types";

vi.mock("@player-devtools/plugin", () => ({
  generateUUID: () => "test-uuid",
}));

/** The subset of the `onError` hook interceptor that `getEvaluateExpression` registers */
type MockInterceptor = { call?: (error: Error) => void };

const getMockExpressionEvaluator = (
  evaluate: ReturnType<typeof vi.fn>,
  throwError = false,
): {
  interceptor: MockInterceptor;
  evaluate: (...args: unknown[]) => unknown;
  hooks: {
    onError: {
      intercept: (args: MockInterceptor) => void;
    };
  };
} => {
  class MockExpressionEvaluator {
    interceptor: MockInterceptor = {};
    evaluate(...args: unknown[]) {
      if (throwError) {
        throw new Error("Evaluation error");
      }
      return evaluate(...args);
    }
    hooks = {
      onError: {
        intercept: (args: MockInterceptor) => {
          this.interceptor = args;
        },
      },
    };
  }
  return new MockExpressionEvaluator();
};

/**
 * The mock only implements the members `getEvaluateExpression` uses, and `ExpressionEvaluator`
 * has private members that can't be satisfied structurally, so the cast is confined to this helper.
 */
const toEvaluatorRef = (
  mockExpressionEvaluator: ReturnType<typeof getMockExpressionEvaluator>,
): WeakRef<ExpressionEvaluator> =>
  new WeakRef(mockExpressionEvaluator as unknown as ExpressionEvaluator);

describe("getEvaluateExpression", () => {
  it("returns an error Evaluation if expressionEvaluator is not available", () => {
    const evaluateExpression = getEvaluateExpression();
    const expression = "1 + 1";
    const expected: Evaluation = {
      id: "test-uuid",
      severity: "error",
      result: "Expression evaluator not available",
      expression,
    };

    const result = evaluateExpression(expression);

    expect(result).toEqual(expected);
  });

  it("evaluates expressions correctly when evaluator is available", () => {
    const mockEvaluate = vi.fn().mockReturnValue(2);
    const mockExpressionEvaluator = getMockExpressionEvaluator(mockEvaluate);
    const evaluateExpression = getEvaluateExpression(
      toEvaluatorRef(mockExpressionEvaluator),
    );
    const expression = "1 + 1";
    const expected: Evaluation = {
      id: "test-uuid",
      result: 2,
      expression,
    };

    const result = evaluateExpression(expression);

    expect(result).toEqual(expected);
  });

  it("captures and returns an error if evaluation throws an error", () => {
    const mockEvaluate = vi.fn();
    const mockExpressionEvaluator = getMockExpressionEvaluator(
      mockEvaluate,
      true,
    );
    const evaluateExpression = getEvaluateExpression(
      toEvaluatorRef(mockExpressionEvaluator),
    );
    const expression = "invalid expression";
    const expected: Evaluation = {
      id: "test-uuid",
      severity: "error",
      result: "Evaluation error",
      expression,
    };

    const result = evaluateExpression(expression);

    expect(result).toEqual(expected);
  });

  it("handles errors triggered by onError hook", () => {
    const mockEvaluate = vi.fn();
    const mockExpressionEvaluator = getMockExpressionEvaluator(
      mockEvaluate,
      false,
    );
    const evaluateExpression = getEvaluateExpression(
      toEvaluatorRef(mockExpressionEvaluator),
    );
    const expression = "trigger hook error";

    evaluateExpression(expression);

    expect(() => {
      mockExpressionEvaluator.interceptor.call?.(new Error("Hook error"));
      evaluateExpression(expression);
    }).toThrow("Hook error");
  });
});
