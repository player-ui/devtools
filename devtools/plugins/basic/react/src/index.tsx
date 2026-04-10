import React, { useEffect, useState } from "react";
import type { ReactPlayer } from "@player-ui/react";
import { ReactDevtoolsPlugin } from "@player-devtools/plugin-react";
import { BasicDevtoolsPlugin } from "@player-devtools/basic-plugin";
import type { DevtoolsPluginInteractionEvent } from "@player-devtools/types";
import { WrapperComponent, type DevtoolsWrapperProps } from "./WrapperComponent";

export type { DevtoolsWrapperProps };

const BasicDevtoolsWrapper = ({
  state,
  playerID,
  children,
}: DevtoolsWrapperProps) => {
  const [highlight, setHighlight] = useState(false);
  useEffect(() => {
    if (playerID === state.currentPlayer) {
      setHighlight(true);
      const timer = setTimeout(() => {
        setHighlight(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [playerID, state.currentPlayer]);

  return (
    <div id={playerID} style={highlight ? { border: "2px solid blue" } : {}}>
      {children}
    </div>
  );
};

export class BasicReactDevtoolsPlugin extends ReactDevtoolsPlugin<BasicDevtoolsPlugin> {
  name = "BasicReactDevtoolsPlugin";

  corePlugin: BasicDevtoolsPlugin;

  private wrapper: React.ComponentType<DevtoolsWrapperProps>;

  constructor(
    id?: string,
    wrapper?: React.ComponentType<DevtoolsWrapperProps>,
  ) {
    super();

    this.wrapper = wrapper ?? BasicDevtoolsWrapper;
    this.corePlugin = new BasicDevtoolsPlugin({
      playerID: id ?? "default-id",
      handler: this,
    });
  }

  applyReact(reactPlayer: ReactPlayer): void {
    if (!this.checkIfDevtoolsIsActive()) return;

    super.applyReact(reactPlayer);

    reactPlayer.hooks.webComponent.tap(this.name, (Component) => {
      return () => (
        <WrapperComponent
          Component={Component}
          Wrapper={this.wrapper}
          store={this.store}
          playerID={this.playerID}
        />
      );
    });
  }

  processInteraction(interaction: DevtoolsPluginInteractionEvent): void {
    super.processInteraction(interaction);
  }
}
