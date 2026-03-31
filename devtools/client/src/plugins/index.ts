import DevtoolsUIAssetsPlugin from "@devtools-ui/plugin";
import { PubSubPlugin } from "@player-ui/pubsub-plugin";
import { CommonExpressionsPlugin } from "@player-ui/common-expressions-plugin";
import { CommonTypesPlugin } from "@player-ui/common-types-plugin";
import { DataChangeListenerPlugin } from "@player-ui/data-change-listener-plugin";
import {
  ConsoleLogger,
  Player,
  PlayerPlugin,
  ReactPlayer,
  type ReactPlayerPlugin,
} from "@player-ui/react";

class LogForwarder implements PlayerPlugin, ReactPlayerPlugin {
  name = "Log";
  apply(player: Player) {
    player.logger.addHandler(new ConsoleLogger("trace", console));
  }

  applyReact(reactPlayer: ReactPlayer) {
    this.apply(reactPlayer.player);
  }
}

export const PUBSUB_PLUGIN = new PubSubPlugin();

export const PLAYER_PLUGINS: ReactPlayerPlugin[] = [
  new CommonTypesPlugin(),
  new CommonExpressionsPlugin(),
  new DataChangeListenerPlugin(),
  new DevtoolsUIAssetsPlugin(),
  new LogForwarder(),
  PUBSUB_PLUGIN,
];
