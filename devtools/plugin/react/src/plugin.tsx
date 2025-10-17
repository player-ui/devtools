import React, { useEffect, useMemo } from 'react';
import { Messenger } from "@player-devtools/messenger";
import { DevtoolsPlugin, type DevtoolsHandler, type PluginStore } from "@player-devtools/plugin";
import type { MessengerOptions, ExtensionSupportedEvents, DevtoolsPluginInteractionEvent } from "@player-devtools/types";
import type { ReactPlayerPlugin, ReactPlayer } from "@player-ui/react";
import {useCommunicationLayer} from "./useCommunicationLayer";

/** Entrypoint for devtools plugins with [ReactPlayer]-specific components */
export abstract class ReactDevtoolsPlugin<T extends DevtoolsPlugin> implements ReactPlayerPlugin, DevtoolsHandler {
    name: string = "ReactDevtoolPlugin";

    abstract corePlugin: T;

    get playerID(): string {
        return this.corePlugin.playerID
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

        reactPlayer.hooks.webComponent.tap(this.name, (Component) => () => {
            const { sendMessage, addListener, removeListener } = useCommunicationLayer();

            const messenger = useMemo(() => {
                const options: MessengerOptions<ExtensionSupportedEvents> = {
                    id: this.playerID,
                    context: "player",
                    messageCallback: (message) =>
                        this.store.dispatch(message as Parameters<typeof this.store.dispatch>[0]),
                    sendMessage,
                    addListener,
                    removeListener,
                    logger: { log: reactPlayer.player.logger.info },
                };

                return new Messenger(options);
            }, [addListener, removeListener, sendMessage]);

            useEffect(() => {
                const unsubscribe = this.corePlugin.registerMessenger(messenger)
                return () => {
                    unsubscribe();
                    messenger.destroy();
                }
            }, [messenger]);

            return <><Component /></>;
        });
    }
}
