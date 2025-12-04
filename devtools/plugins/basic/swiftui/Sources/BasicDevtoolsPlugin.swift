import PlayerUI
import Foundation
import PlayerUIDevToolsPlugins
import PlayerUIDevToolsTypes
import PlayerUIDevToolsBaseBasicDevtoolsPlugin

/// A Player Plugin that provides DevTools capabilities via Flipper.
/// This is entirely just a wrapper around the JSBasePlugin
public class BasicDevtoolsPlugin: BaseBasicDevtoolsPlugin, DevtoolsPlugin {
    /// Our connection to the flipper server
    public let flipperPlugin = DevtoolsFlipperPlugin()

    public init(id: String) {
        super.init(playerID: id)
    }
}
