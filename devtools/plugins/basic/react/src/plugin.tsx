import React from "react";
import type { ReactPlayer } from "@player-ui/react";
import { ReactDevtoolsPlugin } from "@player-devtools/plugin-react";
import { BasicDevtoolsPlugin } from "@player-devtools/basic-plugin";
import type { DevtoolsPluginInteractionEvent } from "@player-devtools/types";
import { WrapperComponent } from "./WrapperComponent";
import { DefaultBasicDevtoolsWrapper } from "./DefaultBasicDevtoolsWrapper";
import type { DevtoolsWrapperProps } from "./types";

export class BasicReactDevtoolsPlugin extends ReactDevtoolsPlugin<BasicDevtoolsPlugin> {
  name = "BasicReactDevtoolsPlugin";

  corePlugin: BasicDevtoolsPlugin;

  private wrapper: React.ComponentType<DevtoolsWrapperProps>;

  constructor(
    id?: string,
    wrapper?: React.ComponentType<DevtoolsWrapperProps>,
  ) {
    super();

    this.wrapper = wrapper ?? DefaultBasicDevtoolsWrapper;
    this.corePlugin = new BasicDevtoolsPlugin({
      playerID: id ?? "default-id",
      handler: this,
    });
  }

  applyReact(reactPlayer: ReactPlayer): void {
    if (!this.checkIfDevtoolsIsActive()) return;

    super.applyReact(reactPlayer);

    reactPlayer.hooks.webComponent.tap(this.name, (Component) => {
      const BasicReactDevtoolsComponent = () => (
        <WrapperComponent
          Component={Component}
          Wrapper={this.wrapper}
          store={this.store}
          playerID={this.playerID}
        />
      );

      return BasicReactDevtoolsComponent;
    });
  }

  processInteraction(interaction: DevtoolsPluginInteractionEvent): void {
    super.processInteraction(interaction);
  }
}
