import type { ExtensionClient } from "@player-devtools/client";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { ok, err, type ToolDef } from "./index";

const playerIdShape = {
  playerId: z
    .string()
    .optional()
    .describe("Player ID. Defaults to the currently selected player."),
};

const GetPlayerStatusInput = z.object(playerIdShape);

export function handleListPlayers(client: ExtensionClient): CallToolResult {
  const { players, current } = client.getState();
  return ok({ players: Object.keys(players), current: current.player });
}

export function handleGetPlayerStatus(
  client: ExtensionClient,
  input: unknown,
): CallToolResult {
  const { playerId } = GetPlayerStatusInput.parse(input);
  const { players, current } = client.getState();
  const id = playerId ?? current.player;
  if (!id) return err("no player selected");
  const player = players[id];
  if (!player) return err(`player not found: ${id}`);
  return ok({ active: player.active, plugins: Object.keys(player.plugins) });
}

export const listPlayersDef: ToolDef = {
  name: "list_players",
  description:
    "List all Player instances known to the devtools, and which one is currently selected.",
  inputSchema: {},
  handle: (client) => handleListPlayers(client),
};

export const getPlayerStatusDef: ToolDef = {
  name: "get_player_status",
  description:
    "Get the active status and registered plugin IDs for a Player instance.",
  inputSchema: playerIdShape,
  handle: handleGetPlayerStatus,
};
