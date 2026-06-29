# Devtools Messenger

The **Devtools Messenger** is the transport that connects a Player runtime to a
Devtools client. It is a communication-layer-agnostic, self-sufficient, and
lossless messenger: you give it primitives for sending and receiving on whatever
channel you have (`window.postMessage`, `browser.runtime`, a JS bridge), and it
handles peer discovery, ordering, and recovery on top of that channel.

It is "self-sufficient" because there is **no central bookkeeper** — every
instance announces itself, tracks its own peers, and recovers its own lost
messages. This is what lets the same protocol work unchanged across a browser
extension, a Flipper desktop connection, and a native JS bridge.

This directory contains **three** packages — one per platform Player runs on.
The TypeScript `core` is the real implementation; the native packages each
load that compiled bundle into their platform's JS runtime and expose a native
API over it.

| Package | Name / Target | Role |
| --- | --- | --- |
| [`core`](#core--player-devtoolsmessenger) | `@player-devtools/messenger` | The full implementation — the `Messenger` class, beacon handshake, sequencing, and recovery. The native packages load its compiled bundle. |
| [`jvm`](#native-packages) | `messenger` (`kt_jvm`) | Kotlin wrapper — loads the core bundle via the Player JS runtime and exposes a `Messenger` over serializable `Event`s. |
| [`ios`](#native-packages) | `Messenger` (`ios_library`) | Swift wrapper — constructs the JS `Messenger` in a shared `JSContext` and exposes an `async`/`await` API. |

The event type shapes and the `MessengerOptions` contract live in
[`@player-devtools/types`](../types). The Devtools plugins that use this
transport are in [`../plugin`](../plugin); the agent-facing server that consumes
its events is [`../mcp`](../mcp). For the overall Devtools architecture, see the
[root README](../../README.md).

## Installation

Install the package for the platform you are integrating. `<version>` is a
placeholder — published versions are stamped at release time (sources here read
`0.0.0-PLACEHOLDER`); pin the current release when you add the dependency.

**Web / TypeScript** (npm):

```bash
npm install @player-devtools/messenger
```

**Android / JVM** (Maven — group `com.intuit.playerui.devtools`, artifact
`messenger`):

```kotlin
implementation("com.intuit.playerui.devtools:messenger:<version>")
```

**iOS** (Swift Package Manager — a product of the `PlayerUIDevtools` package at
https://github.com/player-ui/player):

```swift
.product(name: "PlayerUIDevtoolsMessenger", package: "PlayerUIDevtools")
```

## How it works

Two `Messenger` instances find and synchronize with each other without any
shared coordinator. Each instance sends a periodic **beacon** to announce its
presence. When an instance hears a beacon from a new peer, it records the
connection and immediately replays every event it has buffered so far — so a
peer that connects late still receives the full history.

```
  Player runtime                                   Devtools client
 ┌───────────────┐                                ┌───────────────┐
 │   Messenger    │ ──── MESSENGER_BEACON ───────▶ │   Messenger    │
 │ context:       │ ◀──── MESSENGER_BEACON ─────── │ context:       │
 │  "player"      │                                │  "devtools"    │
 │                │ ──── MESSENGER_EVENT_BATCH ───▶ │                │  (replay history
 │                │                                │                │   on new connection)
 │                │ ──── sequenced events ───────▶ │                │
 │                │ ◀── MESSENGER_REQUEST_LOST ─── │                │  (gap detected)
 │                │ ──── MESSENGER_EVENT_BATCH ───▶ │                │  (missing events)
 └───────────────┘                                └───────────────┘
```

The two instances must be in **different contexts** (`"player"` vs.
`"devtools"`); a messenger ignores traffic from its own context and from
itself, so a player never talks to another player over the same channel.

### Ordering and recovery

Each targeted (non-internal) message carries a **sequential transaction id** per
connection. The receiver uses those ids to stay lossless:

- **Duplicate detection** — a message whose id has already been seen is dropped.
- **Lost-event recovery** — if an arriving id skips ahead of what the receiver
  expects, it sends a `MESSENGER_REQUEST_LOST_EVENTS` (carrying its
  `messagesReceived` count) and waits; the sender replies with a batch of the
  missing events. A `desync` flag prevents requesting the same gap twice.
- **Broadcasts** — beacons and other untargeted internal events are stamped with
  id `-1`. They are delivered to everyone but are not sequenced, so they do not
  advance the receiver's `messagesReceived` counter — otherwise the next
  targeted message would look like a duplicate and be dropped.

On teardown, `destroy()` sends a `MESSENGER_DISCONNECT` to each known peer so
they can drop the connection promptly rather than waiting for a timeout.

> **NOTE**
> Connection bookkeeping (events and connections) is **static**, shared across
> all `Messenger` instances in the same JS context. `Messenger.reset()` clears
> it for every instance — useful in tests, but never call it while a live
> connection is in flight.

## `core` — `@player-devtools/messenger`

The TypeScript implementation. `Messenger<T>` is generic over your event union
`T` (a union of `BaseEvent<Type, Payload>` shapes), so the events you send and
receive stay fully typed.

```ts
import { Messenger } from "@player-devtools/messenger";

const messenger = new Messenger({
  context: "devtools",
  messageCallback: (message) => dispatch(message),
  sendMessage: (message) => browser.runtime.sendMessage(message),
  addListener: (callback) => browser.runtime.onMessage.addListener(callback),
  removeListener: (callback) =>
    browser.runtime.onMessage.removeListener(callback),
  logger: console,
});
```

### Constructor options

`new Messenger<T>(options: MessengerOptions<T>)`. The full
[`MessengerOptions`](../types) contract:

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `context` | `"player" \| "devtools"` | yes | Which side this instance is on. It ignores traffic from its own context. |
| `sendMessage` | `(message) => Promise<void>` | yes | Sends a message over your channel (e.g. `window.postMessage`, `browser.runtime.sendMessage`). |
| `addListener` | `(callback) => void` | yes | Subscribes the messenger's handler to incoming messages on your channel. |
| `removeListener` | `(callback) => void` | yes | Unsubscribes that handler; used by `destroy()`. |
| `messageCallback` | `(message) => void` | yes | Invoked with each delivered (deduped, in-order) message. |
| `logger` | `{ log: (...args) => void }` | yes | Sink for debug logging. Only used when `debug` is on. |
| `id` | `string` | no | This instance's unique id. Generated with `tiny-uid` if omitted. |
| `beaconIntervalMS` | `number` | no | Milliseconds between beacons. Defaults to `1000`. |
| `debug` | `boolean` | no | When `true`, emits debug messages through `logger`. Defaults to `false`. |
| `handleFailedMessage` | `(message) => void` | no | Called with the full transaction when `sendMessage` rejects. |

> **NOTE**
> There is **no `target` constructor option**. Targeting is per-message: set
> `target` on an individual event to address a specific peer; omit it to
> broadcast.

### Methods

| Method | Description |
| --- | --- |
| `sendMessage(message: T \| string): Promise<void>` | Buffers the event (so late peers can be replayed), stamps it with transaction metadata, and sends it. A JSON string is parsed first; a parse failure rejects. A send failure routes the transaction to `handleFailedMessage`. |
| `destroy(): void` | Stops the beacon interval, removes the listener, sends a `MESSENGER_DISCONNECT` to each known peer, and resets the shared static state. |
| `static reset(): void` | Clears the shared static events/connections record for all instances in the context. |

## Native packages

The `jvm` and `ios` packages do **not** reimplement the protocol. Each loads the
compiled core bundle (`Messenger.native.js`) into the platform's Player JS
runtime and exposes a native API that forwards to the JS instance — so ordering,
recovery, and the handshake behave identically to `core`. They sit at coverage
parity with `core` but intentionally thinner.

### JVM — `com.intuit.playerui.devtools.Messenger`

A `JSScriptPluginWrapper` (Kotlin) that loads the bundled core module into a
`Runtime`, installs `SetTimeoutPlugin` (and polyfills `setInterval`) so the
beacon timer works, then constructs the JS `Messenger` with a serialized
`Options`. Messages are modeled as serializable `Event` subclasses (see
`Event.kt`).

```kotlin
val messenger = Messenger(
    Messenger.Options(
        context = TransactionMetaData.Context.DEVTOOLS,
        sendMessage = { event -> /* send over your channel */ },
        addListener = { callback -> /* subscribe */ },
        removeListener = { callback -> /* unsubscribe */ },
        messageCallback = { event -> /* handle */ },
        logger = Messenger.Logger { args -> println(args.joinToString(" ")) },
    ),
)
```

- `Options` mirrors the TS contract: `context`, `sendMessage`, `addListener`,
  `removeListener`, `messageCallback`, optional `handleFailedMessage`, `id`,
  `beaconIntervalMS`, `debug`, and a `logger` (`Logger` functional interface).
- The wrapper hijacks `addListener`/`removeListener` so it can register and
  remove handlers with stable JVM references (JS cannot compare function
  identity across the bridge).
- API: `sendMessage(Event)`, `sendMessage(JsonElement)`, `destroy()`, `reset()`.

### iOS — `Messenger` (Swift)

A Swift class that constructs the JS `Messenger` in a shared `JSContext` (pulled
from its [`MessengerOptions`](../types), so options and messenger share a
context) and exposes an `async`/`await` API by bridging the JS `Promise`
returned from `sendMessage`.

```swift
let messenger = try Messenger(options: messengerOptions)
try await messenger.sendMessage(message)   // Message or JSON String
messenger.destroy()
```

- `MessengerOptions` (in [`../types`](../types)) requires `id`, `jsContext`,
  `context` (`.player` / `.devtools`), `logger` (a `MessengerLogger`),
  `sendMessage`, `addListener`, `removeListener`, and `messageCallback`, with
  optional `beaconIntervalMS`, `isDebug`, and `handleFailedMessage`.
- `SharedMessengerLayer.reset(context:logger:)` bridges to the static JS
  `Messenger.reset()`, since generic Swift types cannot hold static functions.

> **NOTE**
> All Swift `MessengerOptions` share the same `JSContext`, mirroring the static,
> per-context bookkeeping in `core`.
