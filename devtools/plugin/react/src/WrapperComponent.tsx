import React, { useEffect, useMemo } from "react";
import { Messenger } from "@player-devtools/messenger";
import { type DevtoolsPlugin, type PluginStore } from "@player-devtools/plugin";
import type {
  MessengerOptions,
  ExtensionSupportedEvents,
} from "@player-devtools/types";
import type { ReactPlayer } from "@player-ui/react";
import { useCommunicationLayer } from "./useCommunicationLayer";

export type WrapperComponentProps = {
  Component: React.ComponentType;
  playerID: string;
  store: PluginStore;
  corePlugin: DevtoolsPlugin;
  reactPlayer: ReactPlayer;
};

export const WrapperComponent = ({
  Component,
  playerID,
  store,
  corePlugin,
  reactPlayer,
}: WrapperComponentProps): React.JSX.Element => {
  const { sendMessage, addListener, removeListener } = useCommunicationLayer();

  const messenger = useMemo(() => {
    const options: MessengerOptions<ExtensionSupportedEvents> = {
      id: playerID,
      context: "player",
      messageCallback: (message) =>
        store.dispatch(message as Parameters<typeof store.dispatch>[0]),
      sendMessage,
      addListener,
      removeListener,
      logger: { log: reactPlayer.player.logger.info },
    };

    return new Messenger(options);
  }, [addListener, removeListener, sendMessage]);

  useEffect(() => {
    const unsubscribe = corePlugin.registerMessenger(messenger);
    return () => {
      unsubscribe();
      messenger.destroy();
    };
  }, [messenger]);

  return <Component />;
};
