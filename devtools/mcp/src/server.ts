import {
  createExtensionClient,
  type ExtensionClient,
} from "@player-devtools/client";
import type { Transport } from "@player-devtools/types";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { PostHog } from "posthog-node";

import { TOOL_DEFS, type ToolDef } from "./tools";
import { createAnalytics, MCP_VERSION } from "./telemetry";

export class MCPServer {
  private client: ExtensionClient;
  private server: McpServer;
  private analytics: PostHog | null;
  private transportConnected = false;

  constructor(private transport: Transport) {
    this.client = createExtensionClient(transport);
    this.server = new McpServer({
      name: "player-devtools",
      version: MCP_VERSION,
    });
    // Instrument before registering tools so every handler is wrapped.
    this.analytics = createAnalytics(this.server, {
      isTransportConnected: () => this.transportConnected,
    });
    this.registerTools();
  }

  private registerTools(): void {
    for (const def of TOOL_DEFS) {
      // `registerTool` is heavily generic over the Zod input shape; inferring
      // that across a heterogeneous array trips TS2589 (excessively deep). The
      // shapes are validated at runtime by the SDK, so register through a
      // loosely-typed view to keep inference shallow.
      const register = this.server.registerTool.bind(this.server) as (
        name: string,
        config: { description: string; inputSchema: ToolDef["inputSchema"] },
        cb: (args: unknown) => CallToolResult,
      ) => unknown;

      register(
        def.name,
        { description: def.description, inputSchema: def.inputSchema },
        (args) => def.handle(this.client, args),
      );
    }
  }

  async start(): Promise<void> {
    const stdioTransport = new StdioServerTransport();
    await this.server.connect(stdioTransport);
    try {
      await this.transport.connect();
      this.transportConnected = true;
    } catch (err) {
      console.warn(
        "[MCPServer] Transport connect failed (will operate in disconnected mode):",
        err instanceof Error ? err.message : err,
      );
    }
  }

  async stop(): Promise<void> {
    // Flush buffered events first: bin/run calls process.exit(0) as soon as
    // this resolves, which would otherwise drop them. Never fail shutdown on a
    // telemetry error.
    try {
      await this.analytics?.shutdown();
    } catch {
      /* best-effort */
    }
    this.client.destroy();
    await this.transport.close();
    await this.server.close();
  }
}
