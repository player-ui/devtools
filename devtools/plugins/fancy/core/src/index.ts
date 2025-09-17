import type { Player, PlayerPlugin } from "@player-ui/player";

/// This plugin will allow a user to toggle a "fancy" UI mode in the Player
export class FancyPlugin implements PlayerPlugin {
  // You must identify your plugin with a unique name
  name = "fancy-plugin";

  private isFancy: boolean;

  constructor(isFancy: boolean = false) {
    this.isFancy = isFancy;
  }

  apply(player: Player): void {
    // Log the plugin name and whether fancy mode is enabled
    player.logger.info(
      `Applying core ${this.name} plugin with fancy mode: ${this.isFancy}`,
    );
  }
}
