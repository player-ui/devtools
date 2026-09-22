# Connecting to Flipper

[Flipper](https://fbflipper.com) is a multiplatform debugging tool -- primarily
aimed at providing a central place for debugging multiplatform applications.
Our browser extension surfaces the Player UI Devtools directly within the browser,
and our Flipper plugin, `player-ui-devtools`, renders the same within the Flipper desktop app.

More importantly, the Flipper platform provides a stable multiplatform connection
model for debugging applications -- which we leverage for other devtools clients,
such as the MCP. This enables any Player, regardless of platform, to connect to
our devtools suite in a consistent manner.

Connecting an app has two parts:
- [Local env setup](#local-env-setup)
- [Application configuration](#application-configuration)
  1. Establish Flipper connection
  2. Install Player Devtools plugin

## Local env setup

If you already have the Flipper desktop app installed, you can use that directly -- 
simply install the `player-ui-devtools` Flipper plugin via the plugin manager and
enable it once you have established a connection to an app.

That said, our MCP will run a Flipper server and perform all 1-time setup for you.
If you don't already have Flipper installed manually, It's recommended to simply add
the MCP to your project and start it up. Flipper UI will be served at http://localhost:52342
by default if you're interested, but is not required to connect your agent to devtools.

See the [`MCP`](./mcp) docs for more info.

## Application configuration

Add a [Devtools plugin](./plugin) (for example, the [basic plugin](./plugins/basic))
to your Player, keyed by a `playerID`, then connect that platform's `FlipperClient`.
Android and iOS each need their own native `FlipperClient` connection; the browser
extension has a toggle for enabling the Flipper connection for web.

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

### Web

Web serves the Devtools UI directly as a browser extension -- however, this doesn't allow
for your agent to leverage our MCP to easily access this data. The browser extension does
have a toggle for enabling the Flipper connection via the browser extension, such that all
web-based Players can effectively connect to any embedded devtools client or MCP. Ensure you
have a devtools plugin installed to your Player (i.e. [`BasicReactDevtoolsPlugin`](./plugins/basic#react--player-devtoolsbasic-plugin-react))
and toggle devtools & the Flipper connection via the browser popup.

## Related

- [`plugin`](./plugin) — the platform-agnostic Devtools plugin foundations
  each native `FlipperPlugin` implementation above builds on.
- [`plugins/basic`](./plugins/basic) — the reference plugin used in the
  examples above.
- [`flipper-plugin`](./flipper-plugin) — the Flipper desktop plugin these
  steps install.
- [`mcp`](./mcp) — the agent-facing alternative to a human driving Flipper by hand.
- [The devtools root README](../README.md) — the overall architecture.
