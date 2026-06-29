# Player UI Devtools

Tools for inspecting and debugging live [Player UI](https://player-ui.github.io)
experiences across web, Android, and iOS. Devtools is itself plugin-driven: a
Devtools **plugin** runs inside the Player you want to inspect and publishes its
state; a Devtools **client** renders that state and sends interactions back.

## Architecture

Every part of Devtools is wired together by the [messenger](./devtools/messenger) — a
transport-agnostic, lossless protocol. A plugin on the Player side and a client
on the tooling side each run a `Messenger`; the plugin publishes Player state and
the client drives interactions.

```
        Player (web / Android / iOS)              Tooling
   ┌──────────────────────────────┐      ┌────────────────────────────┐
   │  Devtools plugin             │      │  Devtools client           │
   │  (basic, or your own)        │◀────▶│  • browser extension       │
   │    taps Player hooks         │ msgr │  • Flipper plugin (mobile) │
   │    publishes flow/data/logs  │      │  • MCP server (agents)     │
   └──────────────────────────────┘      └────────────────────────────┘
```

The content a plugin publishes is rendered by the clients as a Player experience
itself, using the [devtools-assets](https://github.com/player-ui/devtools-assets).

## Packages

### Foundations

| Package                    | Platforms          | Description                                             |
| -------------------------- | ------------------ | ------------------------------------------------------- |
| [`messenger`](./devtools/messenger) | TS · JVM · iOS     | The communication protocol all of Devtools is built on. |
| [`types`](./devtools/types)         | TS · iOS           | Shared event, transaction, and state types.             |
| [`utils`](./devtools/utils)         | TS · iOS · SwiftUI | Shared utilities (e.g. `dsetAssign`).                   |

### Plugins (Player side)

| Package                            | Platforms                                  | Description                                                                                                                              |
| ---------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [`plugin`](./devtools/plugin)               | TS · React · Android · JVM · iOS · SwiftUI | Base classes for building Devtools plugins.                                                                                              |
| [`plugins/basic`](./devtools/plugins/basic) | all of the above                           | The standard plugin — exposes flow, data, logs, config; supports expression evaluation and flow overrides. The reference implementation. |
| [`plugins/profiler`](./devtools/plugins/profiler) | all of the above                     | Profiles Player hook execution timing and exposes it as a flame graph. |

### Clients (tooling side)

| Package                              | Platform        | Description                                                                                              |
| ------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------- |
| [`client`](./devtools/client)                 | Web/React       | The `Panel` component that renders plugin content; embedded by the browser extension and Flipper plugin. |
| [`flipper-plugin`](./devtools/flipper-plugin) | Flipper desktop | Client for inspecting mobile (Android/iOS) Players.                                                      |
| [`mcp`](./devtools/mcp)                       | stdio / MCP     | Client that exposes Devtools to AI agents as MCP tools.                                                  |

> The browser-extension client lives in a separate repo:
> [player-ui/browser-devtools](https://github.com/player-ui/browser-devtools).

## Getting started

To debug an existing Player, add the [basic plugin](./devtools/plugins/basic) for your
platform and connect a client:

- **Web** — add `BasicReactDevtoolsPlugin` and activate the connection from the
  browser extension popup.
- **Mobile** — add the platform basic plugin and connect Flipper (see
  [`just install-flipper-client`](./devtools/flipper-plugin)).
- **Agents** — run the [MCP server](./devtools/mcp) against a running Flipper server.

To debug capabilities specific to your integration, build your own plugin on top
of the [`plugin`](./devtools/plugin) base classes — the basic plugin is the best
reference.

## Building

Devtools is built with [Bazel](https://bazel.build) via
[`rules_player`](https://github.com/player-ui/rules_player); common tasks are
wrapped in the repo `justfile` (e.g. `just install-flipper-client`, `just mcp`).
Each package's BUILD file uses the standard `rules_player` macros (`js_pipeline`,
`kt_jvm`, `kt_android`, `ios_library`, `swiftui_plugin`).
