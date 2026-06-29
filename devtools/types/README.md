# Devtools Types

The **Devtools Types** family is the shared type vocabulary for the Player UI
Devtools. Every other devtools package — the [plugins](../plugins), the
[client](../client), the [messenger](../messenger), the [Flipper plugin](../flipper-plugin),
and the [MCP server](../mcp) — speaks in the events and shapes defined here, so
the wire format between a running Player and a devtools client is described in
exactly one place.

There is no runtime behavior in this family. It is **types only**: the TypeScript
package compiles to declarations, and the Swift package mirrors the same
contracts as protocols and structs so the iOS side can construct and decode the
identical messages.

This directory contains **two** packages:

| Package | Name / Product | Platform | Role |
| --- | --- | --- | --- |
| [`core`](#core--player-devtoolstypes) | `@player-devtools/types` | TypeScript | The canonical event + option type definitions. |
| [`ios`](#ios--playeruidevtoolstypes) | `PlayerUIDevtoolsTypes` | Swift | The Swift mirror — `BaseEvent` protocol + `InternalEvent` / `MessengerOptions`. |

```
                @player-devtools/types  (TS, canonical)
                          │  mirrored by
                          ▼
                PlayerUIDevtoolsTypes  (Swift)
                          │
   ┌──────────────────────┼───────────────────────┐
   ▼                      ▼                         ▼
messenger / plugins   client / Flipper plugin    MCP server
```

## Installation

**Web / TypeScript** (npm):

```bash
npm install @player-devtools/types
```

**iOS** (Swift Package Manager — a product of the `PlayerUIDevtools` package at
https://github.com/player-ui/player):

```swift
.product(name: "PlayerUIDevtoolsTypes", package: "PlayerUIDevtools")
```

> Published versions are stamped at release time (sources here read
> `0.0.0-PLACEHOLDER`); pin the current release version when you add the
> dependency.

## The `BaseEvent` / `ExtensionSupportedEvents` pattern

Everything that travels between a Player and a devtools client is a
**`BaseEvent`** — a discriminated union member with a string `type`, a typed
`payload`, and an optional `target`:

```ts
interface BaseEvent<T extends string, P = null> {
  type: T;       // the discriminant, e.g. "PLAYER_DEVTOOLS_PLUGIN_DATA_CHANGE"
  payload: P;
  target?: string;
}
```

Concrete events are declared by fixing those generics — for example
`DevtoolsDataChangeEvent = BaseEvent<"PLAYER_DEVTOOLS_PLUGIN_DATA_CHANGE", DataChangePayload>`.
They are then collected into the **`ExtensionSupportedEvents`** union, which is
the complete set of messages a devtools client understands:

```
ExtensionSupportedEvents =
  PlayerInitEvent | DevtoolsFlowChangeEvent | DevtoolsDataChangeEvent
  | PlayerStoppedEvent | DevtoolsEventsBatchEvent
  | ExtensionSelectedPlayerEvent | ExtensionSelectedPluginEvent
  | BeaconEvent | DisconnectEvent
  | DevtoolsPluginInteractionEvent | DevtoolsPluginSelectedPlayerEvent
```

This is the **extension point** of the whole system. To teach the devtools about
a new message, declare a `BaseEvent<...>` alias and add it to
`ExtensionSupportedEvents`; every consumer that is parameterized over the union
(the messenger, the store, the client) picks it up and stays exhaustively typed.
The [messenger](../messenger) is generic over `T extends BaseEvent<string, unknown>`
precisely so it can carry whatever union you give it.

## `core` — `@player-devtools/types`

The canonical definitions. The public surface groups into three concerns.

### Event vocabulary

| Type | Purpose |
| --- | --- |
| `BaseEvent<T, P>` | The base discriminated-union shape every event extends. |
| `MessengerEvent<T>` | `T` (a domain event) **or** an `InternalEvent<T>` — what actually flows over the wire. |
| `InternalEvent<T>` | The messenger's own plumbing events (see below). |
| `BeaconEvent` | `MESSENGER_BEACON` — a heartbeat announcing a messenger exists. |
| `EventsBatchEvent<T>` | `MESSENGER_EVENT_BATCH` — many events delivered at once. |
| `RequestLostEventsEvent` | `MESSENGER_REQUEST_LOST_EVENTS` — request a resend of missed events. |
| `DisconnectEvent` | `MESSENGER_DISCONNECT` — a messenger is going away. |
| `ExtensionSupportedEvents` | The full union of events a devtools client handles. |

The `PLAYER_DEVTOOLS_*` domain events (`PlayerInitEvent`,
`DevtoolsFlowChangeEvent`, `DevtoolsDataChangeEvent`, `PlayerStoppedEvent`,
`ExtensionSelectedPlayerEvent`, `ExtensionSelectedPluginEvent`,
`DevtoolsPluginInteractionEvent`, `DevtoolsPluginSelectedPlayerEvent`) are all
`BaseEvent` aliases that flow into `ExtensionSupportedEvents`.

### Transactions and messenger options

| Type | Purpose |
| --- | --- |
| `TransactionMetadata` | The envelope a messenger stamps onto every message: `id`, `timestamp`, `sender`, `context`, `_messenger_`. |
| `Transaction<T>` | `TransactionMetadata & MessengerEvent<T>` — a fully-stamped message. |
| `MessengerOptions<T>` | Configuration for a messenger instance: `sendMessage`, `addListener` / `removeListener`, `messageCallback`, `context`, `beaconIntervalMS`, `logger`, and friends. |
| `CommunicationLayerMethods` | `Pick<MessengerOptions<ExtensionSupportedEvents>, "sendMessage" \| "addListener" \| "removeListener">` — the minimal transport a client (or the [Flipper plugin](../flipper-plugin)) must supply. |
| `Connection` | Per-peer bookkeeping: messages sent/received and a `desync` flag. |

`context` is always `"player" | "devtools"` — it identifies which side of the
connection a message originated from.

### Plugin descriptors and store

| Type | Purpose |
| --- | --- |
| `PluginData` | What a devtools plugin advertises at registration: `id`, `name`, `version`, `description`, its Devtools UI `flow`, and optional `capabilities`. |
| `PluginCapabilities` | The agent-visible descriptor: a `description`, the `data` keys the plugin publishes, and the `actions` it accepts. This is what the MCP [`describe_plugin`](../mcp) tool surfaces. |
| `ExtensionState` | The browser-extension view of the world: `current` player/plugin selection plus a `players` map of registered plugins, `active`, and `config`. |
| `DevtoolsPluginsStore` | The client-side store shape: `plugins`, accumulated `messages`, `interactions`, and `currentPlayer`. |

> **NOTE**
> `PluginCapabilities` is the contract that makes plugins discoverable to agents.
> A plugin that declares its `data` keys and `actions` here can be driven by the
> [MCP server](../mcp) without anyone reading its source — keep it accurate.

## `ios` — `PlayerUIDevtoolsTypes`

The Swift mirror of `core`, built with the [`ios_library`](../../README.md) macro
(`PlayerUIDevtoolsTypes`). It depends on [`PlayerUIDevtoolsUtils`](../utils) for
the JS-bridging helpers. Three source files cover the same ground as the TS
package:

- **`BaseEvent`** — a generic `protocol` with an `associatedtype Payload`, a
  `type: String`, an optional `payload`, and an optional `target`. A protocol
  extension supplies a nil `payload` default so type-only events (just a `type`
  and `target`) need no payload boilerplate. This is the Swift analogue of
  `BaseEvent<T, P>`.
- **`InternalEvent`** — a concrete `BaseEvent` struct plus the
  **`InternalEventType`** string enum (`MESSENGER_BEACON`, `MESSENGER_DISCONNECT`,
  `MESSENGER_REQUEST_LOST_EVENTS`, `MESSENGER_EVENT_BATCH`,
  `PLAYER_DEVTOOLS_PLUGIN_INTERACTION`). The raw values match the TS event
  `type` strings exactly, so the two sides decode the same wire format.
- **`MessengerOptions`** — the Swift configuration object for a messenger. It
  carries `id`, `context` (`MessengerContext` = `.player` / `.devtools`),
  `logger`, `beaconIntervalMS`, `isDebug`, and the async `sendMessage` /
  synchronous `addListener` / `removeListener` / `messageCallback` closures, and
  exposes an `asJSValue` projection that hands those callbacks to the shared
  `JSContext` running the core JS messenger.

> **NOTE**
> The iOS package is type/contract parity for the Swift runtime — it does not
> re-implement messenger logic. The actual messaging runs in the JS core via the
> bridging in [`PlayerUIDevtoolsUtils`](../utils); `MessengerOptions.asJSValue`
> is the seam that adapts Swift closures into that JS context.

## Related

- [`../messenger`](../messenger) — the transport that carries these events.
- [`../plugins`](../plugins) — plugins that produce `PluginData` and emit the
  `PLAYER_DEVTOOLS_*` events.
- [`../client`](../client) / [`../flipper-plugin`](../flipper-plugin) — consumers
  that implement `CommunicationLayerMethods`.
- [`../mcp`](../mcp) — surfaces `PluginCapabilities` to agents.
- [`../README.md`](../../README.md) — the overall Devtools architecture.
