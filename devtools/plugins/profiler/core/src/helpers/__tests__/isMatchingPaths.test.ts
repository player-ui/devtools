import { describe, expect, test } from "vitest";
import { isMatchingPaths } from "../isMatchingPaths";

describe("isMatchingPaths", () => {
  test("returns true for identical paths", () => {
    expect(isMatchingPaths(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
  });

  test("returns true for two empty paths", () => {
    expect(isMatchingPaths([], [])).toBe(true);
  });

  test("returns false when lengths differ", () => {
    expect(isMatchingPaths(["a"], ["a", "b"])).toBe(false);
  });

  test("returns false when an element differs", () => {
    expect(isMatchingPaths(["a", "b"], ["a", "c"])).toBe(false);
  });

  test("is order sensitive", () => {
    expect(isMatchingPaths(["a", "b"], ["b", "a"])).toBe(false);
  });
});
