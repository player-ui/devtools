import {
  createExtensionClient,
  type ExtensionClient,
} from "@player-devtools/client";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { Transport } from "./transport";
import {
  listPlayersTool,
  getPlayerStatusTool,
  getFlowTool,
  getDataTool,
  getLogsTool,
  getPluginDataTool,
  describePluginTool,
  selectPlayerTool,
  invokeActionTool,
  handleListPlayers,
  handleGetPlayerStatus,
  handleGetFlow,
  handleGetData,
  handleGetLogs,
  handleGetPluginData,
  handleDescribePlugin,
  handleSelectPlayer,
  handleInvokeAction,
} from "./tools";

const ALL_TOOLS = [
  listPlayersTool,
  getPlayerStatusTool,
  getFlowTool,
  getDataTool,
  getLogsTool,
  getPluginDataTool,
  describePluginTool,
  selectPlayerTool,
  invokeActionTool,
];

export class MCPServer {
  private client: ExtensionClient;
  private server: Server;

  constructor(private transport: Transport) {
    this.client = createExtensionClient(transport);
    this.server = new Server(
      { name: "player-devtools", version: "0.0.1" },
      { capabilities: { tools: {} } },
    );
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ALL_TOOLS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const c = this.client;

      switch (name) {
        case "list_players":
          return handleListPlayers(c);
        case "get_player_status":
          return handleGetPlayerStatus(c, args);
        case "get_flow":
          return handleGetFlow(c, args);
        case "get_data":
          return handleGetData(c, args);
        case "get_logs":
          return handleGetLogs(c, args);
        case "get_plugin_data":
          return handleGetPluginData(c, args);
        case "describe_plugin":
          return handleDescribePlugin(c, args);
        case "select_player":
          return handleSelectPlayer(c, args);
        case "invoke_action":
          return handleInvokeAction(c, args);
        default:
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: `unknown tool: ${name}` }),
              },
            ],
          };
      }
    });
  }

  async start(): Promise<void> {
    const stdioTransport = new StdioServerTransport();
    await this.server.connect(stdioTransport);
    try {
      await this.transport.connect();
    } catch (err) {
      console.warn(
        "[MCPServer] Transport connect failed (will operate in disconnected mode):",
        err instanceof Error ? err.message : err,
      );
    }
  }

  async stop(): Promise<void> {
    this.client.destroy();
    await this.transport.close();
    await this.server.close();
  }
}
