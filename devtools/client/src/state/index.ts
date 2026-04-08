import type { CommunicationLayerMethods } from "@player-devtools/types";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { createExtensionClient } from "./client";

/**
 * Thin React adapter over `createExtensionClient`.
 *
 * Creates the client once per `communicationLayer` identity, subscribes to
 * state via `useSyncExternalStore`, and tears down the Messenger on unmount.
 */
export const useExtensionState = ({
  communicationLayer,
}: {
  /** the communication layer to use for the extension */
  communicationLayer: CommunicationLayerMethods;
}) => {
  const client = useMemo(
    () => createExtensionClient(communicationLayer),
    [communicationLayer],
  );

  useEffect(() => () => client.destroy(), [client]);

  const state = useSyncExternalStore(client.subscribe, client.getState);

  return {
    state,
    selectPlayer: client.selectPlayer,
    selectPlugin: client.selectPlugin,
    handleInteraction: client.handleInteraction,
  };
};
