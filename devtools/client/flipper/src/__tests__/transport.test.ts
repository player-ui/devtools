import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
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

/** Access private fields for seeding — avoids real sockets/child processes
 * while exercising the connection-state and plugin-activation surfaces. */
type TransportInternals = {
  server: unknown;
  refcount: { peek: () => { pid: number; refs: number } | null };
  owns: boolean;
  host: string;
  port: number;
  connectedClientIds: Set<string>;
  activeClientIds: Set<string>;
};

function internals(transport: FlipperServerTransport): TransportInternals {
  return transport as unknown as TransportInternals;
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
  const t = internals(transport);
  t.server = server;
  t.connectedClientIds = new Set(connectedClientIds);
  t.activeClientIds = new Set(activeClientIds);
}

/**
 * A transport whose refcount is stubbed to `null` so tests don't depend on
 * (or race) a real `flipper-server.refcount` file possibly left on disk by
 * other processes on the machine running the test.
 */
function makeIsolatedTransport(
  options?: ConstructorParameters<typeof FlipperServerTransport>[0],
): FlipperServerTransport {
  const transport = new FlipperServerTransport(options);
  internals(transport).refcount = { peek: () => null };
  return transport;
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

  describe("getDiagnostics", () => {
    it("reports disconnected defaults before connect() is called", () => {
      const transport = makeIsolatedTransport();
      expect(transport.getDiagnostics()).toEqual({
        connected: false,
        host: "localhost",
        port: 52342,
        owns: false,
        refs: null,
        activeClientIds: [],
      });
    });

    it("reflects custom host/port options even before connecting", () => {
      const transport = makeIsolatedTransport({
        host: "127.0.0.1",
        port: 9999,
      });
      // host/port are only assigned inside connect(); options alone don't
      // seed the instance fields, matching the plan's "set at top of
      // connect()" requirement.
      expect(transport.getDiagnostics()).toMatchObject({
        host: "localhost",
        port: 52342,
      });
    });

    it("reports connected + owns + refs + activeClientIds once seeded", () => {
      const transport = makeIsolatedTransport();
      const state = internals(transport);
      state.server = {};
      state.owns = true;
      state.activeClientIds = new Set(["a", "b"]);
      state.refcount = { peek: () => ({ pid: 123, refs: 1 }) };

      expect(transport.getDiagnostics()).toEqual({
        connected: true,
        host: "localhost",
        port: 52342,
        owns: true,
        refs: 1,
        activeClientIds: ["a", "b"],
      });
    });
  });

  describe("FlipperRefcount.peek (via getDiagnostics)", () => {
    it("does not mutate the refcount file", () => {
      const dir = path.join(os.tmpdir(), "player-devtools-mcp");
      const file = path.join(dir, "flipper-server.refcount");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ pid: process.pid, refs: 4 }));

      try {
        const transport = new FlipperServerTransport();
        const before = fs.readFileSync(file, "utf8");
        const { refs } = transport.getDiagnostics();
        const after = fs.readFileSync(file, "utf8");

        expect(refs).toBe(4);
        expect(after).toBe(before);
      } finally {
        fs.rmSync(file, { force: true });
      }
    });
  });

  describe("restart", () => {
    it("soft-errors without touching the daemon when this instance does not own it", async () => {
      const transport = new FlipperServerTransport();
      const close = vi.spyOn(transport, "close");
      const connect = vi.spyOn(transport, "connect");

      const result = await transport.restart();

      expect(result).toEqual({
        ok: false,
        reason: "this instance does not own the flipper-server daemon",
      });
      expect(close).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    });

    it("soft-errors without touching the daemon when other consumers are attached", async () => {
      const transport = new FlipperServerTransport();
      const state = internals(transport);
      state.owns = true;
      state.refcount = { peek: () => ({ pid: 1, refs: 3 }) };

      const close = vi.spyOn(transport, "close");
      const connect = vi.spyOn(transport, "connect");

      const result = await transport.restart();

      expect(result).toEqual({
        ok: false,
        reason: "other consumers are attached to this daemon",
      });
      expect(close).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    });

    it("closes and reconnects when this instance is the sole owner", async () => {
      const transport = new FlipperServerTransport();
      const state = internals(transport);
      state.owns = true;
      state.refcount = { peek: () => ({ pid: 1, refs: 1 }) };

      const close = vi.spyOn(transport, "close").mockResolvedValue(undefined);
      const connect = vi
        .spyOn(transport, "connect")
        .mockImplementation(async () => {
          state.host = "localhost";
          state.port = 52342;
        });

      const result = await transport.restart();

      expect(close).toHaveBeenCalledOnce();
      expect(connect).toHaveBeenCalledOnce();
      expect(result).toEqual({ ok: true, host: "localhost", port: 52342 });
    });

    it("aborts with a soft error when refs change between the initial check and the pre-kill re-check", async () => {
      const transport = new FlipperServerTransport();
      const state = internals(transport);
      state.owns = true;
      let calls = 0;
      state.refcount = {
        peek: () => {
          calls += 1;
          // First peek (in the initial guard) sees refs=1; the re-check
          // immediately before close() sees a consumer that just attached.
          return calls === 1 ? { pid: 1, refs: 1 } : { pid: 1, refs: 2 };
        },
      };

      const close = vi.spyOn(transport, "close");
      const connect = vi.spyOn(transport, "connect");

      const result = await transport.restart();

      expect(result).toEqual({
        ok: false,
        reason: "other consumers attached to this daemon just before restart",
      });
      expect(close).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    });

    it("returns a soft error and resets owns to false when connect() fails after close() succeeds", async () => {
      const transport = new FlipperServerTransport();
      const state = internals(transport);
      state.owns = true;
      state.refcount = { peek: () => ({ pid: 1, refs: 1 }) };

      const close = vi.spyOn(transport, "close").mockResolvedValue(undefined);
      const connect = vi
        .spyOn(transport, "connect")
        .mockRejectedValue(new Error("Timed out waiting for localhost:52342"));

      const result = await transport.restart();

      expect(close).toHaveBeenCalledOnce();
      expect(connect).toHaveBeenCalledOnce();
      expect(result).toEqual({
        ok: false,
        reason: "Timed out waiting for localhost:52342",
      });
      expect(internals(transport).owns).toBe(false);
    });
  });

  describe("getPluginInstallStatus", () => {
    it("returns not-installed when the server is not connected", async () => {
      const transport = new FlipperServerTransport();
      await expect(transport.getPluginInstallStatus()).resolves.toEqual({
        installed: false,
        reason: "not connected",
      });
    });

    it("returns not-installed when the daemon has no matching plugin", async () => {
      const transport = new FlipperServerTransport();
      internals(transport).server = {
        exec: vi.fn().mockResolvedValue([{ id: "some-other-plugin" }]),
      };

      await expect(transport.getPluginInstallStatus()).resolves.toEqual({
        installed: false,
      });
    });

    it("matches by id and reports the version when present", async () => {
      const transport = new FlipperServerTransport();
      internals(transport).server = {
        exec: vi
          .fn()
          .mockResolvedValue([{ id: "player-ui-devtools", version: "1.2.3" }]),
      };

      await expect(transport.getPluginInstallStatus()).resolves.toEqual({
        installed: true,
        version: "1.2.3",
      });
    });

    it("matches by name when id is absent, without a version", async () => {
      const transport = new FlipperServerTransport();
      internals(transport).server = {
        exec: vi.fn().mockResolvedValue([{ name: "player-ui-devtools" }]),
      };

      await expect(transport.getPluginInstallStatus()).resolves.toEqual({
        installed: true,
      });
    });

    it("resolves with a failure reason instead of throwing when exec() rejects", async () => {
      const transport = new FlipperServerTransport();
      internals(transport).server = {
        exec: vi.fn().mockRejectedValue(new Error("daemon dropped")),
      };

      await expect(transport.getPluginInstallStatus()).resolves.toEqual({
        installed: false,
        reason: "daemon dropped",
      });
    });

    it("returns the soft-error shape instead of throwing when exec() resolves with a malformed non-array value", async () => {
      const transport = new FlipperServerTransport();
      internals(transport).server = {
        // Simulates a version-mismatched daemon response: exec() resolves
        // (doesn't reject) with something that isn't an array, so `.find()`
        // would throw a TypeError if called outside the try/catch.
        exec: vi.fn().mockResolvedValue({ unexpected: "shape" }),
      };

      await expect(transport.getPluginInstallStatus()).resolves.toEqual({
        installed: false,
        reason: "plugins.find is not a function",
      });
    });
  });

  describe("close", () => {
    it("waits for the killed daemon process to actually exit before resolving", async () => {
      vi.useFakeTimers();
      try {
        const transport = new FlipperServerTransport();
        const state = internals(transport);
        state.refcount = {
          peek: () => null,
        } as unknown as TransportInternals["refcount"];
        (
          transport as unknown as {
            refcount: { release: () => number | null };
          }
        ).refcount.release = () => 4242;

        let alive = true;
        const killSpy = vi.spyOn(process, "kill").mockImplementation(((
          pid: number,
          signal?: string | number,
        ) => {
          if (signal === 0) {
            if (!alive) throw new Error("ESRCH");
            return true;
          }
          return true;
        }) as typeof process.kill);

        const closePromise = transport.close();
        let resolved = false;
        void closePromise.then(() => {
          resolved = true;
        });

        // Still "alive" — close() must not have resolved yet.
        await vi.advanceTimersByTimeAsync(300);
        expect(resolved).toBe(false);

        // Now the process exits; the next poll should observe it and resolve.
        alive = false;
        await vi.advanceTimersByTimeAsync(200);
        await closePromise;
        expect(resolved).toBe(true);

        killSpy.mockRestore();
      } finally {
        vi.useRealTimers();
      }
    });

    it("is idempotent: a second concurrent close() does not re-run teardown", async () => {
      const transport = new FlipperServerTransport();

      let releaseCalls = 0;
      (
        transport as unknown as {
          refcount: { release: () => number | null };
        }
      ).refcount = {
        peek: () => null,
        release: () => {
          releaseCalls += 1;
          return null;
        },
      } as unknown as TransportInternals["refcount"];

      const first = transport.close();
      const second = transport.close();

      await Promise.all([first, second]);

      expect(releaseCalls).toBe(1);
    });
  });

  describe("connect", () => {
    it("kills the spawned child and waits for it to exit when waitForPort fails after spawn", async () => {
      // Exercises connect()'s `shouldStart` spawn path: the real flipper-server
      // child is spawned, but nothing is listening on the target port, so
      // waitForPort() times out. Nothing has committed this child's PID to
      // the refcount file yet, so connect() must kill it itself (via the same
      // killAndWait() used elsewhere in this file) or it orphans.
      //
      // Under this workspace's vitest environment (happy-dom), `vi.mock`
      // cannot reliably intercept Node builtin modules (`child_process`,
      // `net`) for code paths already resolved outside the test file's own
      // module graph, so this spies on the module-level `process.kill`
      // instead — the real spawn() runs, but against a port nothing listens
      // on, and fake timers fast-forward both waitForPort's 30s polling loop
      // and killAndWait's exit-confirmation poll.
      let alive = true;
      const processKillSpy = vi.spyOn(process, "kill").mockImplementation(((
        pid: number,
        signal?: string | number,
      ) => {
        if (signal === 0) {
          if (!alive) throw new Error("ESRCH");
          return true;
        }
        // The SIGTERM sent by killAndWait().
        alive = false;
        return true;
      }) as typeof process.kill);

      vi.useFakeTimers();
      try {
        const transport = new FlipperServerTransport({
          host: "127.0.0.1",
          // Reserved/unused port: nothing should ever be listening here in CI
          // or locally, so real net.connect attempts genuinely fail fast.
          port: 1,
        });
        const state = internals(transport);
        state.refcount = {
          peek: () => null,
        } as unknown as TransportInternals["refcount"];
        (
          transport as unknown as {
            refcount: {
              acquire: () => {
                shouldStart: boolean;
                commit: (pid: number) => void;
              };
            };
          }
        ).refcount.acquire = () => ({
          shouldStart: true,
          commit: vi.fn(),
        });

        const connectPromise = transport.connect().catch((err) => err as Error);

        // Advance past waitForPort's internal 30s timeout so it rejects, then
        // past killAndWait's poll interval so it observes the SIGTERM'd
        // child's exit before connect() rethrows.
        await vi.advanceTimersByTimeAsync(31_200);

        const result = await connectPromise;

        expect(result).toBeInstanceOf(Error);
        // The SIGTERM from killAndWait().
        expect(processKillSpy).toHaveBeenCalledWith(expect.any(Number));
        // The liveness poll from killAndWait()'s isPidAlive().
        expect(processKillSpy).toHaveBeenCalledWith(expect.any(Number), 0);
      } finally {
        vi.useRealTimers();
        processKillSpy.mockRestore();
      }
    });
  });
});
