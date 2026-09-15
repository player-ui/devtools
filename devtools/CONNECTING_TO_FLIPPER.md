# Connecting to Flipper

[Flipper](https://fbflipper.com) is the desktop client for inspecting **mobile**
(Android / iOS) Players — it plays the same role the browser extension plays
for web. Web does not use Flipper; see [Web](#web) below.

Connecting an app has two parts: install the desktop plugin once, then wire
your app's Player to a Flipper connection.

## 1. Install the Flipper desktop plugin (mobile only, one-time)

> **Driving devtools from an agent instead?** Skip this — the [MCP server](./mcp)
> manages its own `flipper-server` for you (see [Installation](./mcp#installation)).

1. Install Flipper:
   [fbflipper.com/docs/getting-started](https://fbflipper.com/docs/getting-started/#installation).
2. Build and install this repo's desktop plugin into `~/.flipper/installed-plugins`:
   ```bash
   just install-flipper-client
   ```
3. Restart Flipper and enable the **Player UI Devtools** plugin.

See [`flipper-plugin`](./flipper-plugin) for what the recipe does and
troubleshooting steps if the plugin doesn't appear.

## 2. Wire up the app

Add a [Devtools plugin](./plugin) (typically the [basic plugin](./plugins/basic))
to your Player, keyed by a `playerID`, then connect that platform's `FlipperClient`.
Android and iOS each need their own native `FlipperClient` connection; web has
no Flipper step.

### Android

```kotlin
implementation("com.facebook.flipper:flipper:0.273.0")
implementation("com.intuit.playerui.devtools.plugins:basic-android:<version>")
```

```kotlin
val client = AndroidFlipperClient.getInstance(context)
client.addPlugin(PlayerDevtoolsFlipperPlugin())
client.start()

AndroidPlayer(
    BasicAndroidDevtoolsPlugin(id = "my-player"),
    /* ... */
)
```

`AndroidDevtoolsPlugin.checkIfDevtoolsIsActive()` looks up
`PlayerDevtoolsFlipperPlugin` via `AndroidFlipperClient.getInstanceIfInitialized()`
— nothing is wired (no messenger, no overhead) until that plugin is registered.
See [`AndroidDevtoolsPlugin.kt`](./plugin/android/src/main/kotlin/com/intuit/playerui/devtools/AndroidDevtoolsPlugin.kt)
and [`PlayerDevtoolsFlipperPlugin.kt`](./plugin/android/src/main/kotlin/com/intuit/playerui/devtools/PlayerDevtoolsFlipperPlugin.kt).

> No Android demo app exists in this repo — see the iOS demo below for an
> end-to-end reference of the same wiring shape.

### iOS

```swift
.product(name: "PlayerUIDevtoolsPlugin", package: "PlayerUIDevtools")
.product(name: "PlayerUIDevtoolsBasicPlugin", package: "PlayerUIDevtools")
```

The `ios/demo` app is the working reference — see
[`DemoApp.swift`](../ios/demo/Sources/DemoApp.swift). Construct one
`FlipperClient` and one `DevtoolsFlipperPlugin`, and pass that same
`flipperPlugin` instance into every Devtools plugin you build (they all publish
through the same connection):

```swift
import SwiftFlipper
import PlayerUIDevtoolsPlugin
import PlayerUIDevtoolsBasicPlugin

class DemoViewModel: ObservableObject {
    private let flipperClient = FlipperClient(connectionConfig: .init(), plugins: [])
    let flipperPlugin = DevtoolsFlipperPlugin()

    @Published private(set) var defaultPlugins: [NativePlugin]

    init() {
        defaultPlugins = [
            BasicDevtoolsPlugin(id: "my-player", flipperPlugin: flipperPlugin),
        ]

        flipperClient.addPlugin(flipperPlugin)
        flipperClient.connectToFlipper()
    }
}
```

See [`DevtoolsFlipperPlugin.swift`](./plugin/ios/Sources/DevtoolsFlipperPlugin.swift).

> **NOTE**
> The demo's own `Package.swift` pins a different `SwiftFlipper` fork/branch
> than the published `PlayerUIDevtools` package — follow the root
> [`Package.swift`](../Package.swift)'s resolution, not the demo's dev-only one.

### Web

Web doesn't connect to Flipper — it uses the browser extension instead. Add
`BasicReactDevtoolsPlugin` to your `ReactPlayer` and toggle the connection from
the Devtools' extension popup (which sets `localStorage["player-ui-devtools-active"]`).
See [`plugins/basic`](./plugins/basic#react--player-devtoolsbasic-plugin-react)
for the web wiring.

## Related

- [`plugin`](./plugin) — the platform-agnostic Devtools plugin foundations
  each native `FlipperPlugin` implementation above builds on.
- [`plugins/basic`](./plugins/basic) — the reference plugin used in the
  examples above.
- [`flipper-plugin`](./flipper-plugin) — the Flipper desktop plugin these
  steps install.
- [`mcp`](./mcp) — the agent-facing alternative to a human driving Flipper by hand.
- [The devtools root README](../README.md) — the overall architecture.
