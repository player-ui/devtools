import {
  createFlipperServer,
  FlipperServerState,
  type FlipperServer,
} from "flipper-server-client";
import { WebSocketServer, type WebSocket } from "ws";
import { spawn, type ChildProcess } from "child_process";
import * as net from "net";
import type {
  CommunicationLayerMethods,
  ExtensionSupportedEvents,
  MessengerEvent,
  TransactionMetadata,
} from "@player-devtools/types";

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

export class FlipperServerTransport implements Transport {
  private server: FlipperServer | null = null;
  private flipperProcess: ChildProcess | null = null;
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

    // Check if flipper-server is already listening; if not, start it
    const alreadyRunning = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, host);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
    });

    if (!alreadyRunning) {
      console.log("[FlipperServerTransport] Starting flipper-server...");
      const serverScript = require.resolve("flipper-server/server.js");
      this.flipperProcess = spawn(
        process.execPath,
        [serverScript, "--open=true"],
        {
          stdio: "inherit",
          detached: false,
        },
      );
      this.flipperProcess.on("error", (err) => {
        console.error(
          "[FlipperServerTransport] flipper-server process error:",
          err,
        );
      });
      // Kill the child synchronously on any form of exit so it doesn't orphan
      process.on("exit", () => this.flipperProcess?.kill());
      await waitForPort(host, port);
      console.log("[FlipperServerTransport] flipper-server ready.");
    } else {
      console.log("[FlipperServerTransport] flipper-server already running.");
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
    if (this.flipperProcess) {
      this.flipperProcess.kill();
      this.flipperProcess = null;
    }
  }
}

/** Default port the MCP server listens on for WebSocket connections */
export const DEFAULT_WS_PORT = 7382;

/**
 * WebSocket server transport
 *
 * The MCP server opens a WebSocket server; the player connects as a client
 * (via `useWSCommunicationLayer`). Works for:
 *   - Browser-based players
 *   - iOS/Android simulators over localhost
 *   - Physical devices over WiFi (same LAN)
 */
export class WebSocketServerTransport implements Transport {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private listeners = new Set<MessageCallback>();

  constructor(
    private options: {
      /** Port to listen on; defaults to 7382 */
      port?: number;
      /** Host to bind to; defaults to "localhost" */
      host?: string;
    } = {},
  ) {}

  async connect(): Promise<void> {
    const port = this.options.port ?? DEFAULT_WS_PORT;
    const host = this.options.host ?? "localhost";

    await new Promise<void>((resolve, reject) => {
      this.wss = new WebSocketServer({ port, host });

      this.wss.on("listening", resolve);
      this.wss.on("error", reject);

      this.wss.on("connection", (socket) => {
        this.clients.add(socket);

        socket.on("message", (data) => {
          let parsed: TransactionMetadata &
            MessengerEvent<ExtensionSupportedEvents>;
          try {
            parsed = JSON.parse(data.toString());
          } catch {
            return;
          }
          for (const listener of this.listeners) {
            listener(parsed);
          }
        });

        socket.on("close", () => {
          this.clients.delete(socket);
        });

        socket.on("error", (err) => {
          console.warn("[WebSocketServerTransport] Client error:", err);
          this.clients.delete(socket);
        });
      });
    });

    console.log(`[WebSocketServerTransport] Listening on ws://${host}:${port}`);
  }

  sendMessage: CommunicationLayerMethods["sendMessage"] = async (message) => {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(data);
      }
    }
  };

  addListener: CommunicationLayerMethods["addListener"] = (callback) => {
    this.listeners.add(callback);
  };

  removeListener: CommunicationLayerMethods["removeListener"] = (callback) => {
    this.listeners.delete(callback);
  };

  async close(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.listeners.clear();
    await new Promise<void>((resolve) => this.wss?.close(() => resolve()));
    this.wss = null;
  }
}
