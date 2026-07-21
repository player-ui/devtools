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

/** Shape of a Flipper `client-message` payload after JSON.parse */
type FlipperExecuteMessage = {
  method: "execute";
  params: {
    api: string;
    method: string;
    params?: unknown;
  };
};

/** Transport interface — implemented by each connection adapter */
export interface Transport extends CommunicationLayerMethods {
  /** Connect to the underlying transport */
  connect(): Promise<void>;
  /** Tear down the underlying transport */
  close(): Promise<void>;
}

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

  constructor(
    private options: {
      /** Flipper server host; defaults to "localhost" */
      host?: string;
      /** Flipper server WebSocket port; defaults to 52342 */
      port?: number;
    } = {},
  ) {}

  async connect(): Promise<void> {
    const host = this.options.host ?? "localhost";
    const port = this.options.port ?? 52342;

    // Register interest in the shared daemon. The first instance to do so is
    // told to start it; the rest just attach. The daemon outlives any single
    // MCP process and is only torn down when the last instance detaches.
    const { shouldStart, commit } = this.refcount.acquire();

    if (shouldStart) {
      console.log("[FlipperServerTransport] Starting flipper-server...");
      const serverScript = require.resolve("flipper-server/server.js");
      // Detached + unref'd: the daemon must survive this process exiting so
      // other instances keep their connections. We never kill it directly —
      // shutdown is driven by the refcount in close().
      const child = spawn(process.execPath, [serverScript, "--open=true"], {
        stdio: "inherit",
        detached: true,
      });
      child.on("error", (err: Error) => {
        console.error(
          "[FlipperServerTransport] flipper-server process error:",
          err,
        );
      });
      child.unref();
      await waitForPort(host, port);
      commit(child.pid!);
      console.log("[FlipperServerTransport] flipper-server ready.");
    } else {
      // Daemon already running (started by another instance) — wait for it to
      // accept connections in case it's still coming up, then attach.
      await waitForPort(host, port);
      console.log("[FlipperServerTransport] Attached to flipper-server.");
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
      console.log(
        "[FlipperServerTransport] client-connected:",
        JSON.stringify(info),
      );
    });
    this.server.on("client-disconnected", ({ id }) => {
      console.log("[FlipperServerTransport] client-disconnected:", id);
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

      console.debug(
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

  async close(): Promise<void> {
    this.listeners.clear();
    this.activeClientIds.clear();
    this.server?.close();
    this.server = null;

    // Drop our reference to the shared daemon. If we were the last user, the
    // refcount hands back its PID and we shut it down; otherwise it keeps
    // running for the remaining instances.
    const pidToKill = this.refcount.release();
    if (pidToKill !== null) {
      try {
        process.kill(pidToKill);
        console.log("[FlipperServerTransport] Shut down flipper-server.");
      } catch {
        /* already gone */
      }
    }
  }
}
