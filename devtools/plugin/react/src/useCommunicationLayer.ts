import { useEffect, useState } from "react";
import { type FlipperPluginConnection, flipperClient } from "js-flipper";
import type {
  ExtensionSupportedEvents,
  MessengerEvent,
  MessengerOptions,
  TransactionMetadata,
} from "@player-devtools/types";

type IntoArrays<T> = {
  [P in keyof T]: T[P][];
};

type CommunicationLayerMethods = Pick<
  MessengerOptions<ExtensionSupportedEvents>,
  "sendMessage" | "addListener" | "removeListener"
>;

type Callbacks = IntoArrays<CommunicationLayerMethods>;

type FlipperListener = (
  message: TransactionMetadata & MessengerEvent<ExtensionSupportedEvents>,
) => void;

// Shared across every startFlipperConnection() caller, like Android's
// PlayerDevtoolsFlipperPlugin. `status` surfaces bootstrap failure as data
// instead of a rejection, so an unchecked caller still gets a safe no-op.
type FlipperCommunicationProxy = {
  status: "connected" | "failed";
  sendMessage: (
    ...args: Parameters<CommunicationLayerMethods["sendMessage"]>
  ) => void;
  addListener: (listener: FlipperListener) => void;
  removeListener: (listener: FlipperListener) => void;
};

// globalThis-keyed so duplicated bundles (multiple Player/plugin versions,
// each with their own copy of this module/js-flipper) share one mutex.
const FLIPPER_PROXY_KEY = Symbol.for("player-ui-devtools/flipper-proxy");

type GlobalWithFlipperProxy = typeof globalThis & {
  [FLIPPER_PROXY_KEY]?: Promise<FlipperCommunicationProxy>;
};

const createFlipperProxy = (): Promise<FlipperCommunicationProxy> => {
  const listeners = new Set<FlipperListener>();
  let connection: FlipperPluginConnection | null = null;

  const proxy: FlipperCommunicationProxy = {
    status: "connected",
    sendMessage: (message) => {
      connection?.send("message::plugin", message);
    },
    addListener: (listener) => {
      listeners.add(listener);
    },
    removeListener: (listener) => {
      listeners.delete(listener);
    },
  };

  return flipperClient
    .start("player-ui-devtools")
    .then(() => {
      flipperClient.addPlugin({
        getId() {
          return "player-ui-devtools";
        },
        onConnect(conn) {
          connection = conn;

          conn.receive("message::flipper", (message) => {
            listeners.forEach((listener) => listener(message));
          });
        },
        onDisconnect() {
          console.log("Flipper client disconnected");
          connection = null;
          // js-flipper reconnects by calling onConnect() again on this same
          // plugin object - no addPlugin() re-run needed, so don't reset
          // the global proxy (that would drop the shared listeners).
        },
      });

      return proxy;
    })
    .catch((error) => {
      console.error("Failed to start Flipper client", error);
      // reset the mutex so a later call retries instead of staying poisoned
      delete (globalThis as GlobalWithFlipperProxy)[FLIPPER_PROXY_KEY];

      return { ...proxy, status: "failed" as const };
    });
};

/** Exported for tests to await/inspect the shared bootstrap's `status`. */
export const ensureFlipperConnectionStarted =
  (): Promise<FlipperCommunicationProxy> => {
    const globalWithProxy = globalThis as GlobalWithFlipperProxy;

    globalWithProxy[FLIPPER_PROXY_KEY] ??= createFlipperProxy();

    return globalWithProxy[FLIPPER_PROXY_KEY];
  };

/** Adds a Flipper client and starts the connection */
export const startFlipperConnection = (
  setLayerCallbacks: (
    value: React.SetStateAction<IntoArrays<CommunicationLayerMethods>>,
  ) => void,
): void => {
  const proxyPromise = ensureFlipperConnectionStarted();

  const sendMessage: CommunicationLayerMethods["sendMessage"] = async (
    message,
  ) => {
    (await proxyPromise).sendMessage(message);
  };

  const addListener: CommunicationLayerMethods["addListener"] = (listener) => {
    void proxyPromise.then((proxy) => proxy.addListener(listener));
  };

  const removeListener: CommunicationLayerMethods["removeListener"] = (
    listener,
  ) => {
    void proxyPromise.then((proxy) => proxy.removeListener(listener));
  };

  setLayerCallbacks((current) => ({
    sendMessage: [...current.sendMessage, sendMessage],
    addListener: [...current.addListener, addListener],
    removeListener: [...current.removeListener, removeListener],
  }));
};

/** Web extension communication layer leverage by the @player-devtools/messenger */
export const useCommunicationLayer = (): CommunicationLayerMethods => {
  const flipperConnectionIsActive = localStorage.getItem(
    "player-ui-devtools-flipper-active",
  );

  const [layerCallbacks, setLayerCallbacks] = useState<Callbacks>({
    sendMessage: [],
    addListener: [],
    removeListener: [],
  });

  useEffect(() => {
    if (flipperConnectionIsActive === "true") {
      startFlipperConnection(setLayerCallbacks);
    } else {
      console.warn(
        "The Flipper connection is disabled. If you want to enable it, use the Player UI extension popup.",
      );
    }

    let windowListener: null | ((event: MessageEvent) => void) = null;

    setLayerCallbacks((current) => ({
      sendMessage: [
        ...current.sendMessage,
        async (message) => {
          window.postMessage(message, "*");
        },
      ],
      addListener: [
        ...current.addListener,
        (listener) => {
          windowListener = (event: MessageEvent) => listener(event.data);
          window.addEventListener("message", windowListener);
        },
      ],
      removeListener: [
        ...current.removeListener,
        () => {
          if (windowListener) {
            window.removeEventListener("message", windowListener);
          }
        },
      ],
    }));
  }, []);

  return {
    sendMessage: async (message) => {
      layerCallbacks.sendMessage.forEach((callback) => callback(message));
    },
    addListener: (listener) => {
      layerCallbacks.addListener.forEach((callback) => callback(listener));
    },
    removeListener: (listener) => {
      layerCallbacks.removeListener.forEach((callback) => callback(listener));
    },
  };
};
