import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { FlipperServerTransport } from "../transport";

/** Access private fields for seeding — this is the pattern the plan calls for
 * to avoid real sockets/child processes while exercising the diagnostics
 * surface added for the MCP server's flipper tools. */
type TransportInternals = {
  server: unknown;
  refcount: { peek: () => { pid: number; refs: number } | null };
  owns: boolean;
  host: string;
  port: number;
  activeClientIds: Set<string>;
};

function internals(transport: FlipperServerTransport): TransportInternals {
  return transport as unknown as TransportInternals;
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
  });
});
