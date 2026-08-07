import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const instrument = vi.hoisted(() => vi.fn());
const shutdown = vi.hoisted(() => vi.fn());
const PostHogCtor = vi.hoisted(() => vi.fn());
const getInstallId = vi.hoisted(() => vi.fn());

const INSTALL_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

// Keep the identity deterministic — the real implementation touches the home
// directory, which is not writable under the Bazel test sandbox.
vi.mock("../installId", () => ({ getInstallId }));
vi.mock("@posthog/mcp", () => ({ instrument }));
vi.mock("posthog-node", () => ({
  PostHog: class {
    shutdown = shutdown;
    constructor(...args: Array<unknown>) {
      PostHogCtor(...args);
    }
  },
}));

const { createAnalytics } = await import("../index");

const KEY = "phc_test_key";
const server = {} as object;
const deps = { isTransportConnected: () => true };

describe("createAnalytics", () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    getInstallId.mockReturnValue(INSTALL_ID);
    process.env.PLAYER_DEVTOOLS_TELEMETRY_KEY = KEY;
    delete process.env.DO_NOT_TRACK;
    delete process.env.PLAYER_DEVTOOLS_TELEMETRY_DISABLED;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("does not instrument when telemetry is opted out", () => {
    process.env.DO_NOT_TRACK = "1";

    expect(createAnalytics(server, deps)).toBeNull();
    expect(instrument).not.toHaveBeenCalled();
  });

  it("does not instrument without a configured key", () => {
    delete process.env.PLAYER_DEVTOOLS_TELEMETRY_KEY;

    expect(createAnalytics(server, deps)).toBeNull();
    expect(instrument).not.toHaveBeenCalled();
  });

  it("installs the property allowlist on the PostHog client itself", () => {
    createAnalytics(server, deps);

    const [, options] = PostHogCtor.mock.calls[0] ?? [];
    expect(options.before_send).toHaveLength(1);

    // The client-level hook must strip payloads regardless of the SDK.
    const redacted = options.before_send[0]({
      event: "$mcp_tool_call",
      properties: { $mcp_tool_name: "get_flow", $mcp_parameters: "SECRET" },
    });
    expect(JSON.stringify(redacted)).not.toContain("SECRET");
  });

  it("disables the SDK's tool-schema-mutating context parameter", () => {
    createAnalytics(server, deps);

    const [, , options] = instrument.mock.calls[0] ?? [];
    expect(options.context).toBe(false);
  });

  it("identifies with the durable install id", () => {
    createAnalytics(server, deps);

    const [, , options] = instrument.mock.calls[0] ?? [];
    expect(options.identify.distinctId).toBe(INSTALL_ID);
    // Person properties would de-anonymize the event stream.
    expect(options.identify.properties).toBeUndefined();
  });

  it("does not instrument when no durable identity is available", () => {
    getInstallId.mockReturnValue(null);

    expect(createAnalytics(server, deps)).toBeNull();
    expect(instrument).not.toHaveBeenCalled();
  });

  it("reports the settled transport state at capture time", () => {
    let connected = false;
    createAnalytics(server, { isTransportConnected: () => connected });

    const [, , options] = instrument.mock.calls[0] ?? [];
    expect(options.eventProperties().transport_connected).toBe(false);

    connected = true;
    expect(options.eventProperties().transport_connected).toBe(true);
  });

  it("returns null instead of throwing when instrumentation fails", () => {
    instrument.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    expect(() => createAnalytics(server, deps)).not.toThrow();
  });
});
