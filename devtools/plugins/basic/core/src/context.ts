import { defineContextKey } from "@player-ui/context-plugin";

/** Player version and the names of the plugins registered on it. */
export interface PlayerConfig {
  version: string;
  plugins: string[];
}

/** Published by the basic devtools plugin so other context consumers can read the Player config. */
export const playerConfigContextKey = defineContextKey<PlayerConfig>(
  "devtools.player.config",
  "Player version and the names of its registered plugins",
);
