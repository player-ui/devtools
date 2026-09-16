import { describe, it, expect, vi } from "vitest";
import type { FlipperServer } from "flipper-server-client";
import { FlipperServerTransport } from "../transport";

const INSTALLED = {
  name: "flipper-plugin-player-ui-devtools",
  version: "1.2.3",
};

/**
 * A fake `FlipperServer` whose `exec` outcomes the test controls.
 *
 * `plugins-get-installed-plugins` resolves to `INSTALLED` by default (as if
 * the plugin is already present) so tests unrelated to installation don't
 * have to stub it; pass a custom `exec` to override that.
 */
function fakeFlipperServer(
  exec: (method: string, ...args: Array<unknown>) => Promise<unknown> = async (
    method,
  ) => {
    if (method === "plugins-get-installed-plugins") return [INSTALLED];
    return undefined;
  },
): FlipperServer {
  return { exec } as unknown as FlipperServer;
}

/** Reaches into the transport's private fields to set up state without going through `connect()`. */
function attach(
  transport: FlipperServerTransport,
  server: FlipperServer,
  {
    connectedClientIds = [],
    activeClientIds = [],
  }: {
    connectedClientIds?: Array<string>;
    activeClientIds?: Array<string>;
  } = {},
): void {
  const t = transport as unknown as {
    server: FlipperServer;
    connectedClientIds: Set<string>;
    activeClientIds: Set<string>;
  };
  t.server = server;
  t.connectedClientIds = new Set(connectedClientIds);
  t.activeClientIds = new Set(activeClientIds);
}

describe("FlipperServerTransport", () => {
  describe("ensurePluginInstalled", () => {
    it("returns the existing plugin without installing when already present", async () => {
      const exec = vi.fn(async (method: string) => {
        if (method === "plugins-get-installed-plugins") return [INSTALLED];
        throw new Error(`unexpected exec: ${method}`);
      });
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec));

      await expect(transport.ensurePluginInstalled()).resolves.toBe(INSTALLED);
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

  describe("enablePlugin", () => {
    it("ensures the plugin is installed before sending init", async () => {
      const exec = vi.fn(async (method: string) => {
        if (method === "plugins-get-installed-plugins") return [INSTALLED];
        return undefined;
      });
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), { connectedClientIds: ["a"] });

      await transport.enablePlugin("a");

      const installCallOrder = exec.mock.invocationCallOrder[0];
      const initCall = exec.mock.calls.findIndex(
        (call) => call[0] === "client-request-response",
      );
      expect(installCallOrder).toBeLessThan(
        exec.mock.invocationCallOrder[initCall],
      );
      expect(exec).toHaveBeenCalledWith("plugins-get-installed-plugins");
    });

    it("sends init to a single client id when one is given", async () => {
      const exec = vi.fn(fakeFlipperServer().exec);
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), {
        connectedClientIds: ["a", "b"],
      });

      await transport.enablePlugin("a");

      expect(exec).toHaveBeenCalledWith("client-request-response", "a", {
        method: "init",
        params: { plugin: "player-ui-devtools" },
      });
      expect(exec).not.toHaveBeenCalledWith(
        "client-request-response",
        "b",
        expect.anything(),
      );
    });

    it("sends init to every connected client that isn't already active when no id is given", async () => {
      const exec = vi.fn(fakeFlipperServer().exec);
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), {
        connectedClientIds: ["a", "b", "c"],
        activeClientIds: ["c"],
      });

      await transport.enablePlugin();

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
      expect(exec).not.toHaveBeenCalledWith(
        "client-request-response",
        "c",
        expect.anything(),
      );
    });

    it("still sends init to an explicit client id even if already active", async () => {
      const exec = vi.fn(fakeFlipperServer().exec);
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), {
        connectedClientIds: ["a"],
        activeClientIds: ["a"],
      });

      await transport.enablePlugin("a");

      expect(exec).toHaveBeenCalledWith(
        "client-request-response",
        "a",
        expect.objectContaining({ method: "init" }),
      );
    });

    it("swallows a per-client failure instead of rejecting the whole call", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const exec = vi.fn(async (method: string, id?: string) => {
        if (method === "plugins-get-installed-plugins") return [INSTALLED];
        if (id === "bad") throw new Error("boom");
        return undefined;
      });
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), {
        connectedClientIds: ["good", "bad"],
      });

      await expect(transport.enablePlugin()).resolves.toBeUndefined();
      expect(exec).toHaveBeenCalledWith(
        "client-request-response",
        "good",
        expect.anything(),
      );
      expect(exec).toHaveBeenCalledWith(
        "client-request-response",
        "bad",
        expect.anything(),
      );
    });

    it("rejects when not connected", async () => {
      const transport = new FlipperServerTransport();
      await expect(transport.enablePlugin()).rejects.toThrow("not connected");
    });
  });

  describe("disablePlugin", () => {
    it("sends deinit to a single client id when one is given", async () => {
      const exec = vi.fn(fakeFlipperServer().exec);
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), { activeClientIds: ["a"] });

      await transport.disablePlugin("a");

      expect(exec).toHaveBeenCalledWith(
        "client-request-response",
        "a",
        expect.objectContaining({ method: "deinit" }),
      );
    });

    it("sends deinit only to clients currently believed active when no id is given", async () => {
      const exec = vi.fn(fakeFlipperServer().exec);
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), {
        connectedClientIds: ["a", "b"],
        activeClientIds: ["a"],
      });

      await transport.disablePlugin();

      expect(exec).toHaveBeenCalledWith(
        "client-request-response",
        "a",
        expect.objectContaining({ method: "deinit" }),
      );
      expect(exec).not.toHaveBeenCalledWith(
        "client-request-response",
        "b",
        expect.anything(),
      );
    });

    it("does not call ensurePluginInstalled", async () => {
      const exec = vi.fn(async (method: string) => {
        if (method === "plugins-get-installed-plugins") {
          throw new Error("should not be called");
        }
        return undefined;
      });
      const transport = new FlipperServerTransport();
      attach(transport, fakeFlipperServer(exec), { activeClientIds: ["a"] });

      await expect(transport.disablePlugin("a")).resolves.toBeUndefined();
    });

    it("rejects when not connected", async () => {
      const transport = new FlipperServerTransport();
      await expect(transport.disablePlugin()).rejects.toThrow("not connected");
    });
  });
});
