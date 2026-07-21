# Player UI Devtools client

The devtools client is split into two packages so headless consumers never load React:

- [`core/`](./core) — `@player-devtools/client`: the headless client (`createExtensionClient`, state reducer). No React. Consumed by the agent-facing [MCP server](../mcp).
- [`react/`](./react) — `@player-devtools/client-react`: the React `Panel` with the ReactPlayer, responsible for rendering content sent by Player devtool plugins on the inspected Player UI instance.

The `Panel` is the shared devtools UI surface, hosted by each client: the [browser extension](https://github.com/player-ui/browser-devtools) for web and the [Flipper plugin](../flipper-plugin) for mobile. The agent-facing [MCP server](../mcp) consumes the same Player devtools instrumentation via the headless `@player-devtools/client` core, without rendering the `Panel`.

## Installation

The Devtools client is available as an npm package. You can install it using npm or yarn:

```bash
npm install @player-devtools/client-react
```

```bash
yarn add @player-devtools/client-react
```

## Overview

The Devtools client is a part of the Player UI Devtools architecture. It allows you to create custom devtools panels that can be used to debug and inspect your Player UI experiences, using the same plugin system used by other Player UI plugins.

The Devtools client conveniently receives its content from the devtools plugins running into the Player UI in use by the inspected page. This feature allows you to extend the dev tools with custom panels, without the need to create a new extension. You can create your own devtools plugins and use them in the Player UI Devtools Browser Extension.

For a more comprehensive understanding of the architecture of the Devtools client, see the [Devtools root README](../../README.md) for the overall picture and the [plugin authoring guide](../plugin) for how plugins instrument a Player and feed content to this client.

## Usage

The Devtools client is a React component that receives content from devtools plugins running in the Player UI used by the inspected page. It can be used in your React application like any other React component.

```jsx
import { Panel } from "@player-devtools/client-react";
import type { MessengerOptions } from "@player-devtools/messenger";
import browser from "webextension-polyfill";

const port = browser.runtime.connect();

const communicationLayer: Pick<
  MessengerOptions,
  "sendMessage" | "addListener" | "removeListener"
> = {
  sendMessage: async (message) =>
    port.postMessage({
      tabId: browser.devtools.inspectedWindow.tabId,
      body: message,
    }),
  addListener: (callback) => {
    port.onMessage.addListener(({ body }) => callback(body));
  },
  removeListener: (callback) => {
    port.onMessage.removeListener(callback);
  },
};

root.render(<Panel communicationLayer={communicationLayer} />);
```

## Related

- Sibling clients that host this `Panel`: the [Flipper plugin](../flipper-plugin) (mobile) and the browser extension (web).
- [`../mcp`](../mcp) — the agent-facing devtools surface.
- [`../README.md`](../../README.md) — the overall Player UI Devtools architecture.

## Contributing

We welcome contributions to the Player UI Devtools.
