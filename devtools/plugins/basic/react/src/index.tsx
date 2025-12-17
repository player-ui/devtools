import React, { useEffect, useState } from "react";
import { ReactPlayer } from "@player-ui/react";
import { ReactDevtoolsPlugin } from "@player-devtools/plugin-react";
import { BasicDevtoolsPlugin } from "@player-devtools/basic-plugin";
import type { DevtoolsPluginInteractionEvent } from "@player-devtools/types";

export class BasicReactDevtoolsPlugin extends ReactDevtoolsPlugin<BasicDevtoolsPlugin> {
  name = "BasicReactDevtoolsPlugin";

  corePlugin: BasicDevtoolsPlugin;

  constructor(id?: string) {
    super();

    this.corePlugin = new BasicDevtoolsPlugin({
      playerID: id ?? "default-id",
      handler: this,
    });
  }

  applyReact(reactPlayer: ReactPlayer): void {
    if (!this.checkIfDevtoolsIsActive()) return;

    super.applyReact(reactPlayer);

    reactPlayer.hooks.webComponent.tap(this.name, (Component) => {
      const BasicDevtoolsWrapper = () => {
        const [state, setState] = useState(this.store.getState());
        useEffect(() => this.store.subscribe(setState), [setState]);

        const [highlight, setHighlight] = useState(false);
        useEffect(() => {
          if (this.playerID === state.currentPlayer) {
            setHighlight(true);
            const timer = setTimeout(() => {
              setHighlight(false);
            }, 1000);
            return () => clearTimeout(timer);
          }
        }, [this.playerID, state.currentPlayer]);

        return (
          <div
            id={this.playerID}
            style={highlight ? { border: "2px solid blue" } : {}}
          >
            <Component />
          </div>
        );
      };

      return BasicDevtoolsWrapper;
    });
  }

  processInteraction(interaction: DevtoolsPluginInteractionEvent): void {
    super.processInteraction(interaction);
  }
}
