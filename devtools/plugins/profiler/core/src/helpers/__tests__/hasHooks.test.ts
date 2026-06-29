import { beforeEach, describe, expect, test, vi } from "vitest";
import { isRecordType } from "../isRecordType";
import { hasHooks } from "../hasHooks";

vi.mock("../isRecordType", () => ({
  isRecordType: vi.fn(),
}));

const mockIsRecordType = vi.mocked(isRecordType);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hasHooks", () => {
  test("returns true when both obj and obj.hooks are records", () => {
    const hooks = { someHook: () => {} };
    const input = { hooks };
    // First call (on obj) and second call (on obj.hooks) both return true
    mockIsRecordType.mockImplementation(
      (arg) => arg === input || arg === hooks,
    );

    expect(hasHooks(input)).toBe(true);
    expect(mockIsRecordType).toHaveBeenNthCalledWith(1, input);
    expect(mockIsRecordType).toHaveBeenNthCalledWith(2, hooks);
  });

  test("short-circuits to false when obj is not a record", () => {
    mockIsRecordType.mockReturnValue(false);

    expect(hasHooks("not a record")).toBe(false);
    // Bails after the first guard — never checks obj.hooks
    expect(mockIsRecordType).toHaveBeenCalledTimes(1);
  });

  test("returns false when the hooks key is absent", () => {
    // obj is a record, but it has no "hooks" key, so the "in" check fails
    mockIsRecordType.mockReturnValue(true);

    expect(hasHooks({ notHooks: {} })).toBe(false);
    // Only obj is checked; the "hooks" in obj check short-circuits before the second call
    expect(mockIsRecordType).toHaveBeenCalledTimes(1);
  });

  test("returns false when obj.hooks is not a record", () => {
    const input = { hooks: [] };
    // obj is a record, but obj.hooks is not
    mockIsRecordType.mockImplementation((arg) => arg === input);

    expect(hasHooks(input)).toBe(false);
    expect(mockIsRecordType).toHaveBeenCalledTimes(2);
    expect(mockIsRecordType).toHaveBeenNthCalledWith(2, input.hooks);
  });
});
