import type { ExtensionClient } from "@player-devtools/client";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const listPlayersTool: Tool = {
  name: "list_players",
  description:
    "List all Player instances known to the devtools, and which one is currently selected.",
  inputSchema: { type: "object", properties: {}, required: [] },
};

export const getPlayerStatusTool: Tool = {
  name: "get_player_status",
  description:
    "Get the active status and registered plugin IDs for a Player instance.",
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

const GetPlayerStatusInput = z.object({ playerId: z.string().optional() });

export function handleListPlayers(client: ExtensionClient): CallToolResult {
  const { players, current } = client.getState();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          players: Object.keys(players),
          current: current.player,
        }),
      },
    ],
  };
}

export function handleGetPlayerStatus(
  client: ExtensionClient,
  input: unknown,
): CallToolResult {
  const { playerId } = GetPlayerStatusInput.parse(input);
  const { players, current } = client.getState();
  const id = playerId ?? current.player;
  if (!id) return errorResult("no player selected");
  const player = players[id];
  if (!player) return errorResult(`player not found: ${id}`);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          active: player.active,
          plugins: Object.keys(player.plugins),
        }),
      },
    ],
  };
}

function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  };
}
