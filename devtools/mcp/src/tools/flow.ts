import type { ExtensionClient } from "@player-devtools/client";
import type { PluginData } from "@player-devtools/types";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type Failure = { error: string };
type PlayerOk = {
  id: string;
  player: {
    plugins: Record<string, PluginData>;
    active: boolean;
    config: Record<string, unknown>;
  };
};
type BasicPluginOk = PlayerOk & { basicPlugin: PluginData };

const PlayerInput = z.object({ playerId: z.string().optional() });

export const getFlowTool: Tool = {
  name: "get_flow",
  description:
    "Get the current flow from the basic devtools plugin for a Player instance.",
  inputSchema: {
    type: "object",
    properties: {
      playerId: {
        type: "string",
        description: "Player ID. Defaults to the currently selected player.",
      },
    },
    required: [],
  },
};

export const getDataTool: Tool = {
  name: "get_data",
  description:
    "Get the current flow data model from the basic devtools plugin for a Player instance.",
  inputSchema: {
    type: "object",
    properties: {
      playerId: {
        type: "string",
        description: "Player ID. Defaults to the currently selected player.",
      },
    },
    required: [],
  },
};

export const getLogsTool: Tool = {
  name: "get_logs",
  description:
    "Get the logs from the basic devtools plugin for a Player instance.",
  inputSchema: {
    type: "object",
    properties: {
      playerId: {
        type: "string",
        description: "Player ID. Defaults to the currently selected player.",
      },
    },
    required: [],
  },
};

export const getPluginDataTool: Tool = {
  name: "get_plugin_data",
  description: "Get a specific data key from any plugin for a Player instance.",
  inputSchema: {
    type: "object",
    properties: {
      playerId: {
        type: "string",
        description: "Player ID. Defaults to the currently selected player.",
      },
      pluginId: { type: "string", description: "Plugin ID." },
      dataKey: {
        type: "string",
        description: "Key to retrieve from the plugin's data.",
      },
    },
    required: ["pluginId", "dataKey"],
  },
};

function resolvePlayer(
  client: ExtensionClient,
  playerId?: string,
): Failure | PlayerOk {
  const { players, current } = client.getState();
  const id = playerId ?? current.player;
  if (!id) return { error: "no player selected" };
  const player = players[id];
  if (!player) return { error: `player not found: ${id}` };
  return { id, player };
}

function resolveBasicPlugin(
  client: ExtensionClient,
  playerId?: string,
): Failure | BasicPluginOk {
  const resolved = resolvePlayer(client, playerId);
  if ("error" in resolved) return resolved;
  const { id, player } = resolved;
  // Find the first plugin — by convention the basic plugin is registered first
  const [basicPlugin] = Object.values(player.plugins);
  if (!basicPlugin) return { error: "no plugin registered for this player" };
  return { id, player, basicPlugin };
}

function ok(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function err(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  };
}

export function handleGetFlow(
  client: ExtensionClient,
  input: unknown,
): CallToolResult {
  const { playerId } = PlayerInput.parse(input);
  const resolved = resolveBasicPlugin(client, playerId);
  if ("error" in resolved) return err(resolved.error);
  return ok(resolved.basicPlugin.flow);
}

export function handleGetData(
  client: ExtensionClient,
  input: unknown,
): CallToolResult {
  const { playerId } = PlayerInput.parse(input);
  const resolved = resolveBasicPlugin(client, playerId);
  if ("error" in resolved) return err(resolved.error);
  return ok(resolved.basicPlugin.flow?.data ?? null);
}

export function handleGetLogs(
  client: ExtensionClient,
  input: unknown,
): CallToolResult {
  const { playerId } = PlayerInput.parse(input);
  const resolved = resolveBasicPlugin(client, playerId);
  if ("error" in resolved) return err(resolved.error);
  // Logs live in the plugin's flow data under a "logs" key by convention
  return ok(
    (resolved.basicPlugin.flow?.data as Record<string, unknown>)?.logs ?? [],
  );
}

const GetPluginDataInput = z.object({
  playerId: z.string().optional(),
  pluginId: z.string(),
  dataKey: z.string(),
});

export function handleGetPluginData(
  client: ExtensionClient,
  input: unknown,
): CallToolResult {
  const { playerId, pluginId, dataKey } = GetPluginDataInput.parse(input);
  const resolved = resolvePlayer(client, playerId);
  if ("error" in resolved) return err(resolved.error);
  const plugin = resolved.player.plugins[pluginId];
  if (!plugin) return err(`plugin not found: ${pluginId}`);
  const value = (plugin.flow?.data as Record<string, unknown> | undefined)?.[
    dataKey
  ];
  return ok(value ?? null);
}
