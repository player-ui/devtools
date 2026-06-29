import type { ExtensionClient } from "@player-devtools/client";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { ToolDef } from "./index";

const describePluginShape = {
  playerId: z
    .string()
    .optional()
    .describe("Player ID. Defaults to the currently selected player."),
  pluginId: z.string().describe("Plugin ID."),
};

const DescribePluginInput = z.object(describePluginShape);

function err(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  };
}

function ok(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

export function handleDescribePlugin(
  client: ExtensionClient,
  input: unknown,
): CallToolResult {
  const { playerId, pluginId } = DescribePluginInput.parse(input);
  const { players, current } = client.getState();
  const id = playerId ?? current.player;
  if (!id) return err("no player selected");
  const player = players[id];
  if (!player) return err(`player not found: ${id}`);
  const plugin = player.plugins[pluginId];
  if (!plugin) return err(`plugin not found: ${pluginId}`);
  if (!plugin.capabilities)
    return err(`plugin "${pluginId}" has no capabilities declared`);
  return ok(plugin.capabilities);
}

export const describePluginDef: ToolDef = {
  name: "describe_plugin",
  description:
    "Get the capability descriptor declared by a plugin at registration time. Use this to discover what data keys and actions the plugin exposes.",
  inputSchema: describePluginShape,
  handle: handleDescribePlugin,
};
