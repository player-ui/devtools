# Devtools Plugin Foundations

The **`plugin/` family** is the platform-agnostic foundation every Player
Devtools plugin is built on. These packages are **not** a complete Devtools
plugin themselves — they provide the base classes and platform wrappers that a
concrete plugin (like the [Basic Devtools Plugin](../plugins/basic)) extends to
instrument a running Player and talk to the Devtools clients.

A Devtools plugin works by running a **Player instance for the debugging
experience itself**: the plugin publishes the instrumented Player's content and
data updates to the clients, which render them using the
[devtools-assets](https://github.com/player-ui/devtools-assets). The clients are
the browser extension (web), the [Flipper](https://github.com/facebook/flipper)
plugin (mobile), and the [MCP server](../mcp). The base plugins here are
pre-wired to communicate with those clients through the
[`messenger`](../messenger).

If you're debugging core Player functionality, use the
[`BasicDevtoolsPlugin`](../plugins/basic) directly — it's also the best
**reference implementation** to read alongside this guide. If you need
capabilities specific to your integration, extend the base classes documented
here.

This directory contains **six** packages: the TypeScript `core` holds the
shared state-management and instrumentation contract, `react` wraps it for web,
and the `jvm`, `android`, `ios`, and `swiftui` packages adapt the same `core`
bundle to each native runtime.

**TypeScript (shared + web):**

| Package | Name | Role |
| --- | --- | --- |
| [`core`](#core--player-devtoolsplugin) | `@player-devtools/plugin` | Platform-agnostic base — `DevtoolsPlugin` class, the store/reducer, the interactions cursor, and the `DevtoolsHandler` contract. Compiles to a `DevtoolsPlugin.native.js` bundle the native wrappers load. |
| [`react`](#react--player-devtoolsplugin-react) | `@player-devtools/plugin-react` | Web wrapper — abstract `ReactDevtoolsPlugin` base that binds a core plugin to `ReactPlayer` and connects the messenger via both Flipper and `window.postMessage`. |

**Native platform wrappers** (each loads `core`'s `DevtoolsPlugin.native.js`
into the platform's Player JS runtime and adapts it to the platform's plugin
protocol):

| Package | Target | Role |
| --- | --- | --- |
| [`jvm`](#jvm--devtoolsplugin-kotlin) | `kt_jvm` (`plugin`) | `DevtoolsPlugin` (Kotlin) — `NodeWrapper` over the core JS plugin, loaded through `ModuleLoader`. |
| [`android`](#android--androiddevtoolsplugin) | `kt_android` (`plugin-android`) | abstract `AndroidDevtoolsPlugin<T>` — Android wrapper that owns the Flipper connection and messenger lifecycle. |
| [`ios`](#ios--basedevtoolsplugin-swift) | `swiftui_plugin` (`PlayerUIDevtoolsPlugin`) | `BaseDevtoolsPlugin` protocol — `JSBasePlugin` bridge into the core JS plugin. |
| [`swiftui`](#swiftui--devtoolsplugin-swift) | `swiftui_plugin` (`PlayerUIDevtoolsSwiftUIPlugin`) | `DevtoolsPlugin` protocol — `NativePlugin` that owns the Flipper connection + messenger lifecycle. |

## Installation

You don't usually install these directly — you install a concrete plugin (e.g.
[`@player-devtools/basic-plugin-react`](../plugins/basic)) that depends on them.
Install a `plugin/` package only when you're building your own Devtools plugin
and wrapping `core` yourself.

**Web / TypeScript** (npm):

```bash
npm install @player-devtools/plugin          # core base class
npm install @player-devtools/plugin-react     # React/web wrapper
```

**Android / JVM** (Maven — group `com.intuit.playerui.devtools`):

```kotlin
// JVM
implementation("com.intuit.playerui.devtools:plugin:<version>")
// Android
implementation("com.intuit.playerui.devtools:plugin-android:<version>")
```

**iOS / SwiftUI** (Swift Package Manager — products of the `PlayerUIDevtools`
package at https://github.com/player-ui/player):

```swift
.product(name: "PlayerUIDevtoolsPlugin", package: "PlayerUIDevtools")          // iOS base (plugin/ios)
.product(name: "PlayerUIDevtoolsSwiftUIPlugin", package: "PlayerUIDevtools")   // SwiftUI (plugin/swiftui)
```

> NOTE
> Published versions are stamped at release time (sources here read
> `0.0.0-PLACEHOLDER`); pin the current release version when you add the
> dependency.

## Architecture

The family follows the layered Devtools pattern: a platform-agnostic **core**
plugin owns all state and behavior, and a thin **platform** wrapper configures
the [messenger](../messenger) and injects the core plugin into the host Player.
Native wrappers don't reimplement instrumentation — they load the compiled
`core` bundle and bridge it.

```
host Player (web / Android / JVM / iOS)
   │  platform wrapper injects core plugin + wires the messenger
   ▼
DevtoolsPlugin (core)  ──messages──▶  Messenger  ──▶  client (extension / Flipper / MCP)
   ▲  store + reducer                                      │
   └──────── processInteraction  ◀──── interactions  ◀──────┘
```

State flows **out** as messages the store emits and the messenger forwards to
the client. Interactions flow **in** as `PLAYER_DEVTOOLS_PLUGIN_INTERACTION`
transactions that the store appends and `processInteraction` dispatches on.

## Building your own plugin

Implementing a core plugin means **extending `DevtoolsPlugin`** and supplying
`pluginData`, `apply`, and `processInteraction`. `pluginData` is the client
Player content that defines the actual debugging experience for your plugin.

- `apply(player)` is where you tap platform-agnostic Player / plugin APIs to
  gather state for the clients.
- `processInteraction(interaction)` is where you handle interactions coming back
  from the clients.

> NOTE
> Calling `super.apply(player)` is important — it emits the init events the
> clients need. But gate the expensive work behind `checkIfDevtoolsIsActive()`
> first to avoid doing work when Devtools is inactive. The same applies to any
> platform-specific `apply` override.

Even with no platform-specific capabilities to debug, you still need a
**platform-specific plugin** to configure the messenger. These extend
`{Platform}DevtoolsPlugin` (e.g. `ReactDevtoolsPlugin`, `AndroidDevtoolsPlugin`)
and provide the core plugin to use — either your own `DevtoolsPlugin` subclass
or the base `DevtoolsPlugin` configured with `pluginData`.

---

## `core` — `@player-devtools/plugin`

The platform-agnostic base. Exports the `DevtoolsPlugin` class plus the
`DevtoolsHandler` and `DevtoolsPluginOptions` types. It compiles to a
`DevtoolsPlugin.native.js` bundle (via `js_pipeline`'s `native_bundle`) that the
native wrappers load into their Player JS runtime.

```ts
import { DevtoolsPlugin, type DevtoolsHandler } from "@player-devtools/plugin";
```

### `DevtoolsPlugin`

`DevtoolsPlugin implements PlayerPlugin, DevtoolsHandler`. It is constructed with
`DevtoolsPluginOptions`:

```ts
type DevtoolsPluginOptions = {
  playerID: string;
  pluginData: PluginData; // the client Player content + capability descriptor
  handler: DevtoolsHandler;
};
```

`pluginID` and `playerID` are exposed as getters (`pluginID` reads
`pluginData.id`).

| Member | Responsibility |
| --- | --- |
| `apply(player)` | Bails when Devtools is inactive, otherwise calls `dispatchPlayerInit()` to publish the plugin's content. Subclasses override to add taps. |
| `processInteraction(interaction)` | Forwards the interaction to the `handler`, then dispatches a `SELECTED_PLAYER_CHANGE` when the interaction is `player-selected`. Subclasses override to handle their own interaction types. |
| `registerMessenger(messenger)` | Subscribes to the store and forwards each newly-added message to the messenger; returns an `Unsubscribe`. |
| `checkIfDevtoolsIsActive()` | Delegates to the handler; logs the inactive warning once if Devtools is off. |
| `store` | The reducer-backed store (`useStateReducer(reducer, INITIAL_STATE)`) holding `messages`, `plugins`, `interactions`, and `currentPlayer`. |

### The store, reducer, and interactions cursor

The store is a reducer (`reducer.ts`) over `Transaction<ExtensionSupportedEvents>`
covering `PLAYER_INIT`, `PLUGIN_DATA_CHANGE`, `PLUGIN_INTERACTION`, and
`SELECTED_PLAYER_CHANGE`. Updates are applied immutably with
[`immer`](https://immerjs.github.io) and `dsetAssign` from
[`@player-devtools/utils`](../utils/core), so untouched branches keep reference
identity.

The constructor subscribes to the store and watches `interactions`. It tracks a
`lastProcessedInteraction` **cursor** and only processes interactions appended
since the last pass.

> NOTE
> The cursor is advanced **before** the new interactions are processed.
> `processInteraction` can dispatch synchronously (e.g. `SELECTED_PLAYER_CHANGE`),
> which re-enters the same subscriber — advancing first makes that re-entrant
> pass a no-op instead of reprocessing the same interactions.

State publishes outward via `dispatchDataUpdate(data?)`, which deep-merges into
`plugins[pluginID].flow.data` and dispatches a data-change transaction only when
the data actually changed (guarded by `dequal`).

### `DevtoolsHandler`

The contract the platform layer supplies so `core` can defer
platform-specific concerns:

```ts
type DevtoolsHandler = {
  processInteraction(interaction: DevtoolsPluginInteractionEvent): void;
  checkIfDevtoolsIsActive(): boolean;
  log?(message: string): void;
};
```

---

## `react` — `@player-devtools/plugin-react`

The web wrapper. Exports the abstract `ReactDevtoolsPlugin` base class (plus
re-exports `genDataChangeTransaction` and `DevtoolsPluginOptions` from `core`).

```ts
import { ReactDevtoolsPlugin } from "@player-devtools/plugin-react";
```

### `ReactDevtoolsPlugin<T extends DevtoolsPlugin>`

`ReactDevtoolsPlugin implements ReactPlayerPlugin, DevtoolsHandler`. It's
**abstract**: a concrete subclass supplies the `corePlugin` (a `DevtoolsPlugin`),
and the base derives `playerID` and `store` from it.

- `checkIfDevtoolsIsActive()` reads `localStorage.getItem("player-ui-devtools-active") === "true"`, set by the browser extension popup.
- `applyReact(reactPlayer)` bails when Devtools is inactive, then taps
  `reactPlayer.hooks.webComponent` to wrap the rendered component. The wrapper
  builds a [`Messenger`](../messenger) (context `"player"`, dispatching incoming
  messages into the core store) and calls `corePlugin.registerMessenger`,
  destroying the messenger on unmount.
- `processInteraction` is a no-op at this layer by default — the core plugin
  owns interaction handling.

### `useCommunicationLayer`

The hook that supplies the messenger's transport. It connects over **both**
channels at once, fanning each `sendMessage` / `addListener` / `removeListener`
out to every registered callback:

| Channel | When | How |
| --- | --- | --- |
| **Flipper** | `localStorage` `player-ui-devtools-flipper-active === "true"` | Starts a `js-flipper` client under id `player-ui-devtools`, sends on `message::plugin`, receives on `message::flipper`. |
| **`window.postMessage`** | always | Posts messages to `window` and listens for `message` events — this is how the browser extension content script communicates. |

> NOTE
> Flipper is opt-in via the extension popup; if disabled it logs a warning and
> only the `window.postMessage` channel is active. Web devtools work without
> Flipper.

---

## `jvm` — `DevtoolsPlugin` (Kotlin)

`com.intuit.playerui.devtools.DevtoolsPlugin` is a `NodeWrapper` over the core
JS plugin — it does **not** reimplement the logic, it bridges to it. It
implements `DevtoolsHandler` and `PlayerPlugin`, exposing `pluginID`, `playerID`,
`store`, `checkIfDevtoolsIsActive()`, `processInteraction(...)`,
`registerMessenger(...)`, and `apply(player)` as invokables on the underlying JS
`Node`.

Construction goes through a `Runtime` extension that loads the bundled core
module via `ModuleLoader` (from `devtools/plugin/core/dist/DevtoolsPlugin.native.js`)
and instantiates the JS plugin with `Options(playerID, pluginData, handler)`:

```kotlin
val plugin = runtime.DevtoolsPlugin(
    DevtoolsPlugin.Options(playerID = "my-player", pluginData = data, handler = myHandler),
)
```

The package also exports the `DevtoolsHandler` interface (with a `KSerializer`
that bridges the handler callbacks across the JS boundary), the `PluginStore`
wrapper, and `ModuleLoader`. The JVM messenger comes from
[`messenger/jvm`](../messenger).

---

## `android` — `AndroidDevtoolsPlugin`

`com.intuit.playerui.devtools.AndroidDevtoolsPlugin<T : DevtoolsPlugin>` is the
abstract Android wrapper. It implements `DevtoolsHandler`, `AndroidPlayerPlugin`,
and `RuntimePlugin`. A concrete subclass overrides
`Runtime<*>.buildCorePlugin(): T` to construct its core plugin (typically via the
`jvm` package's `Runtime.DevtoolsPlugin(...)`).

- `checkIfDevtoolsIsActive()` returns true only when a `PlayerDevtoolsFlipperPlugin`
  is registered on the active `AndroidFlipperClient`.
- `apply(androidPlayer)` bails when inactive, builds a [`Messenger`](../messenger)
  bound to the Flipper plugin's `sendMessage` / `addListener` / `removeListener`,
  registers it on the core plugin, then applies the core plugin to the Player.
  It taps `androidPlayer.hooks.state` to deregister the listener when the Player
  reaches `ReleasedState`.

`PlayerDevtoolsFlipperPlugin` is the `FlipperPlugin` (id `player-ui-devtools`)
that owns the `FlipperConnection`, fans `message::flipper` messages out to
listeners, and sends on `message::plugin` — mirroring the web Flipper layer.

```kotlin
// concrete subclasses (e.g. BasicAndroidDevtoolsPlugin) plug into AndroidPlayer
AndroidPlayer(MyAndroidDevtoolsPlugin(id = "my-player"), /* ... */)
```

---

## `ios` — `BaseDevtoolsPlugin` (Swift)

`BaseDevtoolsPlugin` is a protocol refining `JSBasePlugin` — the bridge into the
core JS plugin. A default `extension` implements `pluginID`, `playerID`, `store`,
`isActive`, and `registerMessenger(messenger:)` by reading properties and
invoking methods on the underlying `pluginRef` JS value (e.g.
`checkIfDevtoolsIsActive`, `registerMessenger`).

Supporting types:

- **`DevtoolsPluginOptions`** — packages `playerID`, `handler`, and optional
  `pluginData` into the `jsCompatible` dictionary passed into the core plugin.
- **`PluginData`** — the descriptor (`id`, `version`, `name`, `description`,
  `flow`) handed to the core JS plugin.
- **`PluginStore`** — wraps the JS store value, exposing `dispatch(event:)`.
- **`DevtoolsHandler`** ([`DevtoolsHandler.swift`](ios/Sources/DevtoolsHandler.swift)) —
  the `isActive` / `processInteraction(interaction:)` contract, with a
  `jsCompatible(context:)` extension that exports the callbacks into JS.

This layer points the runtime at the bundled `DevtoolsPlugin.native.js` and
bridges the contract — it does **not** own a Flipper connection or messenger
lifecycle. That's the SwiftUI layer's job. The protocol is built to be adopted
by a concrete SwiftUI plugin.

---

## `swiftui` — `DevtoolsPlugin` (Swift)

`DevtoolsPlugin` is the protocol you adopt for a **SwiftUI** Player. It refines
`BaseDevtoolsPlugin` and `NativePlugin`, adding the runtime wiring the base
layer can't own:

- `flipperPlugin: DevtoolsFlipperPlugin` — the Flipper connection
  ([`DevtoolsFlipperPlugin.swift`](ios/Sources/DevtoolsFlipperPlugin.swift), id
  `player-ui-devtools`), which sends on `message::plugin` and dispatches
  `message::flipper` messages to registered listeners (keyed by `UUID`).
- `messenger: Messenger?` — a reference the conformer holds so the messenger
  stays alive.
- `listeners: [UUID]` — the listener ids registered with the Flipper plugin.

A default `extension` implements `apply(player:)`: it resolves the JS context,
builds a [`Messenger`](../messenger) bound to the Flipper plugin's send/listen
callbacks (dispatching incoming messages into the core `store`), and registers
it on the core plugin.

> NOTE
> The `apply` extension only runs when the conformer is a `NativePlugin`. A
> concrete SwiftUI plugin supplies the stored `flipperPlugin` / `messenger` /
> `listeners` properties the protocol declares.

## Enabling devtools

Add the platform-specific Devtools plugin (a concrete subclass of the base
classes here, e.g. [`BasicReactDevtoolsPlugin`](../plugins/basic)) to your
Player configuration, then activate a client connection — the browser extension
popup for web, or the `FlipperClient` for mobile. See
[`plugins/basic`](../plugins/basic) for a full reference implementation, the
[`messenger`](../messenger) and [`types`](../types) packages for the transport
and event contracts, and [the devtools root README](../../README.md) for the
overall architecture.
