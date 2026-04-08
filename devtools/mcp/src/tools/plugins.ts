import type { ExtensionClient } from "@player-devtools/client";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const describePluginTool: Tool = {
  name: "describe_plugin",
  description:
    "Get the capability descriptor declared by a plugin at registration time. Use this to discover what data keys and actions the plugin exposes.",
  inputSchema: {
    type: "object",
    properties: {
      playerId: {
        type: "string",
        description: "Player ID. Defaults to the currently selected player.",
      },
      pluginId: { type: "string", description: "Plugin ID." },
    },
    required: ["pluginId"],
  },
};

const DescribePluginInput = z.object({
  playerId: z.string().optional(),
  pluginId: z.string(),
});

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
