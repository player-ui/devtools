import {
  createFlipperServer,
  FlipperServerState,
  type FlipperServer,
} from "flipper-server-client";
import { spawn } from "child_process";
import * as net from "net";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { WebSocket as WsWebSocket } from "ws";
import type {
  CommunicationLayerMethods,
  ExtensionSupportedEvents,
  MessengerEvent,
  TransactionMetadata,
  Transport,
} from "@player-devtools/types";

// polyfill WebSocket for Node < 22
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket =
    WsWebSocket as unknown as typeof WebSocket;
}

type MessageCallback = (
  message: TransactionMetadata & MessengerEvent<ExtensionSupportedEvents>,
) => void;

const PLUGIN_API = "player-ui-devtools";

/**
 * All diagnostics go to stderr.
 *
 * This transport runs inside the MCP server process, where stdout is the
 * JSON-RPC channel — every byte written there must be a newline-delimited
 * JSON-RPC message. `console.log` and `console.debug` both write to stdout in
 * Node, so they would corrupt the protocol stream.
 */
const log = (...args: Array<unknown>): void => {
  console.error(...args);
};

/** Shape of a Flipper `client-message` payload after JSON.parse */
type FlipperExecuteMessage = {
  method: "execute";
  params: {
    api: string;
    method: string;
    params?: unknown;
  };
};

/**
 * Flipper headless transport
 *
 * Connects to a running `flipper-server` process and routes messages for the
 * "flipper-plugin-player-ui-devtools" plugin through to the Messenger layer.
 */
/** Wait until a TCP port is accepting connections, polling every 500ms */
function waitForPort(
  host: string,
  port: number,
  timeoutMs = 30_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const socket = net.connect(port, host);
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
        } else {
          setTimeout(attempt, 500);
        }
      });
    };
    attempt();
  });
}

/**
 * Cross-process refcount for the shared `flipper-server` daemon.
 *
 * Many MCP server processes (one per project/user registration) attach to a
 * single `flipper-server` on a fixed port. No in-process variable can
 * coordinate their lifecycles, so we track liveness in a small file guarded by
 * an atomic lock directory:
 *
 *   - The first attach starts the daemon and records its PID with `refs: 1`.
 *   - Each subsequent attach increments `refs`.
 *   - Each detach decrements `refs`; the last one out shuts the daemon down.
 *
 * The lock directory (`mkdir` is atomic across processes) serializes the
 * read-modify-write so concurrently-starting instances don't race.
 */
type RefcountFile = { pid: number; refs: number };

class FlipperRefcount {
  private readonly dir = path.join(os.tmpdir(), "player-devtools-mcp");
  private readonly file = path.join(this.dir, "flipper-server.refcount");
  private readonly lock = path.join(this.dir, "flipper-server.lock");

  /** Acquire the cross-process lock, run `fn`, then release — even on throw. */
  private withLock<T>(fn: () => T): T {
    fs.mkdirSync(this.dir, { recursive: true });
    const deadline = Date.now() + 5_000;
    // Spin on an atomic mkdir until we own the lock or time out.
    for (;;) {
      try {
        fs.mkdirSync(this.lock);
        break;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
        if (Date.now() >= deadline) {
          // Stale lock from a crashed process — reclaim it.
          try {
            fs.rmdirSync(this.lock);
          } catch {
            /* another instance won the reclaim; retry */
          }
        }
      }
    }
    try {
      return fn();
    } finally {
      try {
        fs.rmdirSync(this.lock);
      } catch {
        /* already gone */
      }
    }
  }

  private read(): RefcountFile | null {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8")) as RefcountFile;
    } catch {
      return null;
    }
  }

  /**
   * Read the current refcount state without mutating it. Still goes through
   * `withLock` so a concurrent acquire/release can't be observed mid-write.
   */
  peek(): RefcountFile | null {
    return this.withLock(() => this.read());
  }

  private write(state: RefcountFile): void {
    fs.writeFileSync(this.file, JSON.stringify(state));
  }

  private clear(): void {
    try {
      fs.unlinkSync(this.file);
    } catch {
      /* already gone */
    }
  }

  /** Is the recorded daemon PID still alive? */
  private isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Register interest in the daemon. Returns whether this caller is the one
   * responsible for starting it (because no live daemon was recorded).
   * `recordPid` is called with the started PID once the daemon is up.
   */
  acquire(): { shouldStart: boolean; commit: (pid: number) => void } {
    return this.withLock(() => {
      const state = this.read();
      if (state && this.isAlive(state.pid)) {
        this.write({ pid: state.pid, refs: state.refs + 1 });
        return { shouldStart: false, commit: () => {} };
      }
      // No live daemon — this caller will start one and record its PID.
      return {
        shouldStart: true,
        commit: (pid: number) =>
          this.withLock(() => this.write({ pid, refs: 1 })),
      };
    });
  }

  /**
   * Drop this caller's interest. Returns the PID to kill if this was the last
   * reference, otherwise null.
   */
  release(): number | null {
    return this.withLock(() => {
      const state = this.read();
      if (!state) return null;
      if (state.refs <= 1) {
        this.clear();
        return state.pid;
      }
      this.write({ pid: state.pid, refs: state.refs - 1 });
      return null;
    });
  }
}

export class FlipperServerTransport implements Transport {
  private server: FlipperServer | null = null;
  private refcount = new FlipperRefcount();
  private listeners = new Set<MessageCallback>();

  /**
   * Client IDs that have sent at least one message through the devtools
   * plugin — these are the clients we send outbound messages to.
   */
  private activeClientIds = new Set<string>();

  /** Resolved connection target, set at the top of `connect()`. */
  private host = "localhost";
  private port = 52342;

  /**
   * Whether this instance started the shared daemon (vs. attaching to one
   * another instance started). Only an owner may consider restarting it.
   */
  private owns = false;

  constructor(
    private options: {
      /** Flipper server host; defaults to "localhost" */
      host?: string;
      /** Flipper server WebSocket port; defaults to 52342 */
      port?: number;
    } = {},
  ) {}

  async connect(): Promise<void> {
    const host = (this.host = this.options.host ?? "localhost");
    const port = (this.port = this.options.port ?? 52342);

    // Register interest in the shared daemon. The first instance to do so is
    // told to start it; the rest just attach. The daemon outlives any single
    // MCP process and is only torn down when the last instance detaches.
    const { shouldStart, commit } = this.refcount.acquire();
    this.owns = shouldStart;

    if (shouldStart) {
      log("[FlipperServerTransport] Starting flipper-server...");
      const serverScript = require.resolve("flipper-server/server.js");
      // Detached + unref'd: the daemon must survive this process exiting so
      // other instances keep their connections. We never kill it directly —
      // shutdown is driven by the refcount in close().
      //
      // The daemon must never inherit our fd 1: it outlives this process and
      // would write into a later session's JSON-RPC stream. Its stderr stays
      // inherited so daemon diagnostics remain visible.
      const child = spawn(process.execPath, [serverScript, "--open=true"], {
        stdio: ["ignore", "ignore", "inherit"],
        detached: true,
      });
      child.on("error", (err: Error) => {
        console.error(
          "[FlipperServerTransport] flipper-server process error:",
          err,
        );
      });
      child.unref();
      try {
        await waitForPort(host, port);
      } catch (err) {
        // Nothing has recorded this PID in the refcount file yet, so nobody
        // else can track or kill it — if we leave it running here it becomes
        // an orphan daemon that a later connect() would compete with on the
        // same port instead of detecting. Wait for it to actually exit (via
        // the same bounded kill-and-confirm mechanism used everywhere else in
        // this file) before rethrowing, so a caller that retries connect()
        // right away doesn't spawn a second daemon racing this one for the
        // port during teardown.
        await this.killAndWait(child.pid!);
        throw err;
      }
      commit(child.pid!);
      log("[FlipperServerTransport] flipper-server ready.");
    } else {
      // Daemon already running (started by another instance) — wait for it to
      // accept connections in case it's still coming up, then attach.
      await waitForPort(host, port);
      log("[FlipperServerTransport] Attached to flipper-server.");
    }

    // Read the auth token the flipper-server wrote during startup
    const { getAuthToken } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("flipper-server/lib/app-connectivity/certificate-exchange/certificate-utils") as {
        getAuthToken: () => Promise<string>;
      };

    let cachedToken: string | null = null;
    try {
      cachedToken = await getAuthToken();
    } catch (err) {
      console.warn("[FlipperServerTransport] Could not read auth token:", err);
    }

    this.server = await createFlipperServer(
      host,
      port,
      () => cachedToken,
      (state) => {
        if (state === FlipperServerState.DISCONNECTED) {
          console.warn("[FlipperServerTransport] Disconnected from server");
        }
      },
    );

    await this.server.connect();

    // Track client connects/disconnects
    this.server.on("client-connected", (info) => {
      log("[FlipperServerTransport] client-connected:", JSON.stringify(info));
    });
    this.server.on("client-disconnected", ({ id }) => {
      log("[FlipperServerTransport] client-disconnected:", id);
      this.activeClientIds.delete(id);
    });

    // Route inbound device messages to our Messenger listeners
    this.server.on("client-message", ({ id, message }) => {
      let parsed: FlipperExecuteMessage;
      try {
        parsed = JSON.parse(message) as FlipperExecuteMessage;
      } catch {
        return;
      }

      log(
        `[FlipperServerTransport] client-message from ${id}: method=${parsed.method} api=${(parsed.params as { api?: string })?.api} pluginMethod=${(parsed.params as { method?: string })?.method}`,
      );

      if (
        parsed.method !== "execute" ||
        parsed.params?.api !== PLUGIN_API ||
        parsed.params?.method !== "message::plugin"
      ) {
        return;
      }

      // This client is talking through the devtools plugin — remember it
      this.activeClientIds.add(id);

      const payload = parsed.params.params as TransactionMetadata &
        MessengerEvent<ExtensionSupportedEvents>;

      for (const listener of this.listeners) {
        listener(payload);
      }
    });
  }

  sendMessage: CommunicationLayerMethods["sendMessage"] = async (message) => {
    if (!this.server) return;

    const payload: FlipperExecuteMessage = {
      method: "execute",
      params: {
        api: PLUGIN_API,
        method: "message::flipper",
        params: message,
      },
    };

    await Promise.all(
      [...this.activeClientIds].map((clientId) =>
        this.server!.exec("client-request-response", clientId, payload).catch(
          (err) => {
            console.warn(
              `[FlipperServerTransport] Failed to send to client ${clientId}:`,
              err,
            );
            // Remove dead client so we stop trying
            this.activeClientIds.delete(clientId);
          },
        ),
      ),
    );
  };

  addListener: CommunicationLayerMethods["addListener"] = (callback) => {
    this.listeners.add(callback);
  };

  removeListener: CommunicationLayerMethods["removeListener"] = (callback) => {
    this.listeners.delete(callback);
  };

  /**
   * In-flight `close()` promise, if one is currently running on this
   * instance. Guards `refcount.release()` and `killAndWait()` against being
   * invoked twice for a single logical close — e.g. `restart()`'s internal
   * `close()` racing an external `MCPServer.stop()` -> `transport.close()`.
   */
  private closing: Promise<void> | null = null;

  async close(): Promise<void> {
    if (this.closing) return this.closing;

    this.closing = this.doClose().finally(() => {
      this.closing = null;
    });
    return this.closing;
  }

  private async doClose(): Promise<void> {
    this.listeners.clear();
    this.activeClientIds.clear();
    this.server?.close();
    this.server = null;

    // Drop our reference to the shared daemon. If we were the last user, the
    // refcount hands back its PID and we shut it down; otherwise it keeps
    // running for the remaining instances.
    const pidToKill = this.refcount.release();
    if (pidToKill !== null) {
      await this.killAndWait(pidToKill);
    }
  }

  /**
   * Send SIGTERM and wait for the process to actually exit (or a bounded
   * timeout) before resolving, so callers — notably `restart()` — can rely on
   * the port being free once `close()` returns instead of racing a new child
   * for it.
   */
  private killAndWait(pid: number, timeoutMs = 5_000): Promise<void> {
    return new Promise((resolve) => {
      try {
        process.kill(pid);
      } catch {
        // Already gone.
        resolve();
        return;
      }

      const deadline = Date.now() + timeoutMs;
      const poll = () => {
        if (!this.isPidAlive(pid)) {
          log("[FlipperServerTransport] Shut down flipper-server.");
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          log(
            "[FlipperServerTransport] Timed out waiting for flipper-server to exit.",
          );
          resolve();
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    });
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /** Read-only snapshot of this transport's connection to the shared daemon. */
  getDiagnostics(): {
    connected: boolean;
    host: string;
    port: number;
    owns: boolean;
    refs: number | null;
    activeClientIds: string[];
  } {
    const state = this.refcount.peek();
    return {
      connected: this.server !== null,
      host: this.host,
      port: this.port,
      owns: this.owns,
      refs: state?.refs ?? null,
      activeClientIds: [...this.activeClientIds],
    };
  }

  /**
   * Restart the shared daemon. Only ever acts when this instance both owns
   * the daemon (started it) and is its sole remaining consumer — otherwise
   * this soft-errors without touching the daemon, since killing it out from
   * under other attached instances would break their connections.
   */
  async restart(): Promise<
    { ok: true; host: string; port: number } | { ok: false; reason: string }
  > {
    if (!this.owns) {
      return {
        ok: false,
        reason: "this instance does not own the flipper-server daemon",
      };
    }

    const state = this.refcount.peek();
    if (state?.refs !== 1) {
      return {
        ok: false,
        reason: "other consumers are attached to this daemon",
      };
    }

    // Re-verify immediately before the destructive close(): another instance
    // could have called connect()/acquire() between the check above and here,
    // bumping refs to 2+. This narrows but does not eliminate the race — a
    // consumer could still slip in between this re-check and close() itself;
    // a fully atomic fix would need close()+connect() to run inside
    // refcount.withLock(), which isn't reentrant-safe with connect()'s own
    // internal use of the lock, so we accept this narrow residual window.
    const recheck = this.refcount.peek();
    if (recheck?.refs !== 1) {
      return {
        ok: false,
        reason: "other consumers attached to this daemon just before restart",
      };
    }

    try {
      await this.close();
      await this.connect();
    } catch (err) {
      // The daemon this instance owned/attempted to own is now in an unknown
      // or dead state — don't leave `owns` set, or a later restart() call
      // will misreport "other consumers are attached" against a stale
      // refcount for a daemon that no longer exists.
      this.owns = false;
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
    return { ok: true, host: this.host, port: this.port };
  }

  /** Whether the devtools Flipper plugin is installed, per the live daemon. */
  async getPluginInstallStatus(): Promise<{
    installed: boolean;
    version?: string;
    reason?: string;
  }> {
    if (!this.server) return { installed: false, reason: "not connected" };

    try {
      const plugins = (await this.server.exec(
        "plugins-get-installed-plugins",
      )) as Array<{ id?: string; name?: string; version?: string }>;

      const plugin = plugins.find(
        (candidate) =>
          candidate.id === PLUGIN_API || candidate.name === PLUGIN_API,
      );

      if (!plugin) return { installed: false };
      return plugin.version
        ? { installed: true, version: plugin.version }
        : { installed: true };
    } catch (err) {
      return {
        installed: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
