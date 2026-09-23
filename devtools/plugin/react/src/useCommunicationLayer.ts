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

/**
 * The single communication proxy shared by every startFlipperConnection()
 * caller in this JS realm - analogous to Android's PlayerDevtoolsFlipperPlugin,
 * which every AndroidDevtoolsPlugin instance looks up and multiplexes over
 * rather than each owning its own FlipperClient registration.
 *
 * `status` surfaces bootstrap failure as inspectable data rather than a
 * promise rejection, so a caller that never checks it still gets a safe
 * no-op proxy instead of an unhandled rejection.
 */
type FlipperCommunicationProxy = {
  status: "connected" | "failed";
  sendMessage: (
    ...args: Parameters<CommunicationLayerMethods["sendMessage"]>
  ) => void;
  addListener: (listener: FlipperListener) => void;
  removeListener: (listener: FlipperListener) => void;
};

// Consumers may bundle multiple Player/plugin versions in the same app, each
// with its own copy of this module (and potentially its own js-flipper
// version) - a module-level mutex only dedupes within a single JS module
// instance, not across duplicated bundles sharing the same window. Keying off
// globalThis via Symbol.for gives every copy, regardless of bundle or
// js-flipper version, the same mutex/proxy so only the first copy to run ever
// calls flipperClient.start()/addPlugin(); every later copy just awaits the
// same promise and reads/writes the same shared proxy.
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
          // allow a future call to re-run start()/addPlugin() so the plugin
          // can reconnect after Flipper desktop closes/reopens or the
          // device connection drops
          delete (globalThis as GlobalWithFlipperProxy)[FLIPPER_PROXY_KEY];
        },
      });

      return proxy;
    })
    .catch((error) => {
      console.error("Failed to start Flipper client", error);
      // reset the mutex so a future call retries the bootstrap from scratch
      // instead of being permanently poisoned by this failure - the shared
      // promise itself never rejects, so a caller that doesn't check
      // `status` still gets a safe no-op proxy rather than an unhandled
      // rejection
      delete (globalThis as GlobalWithFlipperProxy)[FLIPPER_PROXY_KEY];

      return { ...proxy, status: "failed" as const };
    });
};

/**
 * Exported for tests: lets a caller await (and inspect the `status` of) the
 * same shared bootstrap that startFlipperConnection() fires-and-forgets.
 */
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
