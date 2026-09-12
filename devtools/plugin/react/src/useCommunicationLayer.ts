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

// keep track of the Flipper connection between React renders
let flipperConnection: FlipperPluginConnection | null = null;

// shared across every startFlipperConnection() caller so a plugin instance that
// registers before or after the connection is established still receives messages
const flipperListeners = new Set<FlipperListener>();

// module-level bootstrap mutex: js-flipper's own start()/addPlugin() are not
// safe to call more than once (see FlipperClient internals) - every caller must
// await this SAME promise rather than issuing its own start()/addPlugin() call,
// or the second registration silently overwrites the first under the shared
// "player-ui-devtools" plugin id and that instance's connection never resolves
let flipperBootstrapPromise: Promise<void> | null = null;

const ensureFlipperConnectionStarted = (): Promise<void> => {
  if (!flipperBootstrapPromise) {
    flipperBootstrapPromise = flipperClient
      .start("player-ui-devtools")
      .then(() => {
        flipperClient.addPlugin({
          getId() {
            return "player-ui-devtools";
          },
          onConnect(conn) {
            flipperConnection = conn;

            conn.receive("message::flipper", (message) => {
              flipperListeners.forEach((listener) => listener(message));
            });
          },
          onDisconnect() {
            console.log("Flipper client disconnected");
            flipperConnection = null;
          },
        });
      })
      .catch((error) => {
        console.error("Failed to start Flipper client", error);
      });
  }

  return flipperBootstrapPromise;
};

/** Adds a Flipper client and starts the connection */
export const startFlipperConnection = (
  setLayerCallbacks: (
    value: React.SetStateAction<IntoArrays<CommunicationLayerMethods>>,
  ) => void,
): void => {
  void ensureFlipperConnectionStarted();

  const sendMessage: CommunicationLayerMethods["sendMessage"] = async (
    message,
  ) => {
    flipperConnection?.send("message::plugin", message);
  };

  const addListener: CommunicationLayerMethods["addListener"] = (listener) => {
    flipperListeners.add(listener);
  };

  setLayerCallbacks((current) => ({
    sendMessage: [...current.sendMessage, sendMessage],
    addListener: [...current.addListener, addListener],
    removeListener: current.removeListener,
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
