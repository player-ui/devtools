import { describe, it, expect, vi } from "vitest";

import { getInstallId, type InstallIdDeps } from "../installId";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const enoent = (): never => {
  throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
};

function setup(overrides: Partial<InstallIdDeps> = {}) {
  const deps: InstallIdDeps = {
    homedir: () => "/home/tester",
    readFileSync: vi.fn(enoent) as unknown as InstallIdDeps["readFileSync"],
    writeFileSync: vi.fn() as unknown as InstallIdDeps["writeFileSync"],
    mkdirSync: vi.fn() as unknown as InstallIdDeps["mkdirSync"],
    randomUUID: () => UUID,
    ...overrides,
  };
  return deps;
}

const reads = (contents: string) =>
  vi.fn(() => contents) as unknown as InstallIdDeps["readFileSync"];

describe("getInstallId", () => {
  it("mints and persists an id on first run", () => {
    const deps = setup();

    expect(getInstallId(deps)).toBe(UUID);
    expect(deps.mkdirSync).toHaveBeenCalledWith(
      "/home/tester/.player-ui-devtools",
      { recursive: true },
    );
    expect(deps.writeFileSync).toHaveBeenCalledWith(
      "/home/tester/.player-ui-devtools/install.json",
      JSON.stringify({ installId: UUID }),
      { mode: 0o600 },
    );
  });

  it("reuses a persisted id without rewriting it", () => {
    const existing = "11111111-2222-4333-8444-555555555555";
    const deps = setup({
      readFileSync: reads(JSON.stringify({ installId: existing })),
    });

    expect(getInstallId(deps)).toBe(existing);
    expect(deps.writeFileSync).not.toHaveBeenCalled();
  });

  it.each([
    ["corrupt JSON", "{ not json"],
    ["non-string id", JSON.stringify({ installId: 42 })],
    ["empty id", JSON.stringify({ installId: "" })],
    ["non-uuid id", JSON.stringify({ installId: "nope" })],
  ])("regenerates on %s", (_label, contents) => {
    const deps = setup({ readFileSync: reads(contents) });

    expect(getInstallId(deps)).toBe(UUID);
    expect(deps.writeFileSync).toHaveBeenCalled();
  });

  it("returns null when the directory cannot be created", () => {
    const deps = setup({
      mkdirSync: vi.fn(() => {
        throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      }) as unknown as InstallIdDeps["mkdirSync"],
    });

    expect(getInstallId(deps)).toBeNull();
  });

  it("returns null when the file cannot be written", () => {
    const deps = setup({
      writeFileSync: vi.fn(() => {
        throw Object.assign(new Error("EROFS"), { code: "EROFS" });
      }) as unknown as InstallIdDeps["writeFileSync"],
    });

    expect(getInstallId(deps)).toBeNull();
  });
});
