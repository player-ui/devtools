# Basic Devtools Plugin

The **Basic Devtools Plugin** is the standard, batteries-included Player Devtools
plugin. It instruments a running Player instance to expose its core runtime
state — flow, data model, logs, and configuration — to the Devtools clients
(the [browser extension], the [Flipper plugin](../../flipper-plugin), and the
[MCP server](../../mcp)), and it accepts a small set of interactions back from
those clients (evaluate an expression, override the running flow).

It is also the **reference implementation** for building your own plugin. If you
need to debug capabilities specific to your integration, this is the best
plugin to read alongside the [plugin authoring guide](../../plugin).

This directory contains **seven** packages that compose into the full plugin
across every platform Player runs on. The TypeScript `core` holds all the
instrumentation logic; the `content` package defines the Devtools UI and
capability descriptor; and each platform — web, Android, JVM, iOS, SwiftUI —
has a thin wrapper that loads `core` into its runtime and configures the
messenger.

**TypeScript (shared + web):**

| Package | Name | Role |
| --- | --- | --- |
| [`core`](#core--player-devtoolsbasic-plugin) | `@player-devtools/basic-plugin` | Platform-agnostic instrumentation — taps Player hooks, handles interactions. The other platforms load this bundle. |
| [`content`](#content--player-devtoolsbasic-plugin-content) | `@player-devtools/basic-plugin-content` | The Devtools UI flow (DSL content) plus the plugin's `id`, capability descriptor, and interaction constants. |
| [`react`](#react--player-devtoolsbasic-plugin-react) | `@player-devtools/basic-plugin-react` | React/web wrapper — binds the core plugin to `ReactPlayer` and renders a per-Player wrapper component. |

**Native platform wrappers** (each bundles `core`'s `BasicDevtoolsPlugin.native.js`
and wraps it, mirroring how `react` wraps `core`):

| Package | Target | Role |
| --- | --- | --- |
| [`jvm`](#native-platform-wrappers) | `kt_jvm` | `BasicDevtoolsPlugin` (Kotlin) — loads the core bundle into the Player JS runtime via `ModuleLoader`. |
| [`android`](#native-platform-wrappers) | `kt_android` | `BasicAndroidDevtoolsPlugin` — Android wrapper over `jvm`, adds the debug overlay styling. |
| [`ios`](#native-platform-wrappers) | `ios_library` | `BaseBasicDevtoolsPlugin` (Swift) — `JSBasePlugin` that loads the core bundle. |
| [`swiftui`](#native-platform-wrappers) | `swiftui_plugin` | `BasicDevtoolsPlugin` (SwiftUI) — wraps the iOS base plugin and owns the Flipper connection + messenger lifecycle. |

## Installation

Install the package for the platform you're integrating. The web/TS packages
ship to npm; the Kotlin packages to Maven; the Swift packages via SPM as products
of the `PlayerUIDevtools` Swift package.

**Web / TypeScript** (npm):

```bash
npm install @player-devtools/basic-plugin-react
# bring in @player-devtools/basic-plugin / -content directly only if you wrap core yourself
```

**Android / JVM** (Maven — group `com.intuit.playerui.devtools.plugins`):

```kotlin
// Android
implementation("com.intuit.playerui.devtools.plugins:basic-android:<version>")
// JVM
implementation("com.intuit.playerui.devtools.plugins:basic:<version>")
```

**iOS / SwiftUI** (Swift Package Manager — products of the `PlayerUIDevtools`
package at https://github.com/player-ui/player):

```swift
.product(name: "PlayerUIDevtoolsBasicPlugin", package: "PlayerUIDevtools")          // SwiftUI
.product(name: "PlayerUIDevtoolsBaseBasicDevtoolsPlugin", package: "PlayerUIDevtools") // iOS base
```

> Published versions are stamped at release time (sources here read
> `0.0.0-PLACEHOLDER`); pin the current release version when you add the
> dependency.

## Architecture

The Basic plugin follows the layered Devtools plugin pattern: a platform-agnostic
**core** plugin owns all state and behavior, the **content** package defines what
the Devtools UI looks like and what the plugin advertises, and a thin
**platform** wrapper (here, `react`) configures the messenger and injects the
core plugin into the host Player.

```
Player runtime
   │  (hook taps: dataController, logger, onStart, view, expressionEvaluator)
   ▼
BasicDevtoolsPlugin (core)  ──dispatchDataUpdate──▶  messenger  ──▶  Devtools client / MCP
   ▲                                                                      │
   └──────────────── processInteraction  ◀──── PLUGIN_INTERACTION ◀───────┘
```

State flows **out** as `dispatchDataUpdate` calls keyed by data key (`flow`,
`data`, `logs`, `playerConfig`, `history`). Interactions flow **in** as
`PLAYER_DEVTOOLS_PLUGIN_INTERACTION` events that `processInteraction` dispatches
on by type.

---

## `core` — `@player-devtools/basic-plugin`

`BasicDevtoolsPlugin` extends the base [`DevtoolsPlugin`](../../plugin) and is
constructed with everything except `pluginData` — it supplies
[`BasicPluginData`](#content--player-devtoolsbasic-plugin-content) for you.

```ts
import { BasicDevtoolsPlugin } from "@player-devtools/basic-plugin";

const plugin = new BasicDevtoolsPlugin({ playerID, handler });
```

### What it taps

`apply(player)` registers the plugin's logger first (so logs are captured even
before Devtools is confirmed active), bails early if Devtools is inactive, then
taps:

| Hook | Captured as | Published to data key |
| --- | --- | --- |
| `player.hooks.dataController` → `onUpdate` | `data` | `data` |
| `player.logger.hooks.log` | `logs` | `logs` |
| `player.hooks.onStart` | `flow` | `flow` |
| `player.hooks.view` | `view` | — |
| `player.hooks.expressionEvaluator` | `expressionEvaluator` | — |
| `player.getVersion()` / `getPlugins()` | `playerConfig` | `playerConfig` |

Data-model updates are applied immutably with [`immer`](https://immerjs.github.io)
and [`dsetAssign`](../../utils/core), which deep-assigns into the draft while
preserving reference identity for untouched branches.

> **NOTE**
> `apply` calls `super.apply(player)` to emit the init events the clients need.
> When overriding `apply`, gate the expensive work behind `checkIfDevtoolsIsActive()`.

### Interactions it handles

`processInteraction` first calls `super.processInteraction` (so the base class
can run platform-specific handling), then dispatches on the interaction type:

- **`evaluate-expression`** (`INTERACTIONS.EVALUATE_EXPRESSION`) — evaluates the
  payload string against the captured expression evaluator and appends an
  `Evaluation` (`{ id, expression, result, severity? }`) to the `history` data
  key. Evaluator errors are caught and returned as `severity: "error"` results
  rather than thrown.
- **`override-flow`** (`INTERACTIONS.OVERRIDE_FLOW`) — parses the payload as flow
  JSON and restarts the Player with it via the captured `player.start`. Parse
  failures are logged and ignored.

---

## `content` — `@player-devtools/basic-plugin-content`

Defines the data the plugin advertises and the UI the Devtools clients render.
It has no runtime Player dependency — only `@player-devtools/types`.

```ts
import {
  BasicPluginData,
  PLUGIN_ID,
  INTERACTIONS,
} from "@player-devtools/basic-plugin-content";
```

- **`BasicPluginData`** — the `PluginData` descriptor: `id`, `name`, `version`,
  the compiled Devtools UI `flow`, and a `capabilities` block. The `capabilities`
  descriptor is what [`describe_plugin`](../../mcp) returns — it documents each
  published `data` key and each accepted `action` so agents can discover the
  plugin's surface without reading source.
- **`PLUGIN_ID`** — `"player-ui-basic-devtools-plugin"`. The id every Basic plugin
  registers under.
- **`INTERACTIONS`** — the interaction-type string constants
  (`EVALUATE_EXPRESSION`, `OVERRIDE_FLOW`) shared between the content descriptor
  and the core plugin's `processInteraction`.
- **`VIEWS_IDS`** — view ids used by the Devtools UI flow (`Config`, `Flow`,
  `Logs`, `Console`, `Editor`).

### Versioning

The `version` field is stamped from the `__VERSION__` global injected at build
time (`dsl_compile`), falling back to `"unstamped"` in unbuilt/dev contexts. The
`flow` itself is generated from the DSL source into `_generated/flow.json`, so it
conforms to the [devtools-assets](https://github.com/player-ui/devtools-assets)
asset APIs the clients render.

---

## `react` — `@player-devtools/basic-plugin-react`

`BasicReactDevtoolsPlugin` is the plugin you add to a **web** Player. It extends
[`ReactDevtoolsPlugin`](../../plugin/react), constructs a `BasicDevtoolsPlugin`
as its core plugin, and registers a wrapper component around the rendered Player.

```tsx
import { BasicReactDevtoolsPlugin } from "@player-devtools/basic-plugin-react";

const reactPlayer = new ReactPlayer({
  plugins: [new BasicReactDevtoolsPlugin()],
});
```

### Constructor

```ts
new BasicReactDevtoolsPlugin(
  id?: string,                                    // playerID; defaults to "default-id"
  wrapper?: React.ComponentType<DevtoolsWrapperProps>, // custom per-Player wrapper
);
```

- **`id`** — the `playerID` this plugin instance reports. Give each Player a
  distinct id when running more than one on a page so the clients (and the MCP
  `select_player` / `invoke_action` tools) can address them individually.
- **`wrapper`** — overrides the default wrapper component. The default
  (`BasicDevtoolsWrapper`) wraps the Player in a `<div id={playerID}>` and briefly
  highlights it with a blue border when it becomes the selected Player.

`DevtoolsWrapperProps` is `{ state: DevtoolsPluginsStore; playerID: string }`
plus `children`.

### How it wires up

`applyReact(reactPlayer)` bails when Devtools is inactive, calls
`super.applyReact` (which the base class uses to set up the messenger via
`useCommunicationLayer`), then taps `reactPlayer.hooks.webComponent` to wrap the
rendered component with a `DevtoolsContainer` that subscribes to the plugin store
and feeds the current state into the wrapper.

> **NOTE**
> Whether Devtools is active is read from `localStorage`
> (`player-ui-devtools-active === "true"`), set by the browser extension popup.
> See [`@player-devtools/plugin-react`](../../plugin/react) for the base class
> details.

## Native platform wrappers

The Android, JVM, iOS, and SwiftUI packages are thin wrappers. They don't
reimplement instrumentation — they load the compiled `core` bundle
(`BasicDevtoolsPlugin.native.js`) into the platform's Player JS runtime and
adapt it to the platform's plugin protocol, exactly as `react` adapts `core` for
the web. Each is built with the corresponding [`rules_player`](../../../README.md)
macro (`kt_jvm`, `kt_android`, `ios_library`, `swiftui_plugin`).

### JVM — `BasicDevtoolsPlugin` (Kotlin)

`com.intuit.playerui.devtools.plugins.basic.BasicDevtoolsPlugin` extends the base
`DevtoolsPlugin` and is constructed through a `Runtime` extension that loads the
bundled core module via `ModuleLoader` and instantiates the JS plugin with
`Options(playerID, handler)`.

```kotlin
val plugin = runtime.BasicDevtoolsPlugin(
    BasicDevtoolsPlugin.Options(playerID = "my-player", handler = myHandler),
)
```

### Android — `BasicAndroidDevtoolsPlugin`

Extends `AndroidDevtoolsPlugin<BasicDevtoolsPlugin>`, building its core plugin
from the JVM package. Beyond the core behavior it taps `androidPlayer.hooks.context`
to apply a debug overlay style (`overlayStyle`, defaulting to
`R.style.BasicAndroidDevtoolsPlugin`). Like every wrapper it bails early when
`checkIfDevtoolsIsActive()` is false before calling `super.apply`.

```kotlin
AndroidPlayer(BasicAndroidDevtoolsPlugin(id = "my-player"), /* ... */)
```

### iOS — `BaseBasicDevtoolsPlugin` (Swift)

A `JSBasePlugin` conforming to `BaseDevtoolsPlugin`. It points the JS runtime at
the bundled `BasicDevtoolsPlugin.native.js`, polyfills the context, and passes
`DevtoolsPluginOptions(playerID:handler:)` into the core plugin. It supplies a
default no-op `Handler` — the core JS plugin provides the actual logging and
metadata. It does **not** own a Flipper connection; that's the SwiftUI layer's
job. It's `open` so the SwiftUI plugin can subclass it.

### SwiftUI — `BasicDevtoolsPlugin`

Subclasses `BaseBasicDevtoolsPlugin` and conforms to `DevtoolsPlugin`. This is the
plugin you add to a SwiftUI Player. It owns the runtime wiring the base class
can't:

- holds the `DevtoolsFlipperPlugin` connection,
- keeps a strong reference to the `Messenger` so it isn't garbage-collected,
- tracks registered listener `UUID`s, and
- implements `deinit` to destroy the messenger and deregister listeners.

```swift
let plugin = BasicDevtoolsPlugin(id: "my-player", flipperPlugin: devtoolsFlipperPlugin)
```

> **NOTE**
> If you write your own SwiftUI `DevtoolsPlugin`, you must implement `deinit`
> exactly like this one — the `DevtoolsPlugin` protocol can't provide it.

## Enabling devtools

Add `BasicReactDevtoolsPlugin` to your `ReactPlayer` configuration and activate a
client connection — the browser extension popup for web, or the `FlipperClient`
for mobile. See the [plugin authoring guide](../../plugin) for the platform
wiring and [the devtools root README](../../../README.md) for the overall
architecture.

[browser extension]: https://github.com/player-ui/browser-devtools
