/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Preview } from "@storybook/react";
import {
  ConsoleLogger,
  type Player,
  type PlayerPlugin,
  type ReactPlayer,
  type ReactPlayerPlugin,
} from "@player-ui/react";
import { PlayerDecorator } from "@player-ui/storybook";
import { ExampleReactPlayerPlugin } from "@player-example/plugin-react";
import * as ExampleComponents from "@player-example/components";
import RefXLR from "@player-example/plugin-core/xlr";

// Adds `player` instance to window for console access
class DebugPlugin implements PlayerPlugin, ReactPlayerPlugin {
  name = "debug-plugin";

  applyReact(reactPlayer: ReactPlayer) {
    // @ts-ignore
    window.reactPlayer = reactPlayer;
  }

  apply(player: Player) {
    // @ts-ignore
    window.player = player;
    player.logger.addHandler(new ConsoleLogger("trace"));
  }
}

const reactPlayerPlugins = [new DebugPlugin(), new ExampleReactPlayerPlugin()];

export const parameters = {
  reactPlayerPlugins,
  assetXLRSources: [RefXLR],
  dslEditor: {
    additionalModules: {
      "@player-example/components": ExampleComponents,
    },
  },
  options: {
    storySort: {
      order: ["Welcome", "Example Player Assets", ["Docs"]],
    },
  },
};

const preview: Preview = {
  parameters,
  decorators: [PlayerDecorator] as Preview["decorators"],
};

export default preview;
