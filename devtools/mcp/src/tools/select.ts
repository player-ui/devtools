import type { ExtensionClient } from "@player-devtools/client";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { ToolDef } from "./index";

const selectPlayerShape = {
  playerId: z.string().describe("The Player ID to select."),
};

const invokeActionShape = {
  playerId: z
    .string()
    .optional()
    .describe("Player ID. Defaults to the currently selected player."),
  pluginId: z.string().describe("Plugin ID."),
  action: z.string().describe("Action name."),
  payload: z.string().optional().describe("Optional stringified payload."),
};

const SelectPlayerInput = z.object(selectPlayerShape);

const InvokeActionInput = z.object(invokeActionShape);

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
  client.handleInteraction({ type: action, payload, target: id });
  return ok({ invoked: action });
}

export const selectPlayerDef: ToolDef = {
  name: "select_player",
  description:
    "Select a Player instance as the active target for subsequent tool calls.",
  inputSchema: selectPlayerShape,
  handle: handleSelectPlayer,
};

export const invokeActionDef: ToolDef = {
  name: "invoke_action",
  description:
    "Invoke a named action on a plugin. Use describe_plugin first to discover available actions.",
  inputSchema: invokeActionShape,
  handle: handleInvokeAction,
};
