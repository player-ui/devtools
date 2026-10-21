import Foundation
import PlayerUIDevtoolsMessenger
import PlayerUIDevtoolsPlugin
import PlayerUIDevtoolsSwiftUIPlugin
import PlayerUIDevtoolsBaseBasicDevtoolsPlugin

/// A Player Plugin that provides DevTools capabilities via Flipper.
/// This is entirely just a wrapper around the JSBasePlugin
public class BasicDevtoolsPlugin: BaseBasicDevtoolsPlugin, DevtoolsPlugin {
    /// Our connection to the flipper server
    public let flipperPlugin: DevtoolsFlipperPlugin
    /// Keep a reference so the messenger doesn't get garbage collected and destroyed
    public var messenger: Messenger?
    /// The IDs of all registered listeners associated with this plugin
    public var listeners: [UUID] = []

    public init(id: String, flipperPlugin: DevtoolsFlipperPlugin) {
        self.flipperPlugin = flipperPlugin
        super.init(playerID: id)
    }

    /* Let flipper know that this plugin is going away: tell devtools the player is gone, and
     deregister the listeners we attached to the DevtoolsFlipperPlugin.

     Deinits will NOT run when the app is terminated. But if the app is terminated,
     flipper will gracefully handle the abrupt, implicit disconnect, and deregistering
     the listeners won't matter anymore since they won't be called if the app is dead. */
    deinit {
        // If you make your own DevtoolsPlugin, you will need to implement your own
        // deinit that calls `disconnect()`, like this. The DevtoolsPlugin protocol cannot provide a deinit,
        // unfortunately.
        disconnect()
        print("[DEBUG] BasicDevtoolsPlugin deinited")
    }
}
