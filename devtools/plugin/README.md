# Devtools Plugins

As a plugin-driven system, Player debugging through Devtools may require capabilities specific to your integration. These packages contain the foundations for custom Player Devtools plugins, but are not complete Devtools plugins themselves. For debugging core Player functionality, [BasicDevtoolsPlugin](../plugins/basic) is provided to expose such state through the Devtools clients.

There is a browser extension Devtools client for web Player use cases, and a [Flipper](https://github.com/facebook/flipper) plugin for mobile Player use cases. The base plugin implementations for each platform are configured to communicate with these respective clients.

## Building your own plugin

The Player Devtools clients were built to integrate with any arbitrary Player Devtools plugin. This actually works by using a Player instance for the debugging experience itself, publishing the Player content and data updates from the plugin to the clients. These Players are configured to use the [devtools-assets](https://github.com/player-ui/devtools-assets) for rendering, as such devtools plugin content is required to conform to those asset APIs.

> NOTE
> [BasicDevtoolsPlugins] is a great plugin to include in your Player configuration, but will also serve as a great reference for implementing your own plugin.

### Core plugin implementation

Interaction with platform-agnostic Player APIs should be captured with platform-agnostic Devtools plugins and wrapped for use on multiple platforms. The platform implementations would have the opportunity to expand on the core plugin, but don't necessarily need to.

Implementing the core plugin is done by extending the `DevtoolsPlugin` and providing `pluginData`, `apply` and `processInteraction` implementations. `pluginData` contains the client Player content, defining the actual client experience for this plugin.

`apply` is where you'll tap into platform-agnostic Player or plugin APIs to gather info for informing the Devtools clients. `processInteraction` is where you'll handle interactions from the Devtools clients.

> NOTE
> Calling `super.apply(player)` is important to ensure init events are sent to the clients, but it is best practice to `checkIfDevtoolsIsActive` before calling `super.apply` to avoid unnecessary work. This also applies to the platform-specific implementations, if they override `apply` as well.

### Platform-specific plugin implementation

Even if you don't have a core plugin for your use case, the platform-specific Devtools plugins still rely on the base core plugin for state management. And even if you don't have platform-specific capabilities to debug, you'll still need to implement a platform-specific plugin to configure the messenger.

Similarly to the core plugin, platform-specific plugins will extend `{Platform}DevtoolsPlugin` (i.e. `ReactDevtoolsPlugin` & `AndroidDevtoolsPlugin`) and must provide the core devtools plugin to use, which will either be your platform-agnostic `DevtoolsPlugin` implementation or the base `DevtoolsPlugin` configured with `pluginData` (since that isn't coming from a core implementation).

`apply` and `processInteraction` can also be overridden to provide platform-specific functionality.


## Enabling devtools

To enable devtools, simply add the platform-specific devtools plugins to your Player configuration, and activate connection to the devtools clients. For mobile, this is done by configuring the [`FlipperClient`](https://github.com/facebook/flipper/blob/main/docs/getting-started/android-native.mdx) in your app -- for web, activate through the browser extension popup.
