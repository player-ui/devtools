import type { ExtensionClient } from "@player-devtools/client";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const selectPlayerTool: Tool = {
  name: "select_player",
  description:
    "Select a Player instance as the active target for subsequent tool calls.",
  inputSchema: {
    type: "object",
    properties: {
      playerId: { type: "string", description: "The Player ID to select." },
    },
    required: ["playerId"],
  },
};

export const invokeActionTool: Tool = {
  name: "invoke_action",
  description:
    "Invoke a named action on a plugin. Use describe_plugin first to discover available actions.",
  inputSchema: {
    type: "object",
    properties: {
      playerId: {
        type: "string",
        description: "Player ID. Defaults to the currently selected player.",
      },
      pluginId: { type: "string", description: "Plugin ID." },
      action: { type: "string", description: "Action name." },
      payload: { type: "string", description: "Optional stringified payload." },
    },
    required: ["pluginId", "action"],
  },
};

const SelectPlayerInput = z.object({ playerId: z.string() });

const InvokeActionInput = z.object({
  playerId: z.string().optional(),
  pluginId: z.string(),
  action: z.string(),
  payload: z.string().optional(),
});

function err(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  };
}

function ok(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

export function handleSelectPlayer(
  client: ExtensionClient,
  input: unknown,
): CallToolResult {
  const { playerId } = SelectPlayerInput.parse(input);
  const { players } = client.getState();
  if (!players[playerId]) return err(`player not found: ${playerId}`);
  client.selectPlayer(playerId);
  return ok({ selected: playerId });
}

export function handleInvokeAction(
  client: ExtensionClient,
  input: unknown,
): CallToolResult {
  const { playerId, pluginId, action, payload } =
    InvokeActionInput.parse(input);
  const { players, current } = client.getState();
  const id = playerId ?? current.player;
  if (!id) return err("no player selected");
  const player = players[id];
  if (!player) return err(`player not found: ${id}`);
  const plugin = player.plugins[pluginId];
  if (!plugin) return err(`plugin not found: ${pluginId}`);
  if (
    plugin.capabilities?.actions &&
    !(action in plugin.capabilities.actions)
  ) {
    return err(`action "${action}" not declared in plugin capabilities`);
  }
  client.handleInteraction({ type: action, payload });
  return ok({ invoked: action });
}
