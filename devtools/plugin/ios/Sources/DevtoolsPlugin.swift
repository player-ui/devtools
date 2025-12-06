import PlayerUI
import JavaScriptCore
import SwiftFlipper
import PlayerUIDevToolsTypes
import PlayerUIDevToolsMessenger
import PlayerUILogger

/// A protocol defining a Player Plugin that provides DevTools capabilities via Flipper
public protocol DevtoolsPlugin: BaseDevtoolsPlugin, NativePlugin {
    /// Our connection to the flipper server
    var flipperPlugin: DevtoolsFlipperPlugin { get }
}
