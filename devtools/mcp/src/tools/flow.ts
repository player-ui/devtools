import type { ExtensionClient } from "@player-devtools/client";
import type { PluginData } from "@player-devtools/types";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { ToolDef } from "./index";

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

/** Optional player id, shared by the player-scoped read tools. */
const playerIdShape = {
  playerId: z
    .string()
    .optional()
    .describe("Player ID. Defaults to the currently selected player."),
};

const PlayerInput = z.object(playerIdShape);

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

const getPluginDataShape = {
  ...playerIdShape,
  pluginId: z.string().describe("Plugin ID."),
  dataKey: z.string().describe("Key to retrieve from the plugin's data."),
};

const GetPluginDataInput = z.object(getPluginDataShape);

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

export const getFlowDef: ToolDef = {
  name: "get_flow",
  description:
    "Get the current flow from the basic devtools plugin for a Player instance.",
  inputSchema: playerIdShape,
  handle: handleGetFlow,
};

export const getDataDef: ToolDef = {
  name: "get_data",
  description:
    "Get the current flow data model from the basic devtools plugin for a Player instance.",
  inputSchema: playerIdShape,
  handle: handleGetData,
};

export const getLogsDef: ToolDef = {
  name: "get_logs",
  description:
    "Get the logs from the basic devtools plugin for a Player instance.",
  inputSchema: playerIdShape,
  handle: handleGetLogs,
};

export const getPluginDataDef: ToolDef = {
  name: "get_plugin_data",
  description: "Get a specific data key from any plugin for a Player instance.",
  inputSchema: getPluginDataShape,
  handle: handleGetPluginData,
};
