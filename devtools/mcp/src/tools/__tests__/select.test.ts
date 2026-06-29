import { describe, it, expect, vi } from "vitest";
import type { ExtensionClient } from "@player-devtools/client";
import type { ExtensionState } from "@player-devtools/types";

import { handleInvokeAction } from "../select";

type Interaction = { type: string; payload?: string; target?: string };

/**
 * Build a fake ExtensionClient seeded with two players, the first selected.
 * `handleInteraction` is a spy so we can assert which player a message is
 * addressed to.
 */
function setup(selected = "player-a") {
  const handleInteraction = vi.fn<(interaction: Interaction) => void>();

  const players = {
    "player-a": {
      active: true,
      plugins: { pluginX: { id: "pluginX" } },
    },
    "player-b": {
      active: true,
      plugins: { pluginX: { id: "pluginX" } },
    },
  };

  const client = {
    getState: () =>
      ({
        players,
        current: { player: selected },
      }) as unknown as ExtensionState,
    handleInteraction,
  } as unknown as ExtensionClient;

  return { client, handleInteraction };
}

describe("handleInvokeAction", () => {
  it("addresses the message to the currently selected player when no playerId is given", () => {
    const { client, handleInteraction } = setup("player-a");

    handleInvokeAction(client, { pluginId: "pluginX", action: "next" });

    expect(handleInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "next", target: "player-a" }),
    );
  });

  // Negative/regression test: an explicit playerId that differs from the
  // selected player MUST be the target. The previous implementation validated
  // against the explicit id but then dropped it, letting handleInteraction
  // re-derive the target from current.player — so the message was sent to the
  // selected player instead. This asserts the message is NOT misrouted.
  it("addresses the message to the explicit playerId, not the selected player", () => {
    const { client, handleInteraction } = setup("player-a");

    handleInvokeAction(client, {
      playerId: "player-b",
      pluginId: "pluginX",
      action: "next",
    });

    const interaction = handleInteraction.mock.calls[0]?.[0];
    expect(interaction?.target).toBe("player-b");
    expect(interaction?.target).not.toBe("player-a");
  });
});
