# Profiler Devtools Plugin

The **Profiler Devtools Plugin** instruments a running Player and records how long
its hooks take, surfacing the result to the Devtools clients (the
[browser extension], the [Flipper plugin](../../flipper-plugin), and the
[MCP server](../../mcp)) as a **flame graph**. It's the profiling counterpart to
the [Basic Devtools Plugin](../basic): where `basic` exposes flow / data / logs,
this one answers "where is time being spent?"

It accepts three interactions from the clients — **start**, **stop**, and
**reset** profiling — and publishes the captured hook timings as a tree.

This directory contains **seven** packages, the same layered shape as
[`basic`](../basic): a TypeScript `core` holds the profiling logic, `content`
defines the Devtools UI, and each platform — web, Android, JVM, iOS, SwiftUI —
has a thin wrapper that loads `core` into its runtime and configures the
messenger.

**TypeScript (shared + web):**

| Package | Name | Role |
| --- | --- | --- |
| [`core`](#core--player-devtoolsprofiler-plugin) | `@player-devtools/profiler-plugin` | The profiling instrumentation — intercepts Player hooks, builds the flame-graph tree, handles start/stop/reset. The other platforms load this bundle. |
| [`content`](#content--player-devtoolsprofiler-plugin-content) | `@player-devtools/profiler-plugin-content` | The Devtools UI flow (DSL content) plus the plugin's `id` and interaction constants. |
| [`react`](#react--player-devtoolsprofiler-plugin-react) | `@player-devtools/profiler-plugin-react` | React/web wrapper — binds the core plugin to `ReactPlayer`. |

**Native platform wrappers** (each bundles `core`'s
`ProfilerDevtoolsPlugin.native.js` and wraps it, mirroring how `react` wraps
`core`):

| Package | Target | Role |
| --- | --- | --- |
| [`jvm`](#native-platform-wrappers) | `kt_jvm` | `ProfilerDevtoolsPlugin` (Kotlin) — loads the core bundle into the Player JS runtime via `ModuleLoader`. |
| [`android`](#native-platform-wrappers) | `kt_android` | `ProfilerAndroidDevtoolsPlugin` — Android wrapper over `jvm`, adds the debug overlay styling. |
| [`ios`](#native-platform-wrappers) | `ios_library` | `BaseProfilerDevtoolsPlugin` (Swift) — `JSBasePlugin` that loads the core bundle. |
| [`swiftui`](#native-platform-wrappers) | `swiftui_plugin` | `ProfilerDevtoolsPlugin` (SwiftUI) — wraps the iOS base plugin and owns the Flipper connection + messenger lifecycle. |

## Installation

Install the package for the platform you're integrating. The web/TS packages
ship to npm; the Kotlin packages to Maven; the Swift packages via SPM as products
of the `PlayerUIDevtools` Swift package.

**Web / TypeScript** (npm):

```bash
npm install @player-devtools/profiler-plugin-react
# bring in @player-devtools/profiler-plugin / -content directly only if you wrap core yourself
```

**Android / JVM** (Maven — group `com.intuit.playerui.devtools.plugins`):

```kotlin
// Android
implementation("com.intuit.playerui.devtools.plugins:profiler-android:<version>")
// JVM
implementation("com.intuit.playerui.devtools.plugins:profiler-plugin:<version>")
```

**iOS / SwiftUI** (Swift Package Manager — products of the `PlayerUIDevtools`
package at https://github.com/player-ui/player):

```swift
.product(name: "PlayerUIDevtoolsProfilerPlugin", package: "PlayerUIDevtools")              // SwiftUI
.product(name: "PlayerUIDevtoolsBaseProfilerDevtoolsPlugin", package: "PlayerUIDevtools")  // iOS base
```

> Published versions are stamped at release time (sources here read
> `0.0.0-PLACEHOLDER`); pin the current release version when you add the
> dependency.

## Architecture

Like [`basic`](../basic), the Profiler follows the layered Devtools pattern: a
platform-agnostic **core** plugin owns all behavior, the **content** package
defines the Devtools UI, and a thin **platform** wrapper configures the messenger
and injects the core plugin into the host Player.

```
Player runtime
   │  addProfilerInterceptorsToHooks: intercept every hook, record start/end timing
   ▼
ProfilerDevtoolsPlugin (core)  ──genDataChangeTransaction──▶  messenger  ──▶  Devtools client / MCP
   ▲                                                                            │
   └──────── processInteraction (start / stop / reset) ◀──── PLUGIN_INTERACTION ─┘
```

While profiling is active, hook timings accumulate into a node tree. On a
snapshot (and on stop), the tree is wrapped in a synthetic `root` node and
published to the `rootNode` (transformed flame-graph) and `rawNodes` data keys,
alongside `profiling` / `displayFlameGraph` flags that drive the UI.

---

## `core` — `@player-devtools/profiler-plugin`

`ProfilerDevtoolsPlugin` extends the base [`DevtoolsPlugin`](../../plugin) and is
constructed with everything except `pluginData` — it supplies its own
[`ProfilerPluginData`](#content--player-devtoolsprofiler-plugin-content).

```ts
import { ProfilerDevtoolsPlugin } from "@player-devtools/profiler-plugin";

const plugin = new ProfilerDevtoolsPlugin({ playerID, handler });
```

### How it profiles

`apply(player)` bails when Devtools is inactive, then calls
`addProfilerInterceptorsToHooks(player, profiler)`. That walks the Player's
`hooks` tree recursively and attaches an `intercept` to every
[`tapable-ts`](https://github.com/intuit/hooks) hook it finds, recording the
start and end time of each tap (the `view` hook is skipped to avoid
double-counting the view controller's own hook). It then starts profiling
immediately.

Captured timings are assembled into a `ProfilerNode` tree. On each snapshot the
tree is wrapped in a synthetic `root` node (whose `value` is the total span in
microseconds) and written into the store via `dset` + [`immer`](https://immerjs.github.io),
then dispatched as a data-change transaction. Published data keys:

| Data key | Meaning |
| --- | --- |
| `rootNode` | The transformed flame-graph tree the UI renders. |
| `rawNodes` | The untransformed captured nodes. |
| `profiling` | Whether profiling is currently running. |
| `displayFlameGraph` | Whether the UI should show the graph (set on stop). |

### Interactions it handles

`processInteraction` calls `super.processInteraction`, then dispatches on type via
an interaction map:

- **`start-profiling`** (`INTERACTIONS.START_PROFILING`) — starts the profiler
  and flags `profiling: true`.
- **`stop-profiling`** (`INTERACTIONS.STOP_PROFILING`) — stops, publishes the
  final `rootNode` / `rawNodes`, and flags `displayFlameGraph: true`.
- **`reset-profiling`** (`INTERACTIONS.RESET_PROFILING`) — clears the captured
  nodes.

---

## `content` — `@player-devtools/profiler-plugin-content`

Defines what the Devtools clients render. It has no runtime Player dependency —
only `@player-devtools/types`.

```ts
import {
  ProfilerPluginData,
  PLUGIN_ID,
  INTERACTIONS,
} from "@player-devtools/profiler-plugin-content";
```

- **`ProfilerPluginData`** — the `PluginData` descriptor: `id`, `name`,
  `version`, the compiled Devtools UI `flow`, and a `capabilities` block. The
  `capabilities` descriptor is what [`describe_plugin`](../../mcp) returns — it
  documents the published `data` keys (`rootNode`, `rawNodes`, `profiling`,
  `displayFlameGraph`) and the `start-profiling` / `stop-profiling` /
  `reset-profiling` actions so agents can discover and drive the profiler.
- **`PLUGIN_ID`** — `"player-ui-profiler-plugin"`.
- **`INTERACTIONS`** — the interaction-type constants (`START_PROFILING`,
  `STOP_PROFILING`, `RESET_PROFILING`).
- **`VIEWS_IDS`** — view ids used by the Devtools UI flow (`Profile`, `Raw`).

The `version` is stamped from the build-time `__VERSION__` global (falling back
to `"unstamped"`), and the `flow` is generated from DSL into
`_generated/flow.json`.

---

## `react` — `@player-devtools/profiler-plugin-react`

`ProfilerReactDevtoolsPlugin` is the plugin you add to a **web** Player. It
extends [`ReactDevtoolsPlugin`](../../plugin/react) and constructs a
`ProfilerDevtoolsPlugin` as its core plugin.

```tsx
import { ProfilerReactDevtoolsPlugin } from "@player-devtools/profiler-plugin-react";

const reactPlayer = new ReactPlayer({
  plugins: [new ProfilerReactDevtoolsPlugin()],
});
```

### Constructor

```ts
new ProfilerReactDevtoolsPlugin(id?: string); // playerID; defaults to "default-id"
```

Give each Player a distinct `id` when running more than one on a page so the
clients can address them individually. (Unlike
[`basic`](../basic#react--player-devtoolsbasic-plugin-react), the profiler
wrapper takes no custom wrapper component — the base
[`ReactDevtoolsPlugin`](../../plugin/react) handles messenger setup.)

## Native platform wrappers

The Android, JVM, iOS, and SwiftUI packages are thin wrappers — identical in
shape to [`basic`'s](../basic#native-platform-wrappers). They load the compiled
`core` bundle (`ProfilerDevtoolsPlugin.native.js`) into the platform's Player JS
runtime and adapt it to the platform's plugin protocol.

### JVM — `ProfilerDevtoolsPlugin` (Kotlin)

`com.intuit.playerui.devtools.plugins.profiler.ProfilerDevtoolsPlugin` extends the
base `DevtoolsPlugin`, constructed through a `Runtime` extension that loads the
bundled core module via `ModuleLoader` and instantiates the JS plugin with
`Options(playerID, handler)`.

```kotlin
val plugin = runtime.ProfilerDevtoolsPlugin(
    ProfilerDevtoolsPlugin.Options(playerID = "my-player", handler = myHandler),
)
```

### Android — `ProfilerAndroidDevtoolsPlugin`

Extends `AndroidDevtoolsPlugin<ProfilerDevtoolsPlugin>`, building its core plugin
from the JVM package. It taps `androidPlayer.hooks.context` to apply a debug
overlay style (`overlayStyle`, defaulting to
`R.style.ProfilerAndroidDevtoolsPlugin`), and bails early when
`checkIfDevtoolsIsActive()` is false.

```kotlin
AndroidPlayer(ProfilerAndroidDevtoolsPlugin(id = "my-player"), /* ... */)
```

### iOS — `BaseProfilerDevtoolsPlugin` (Swift)

A `JSBasePlugin` conforming to `BaseDevtoolsPlugin`. It points the JS runtime at
the bundled `ProfilerDevtoolsPlugin.native.js`, polyfills the context, and passes
`DevtoolsPluginOptions(playerID:handler:)` into the core plugin. It supplies a
default no-op `Handler` — the core JS plugin provides the actual behavior. It does
**not** own a Flipper connection; that's the SwiftUI layer's job. It's `open` so
the SwiftUI plugin can subclass it.

### SwiftUI — `ProfilerDevtoolsPlugin`

Subclasses `BaseProfilerDevtoolsPlugin` and conforms to `DevtoolsPlugin`. This is
the plugin you add to a SwiftUI Player. It owns the runtime wiring the base class
can't: the `DevtoolsFlipperPlugin` connection, a strong `Messenger` reference, the
registered listener `UUID`s, and a `deinit` that tears them down.

```swift
let plugin = ProfilerDevtoolsPlugin(id: "my-player", flipperPlugin: devtoolsFlipperPlugin)
```

> **NOTE**
> If you write your own SwiftUI `DevtoolsPlugin`, you must implement `deinit`
> exactly like this one — the `DevtoolsPlugin` protocol can't provide it.

## Enabling devtools

Add the platform-specific Profiler plugin to your Player configuration and
activate a client connection — the browser extension popup for web, or the
`FlipperClient` for mobile. See the [plugin authoring guide](../../plugin) for the
platform wiring, [`basic`](../basic) for the sibling reference plugin, and
[the devtools root README](../../../README.md) for the overall architecture.

[browser extension]: https://github.com/player-ui/browser-devtools
