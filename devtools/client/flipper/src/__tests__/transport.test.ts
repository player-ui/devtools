import { describe, it, expect, vi } from "vitest";
import type { FlipperServer } from "flipper-server-client";
import { FlipperServerTransport } from "../transport";

/** A fake `FlipperServer` whose `exec` outcomes the test controls. */
function fakeFlipperServer(
  exec: (method: string, ...args: Array<unknown>) => Promise<unknown>,
): FlipperServer {
  return { exec } as unknown as FlipperServer;
}

/** Reaches into the transport's private fields to set up state without going through `connect()`. */
function attach(
  transport: FlipperServerTransport,
  server: FlipperServer,
  clientIds: Array<string> = [],
): void {
  const t = transport as unknown as {
    server: FlipperServer;
    connectedClientIds: Set<string>;
  };
  t.server = server;
  t.connectedClientIds = new Set(clientIds);
}

describe("FlipperServerTransport", () => {
  describe("ensurePluginInstalled", () => {
    it("returns the existing plugin without installing when already present", async () => {
      const existing = {
        name: "flipper-plugin-player-ui-devtools",
        version: "1.2.3",
      };
      const exec = vi.fn(async (method: string) => {
        if (method === "plugins-get-installed-plugins") return [existing];
        throw new Error(`unexpected exec: ${method}`);
      });
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec));

      await expect(transport.ensurePluginInstalled()).resolves.toBe(existing);
      expect(exec).not.toHaveBeenCalledWith(
        "plugins-install-from-npm",
        expect.anything(),
      );
    });

    it("installs from npm when the plugin is missing", async () => {
      const installed = {
        name: "flipper-plugin-player-ui-devtools",
        version: "4.5.6",
      };
      const exec = vi.fn(async (method: string) => {
        if (method === "plugins-get-installed-plugins") return [];
        if (method === "plugins-install-from-npm") return installed;
        throw new Error(`unexpected exec: ${method}`);
      });
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec));

      await expect(transport.ensurePluginInstalled()).resolves.toBe(installed);
      expect(exec).toHaveBeenCalledWith(
        "plugins-install-from-npm",
        "flipper-plugin-player-ui-devtools",
      );
    });

    it("rejects when not connected", async () => {
      const transport = new FlipperServerTransport();
      await expect(transport.ensurePluginInstalled()).rejects.toThrow(
        "not connected",
      );
    });
  });

  describe("enablePlugin / disablePlugin", () => {
    it("sends init to a single client id when one is given", async () => {
      const exec = vi.fn(async () => undefined);
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), ["a", "b"]);

      await transport.enablePlugin("a");

      expect(exec).toHaveBeenCalledTimes(1);
      expect(exec).toHaveBeenCalledWith("client-request-response", "a", {
        method: "init",
        params: { plugin: "player-ui-devtools" },
      });
    });

    it("sends init to every connected client when no id is given", async () => {
      const exec = vi.fn(async () => undefined);
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), ["a", "b"]);

      await transport.enablePlugin();

      expect(exec).toHaveBeenCalledTimes(2);
      expect(exec).toHaveBeenCalledWith(
        "client-request-response",
        "a",
        expect.objectContaining({ method: "init" }),
      );
      expect(exec).toHaveBeenCalledWith(
        "client-request-response",
        "b",
        expect.objectContaining({ method: "init" }),
      );
    });

    it("sends deinit via disablePlugin", async () => {
      const exec = vi.fn(async () => undefined);
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), ["a"]);

      await transport.disablePlugin("a");

      expect(exec).toHaveBeenCalledWith(
        "client-request-response",
        "a",
        expect.objectContaining({ method: "deinit" }),
      );
    });

    it("swallows a per-client failure instead of rejecting the whole call", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const exec = vi.fn(async (_method: string, id: string) => {
        if (id === "bad") throw new Error("boom");
        return undefined;
      });
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), ["good", "bad"]);

      await expect(transport.enablePlugin()).resolves.toBeUndefined();
      expect(exec).toHaveBeenCalledTimes(2);
    });

    it("rejects when not connected", async () => {
      const transport = new FlipperServerTransport();
      await expect(transport.enablePlugin()).rejects.toThrow("not connected");
    });
  });
});
