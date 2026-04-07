import React, { Suspense, useEffect, useState } from "react";
import {
  type PluginClient,
  Layout,
  usePlugin,
  theme as baseTheme,
} from "flipper-plugin";
import type {
  CommunicationLayerMethods,
  ExtensionSupportedEvents,
  MessengerEvent,
  TransactionMetadata,
} from "@player-devtools/types";
import { Panel } from "@player-devtools/client";
import {
  Button,
  ChakraProvider,
  ColorModeScript,
  DarkMode,
  defineStyle,
  defineStyleConfig,
  extendTheme,
  Input,
  LightMode,
  ThemeConfig,
  useBoolean,
  useColorMode,
  theme as ChakraTheme,
  Box,
  Spinner,
} from "@chakra-ui/react";
import { ThemeProvider, useDarkMode } from "@devtools-ds/themes";
import { Select } from "./theme/select";
import { Table } from "./theme/table";

const ID = "flipper-plugin-player-ui-devtools";

type Events = {
  /** message received */
  "message::plugin": MessengerEvent<ExtensionSupportedEvents> &
    TransactionMetadata;
};

type Methods = {
  /** message sent */
  "message::flipper": (
    message: MessengerEvent<ExtensionSupportedEvents>,
  ) => Promise<void>;
};

/** Flipper desktop plugin */
export function plugin(
  client: PluginClient<Events, Methods>,
): CommunicationLayerMethods {
  const listeners: Array<
    (
      message: MessengerEvent<ExtensionSupportedEvents> & TransactionMetadata,
    ) => void
  > = [];

  client.onConnect(() => {
    client.onMessage("message::plugin", (message) => {
      listeners.forEach((listener) => listener(message));
    });
  });

  return {
    sendMessage: async (message: MessengerEvent<ExtensionSupportedEvents>) => {
      client.send("message::flipper", message);
    },
    addListener: (
      listener: (
        message: MessengerEvent<ExtensionSupportedEvents> & TransactionMetadata,
      ) => void,
    ) => {
      listeners.push(listener);
    },
    removeListener: (
      listener: (
        message: MessengerEvent<ExtensionSupportedEvents> & TransactionMetadata,
      ) => void,
    ) => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    },
  };
}

/** Flipper desktop plugin component */
export const Component: React.FC = () => {
  const communicationLayer = usePlugin(plugin);

  return (
    <Suspense fallback={<Spinner size="xl" />}>
      <Layout.Container id={ID} pad="medium">
        <Box
          sx={{
            // Scoped style fixes for our devtools client
            p: { margin: 0 },
          }}
        >
          <Panel communicationLayer={communicationLayer} />
        </Box>
      </Layout.Container>
    </Suspense>
  );
};
