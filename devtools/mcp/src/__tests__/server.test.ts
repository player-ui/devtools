import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Transport } from "@player-devtools/types";

const shutdown = vi.hoisted(() => vi.fn());
const createAnalytics = vi.hoisted(() => vi.fn());

vi.mock("../telemetry", () => ({
  createAnalytics,
  MCP_VERSION: "test-version",
}));

// The stdio transport would otherwise take over the real process stdout.
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class {
    async start(): Promise<void> {}
    async send(): Promise<void> {}
    async close(): Promise<void> {}
  },
}));

const { MCPServer } = await import("../server");

/** A transport whose connect outcome the test controls. */
function fakeTransport(connect: () => Promise<void>): Transport {
  return {
    connect,
    close: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as Transport;
}

describe("MCPServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAnalytics.mockReturnValue({ shutdown });
  });

  it("starts even when the devtools transport fails to connect", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const server = new MCPServer(
      fakeTransport(async () => {
        throw new Error("no flipper");
      }),
    );

    await expect(server.start()).resolves.toBeUndefined();
  });

  it("reports the transport as connected only after a successful connect", async () => {
    const server = new MCPServer(fakeTransport(async () => {}));
    const { isTransportConnected } = createAnalytics.mock.calls[0]?.[1] ?? {};

    expect(isTransportConnected()).toBe(false);
    await server.start();
    expect(isTransportConnected()).toBe(true);
  });

  it("flushes buffered telemetry before tearing down", async () => {
    const transport = fakeTransport(async () => {});
    const server = new MCPServer(transport);

    await server.stop();

    expect(shutdown).toHaveBeenCalled();
    expect(transport.close).toHaveBeenCalled();
  });

  it("still shuts down cleanly when the telemetry flush fails", async () => {
    shutdown.mockRejectedValueOnce(new Error("network down"));
    const transport = fakeTransport(async () => {});
    const server = new MCPServer(transport);

    await expect(server.stop()).resolves.toBeUndefined();
    expect(transport.close).toHaveBeenCalled();
  });
});
