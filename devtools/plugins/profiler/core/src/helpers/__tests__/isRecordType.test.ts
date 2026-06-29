import { describe, expect, test } from "vitest";
import { isRecordType } from "../isRecordType";

describe("isRecordType", () => {
  test("returns true for a plain object", () => {
    expect(isRecordType({ a: 1 })).toBe(true);
  });

  test("returns true for an empty object", () => {
    expect(isRecordType({})).toBe(true);
  });

  test("returns false for an array", () => {
    expect(isRecordType([1, 2, 3])).toBe(false);
  });

  test("returns false for null", () => {
    expect(isRecordType(null)).toBe(false);
  });

  test("returns false for primitives", () => {
    expect(isRecordType("string")).toBe(false);
    expect(isRecordType(42)).toBe(false);
    expect(isRecordType(true)).toBe(false);
    expect(isRecordType(undefined)).toBe(false);
  });

  test("returns false for a function", () => {
    expect(isRecordType(() => {})).toBe(false);
  });
});
