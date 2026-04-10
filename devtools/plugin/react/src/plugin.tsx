import React from "react";
import {
  DevtoolsPlugin,
  type DevtoolsHandler,
  type PluginStore,
} from "@player-devtools/plugin";
import type { DevtoolsPluginInteractionEvent } from "@player-devtools/types";
import type { ReactPlayerPlugin, ReactPlayer } from "@player-ui/react";
import { WrapperComponent } from "./WrapperComponent";

/** Entrypoint for devtools plugins with [ReactPlayer]-specific components */
export abstract class ReactDevtoolsPlugin<T extends DevtoolsPlugin>
  implements ReactPlayerPlugin, DevtoolsHandler
{
  name: string = "ReactDevtoolPlugin";

  abstract corePlugin: T;

  get playerID(): string {
    return this.corePlugin.playerID;
  }

  get store(): PluginStore {
    return this.corePlugin.store;
  }

  processInteraction(interaction: DevtoolsPluginInteractionEvent): void {}

  checkIfDevtoolsIsActive(): boolean {
    return localStorage.getItem("player-ui-devtools-active") === "true";
  }

  applyReact(reactPlayer: ReactPlayer): void {
    if (!this.checkIfDevtoolsIsActive()) return;

    this.corePlugin.apply(reactPlayer.player);
    reactPlayer.hooks.webComponent.tap(this.name, (Component) => {
      const ReactDevtoolsComponent = () => (
        <WrapperComponent
          Component={Component}
          playerID={this.playerID}
          store={this.store}
          corePlugin={this.corePlugin}
          reactPlayer={reactPlayer}
        />
      );
      return ReactDevtoolsComponent;
    });
  }
}
