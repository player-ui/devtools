import PlayerUIDevtoolsMessenger
import PlayerUIDevtoolsPlugins
import PlayerUIDevtoolsSwiftUIPlugins
import PlayerUIDevtoolsBaseBasicDevtoolsPlugin

/// A Player Plugin that provides DevTools capabilities via Flipper.
/// This is entirely just a wrapper around the JSBasePlugin
public class BasicDevtoolsPlugin: BaseBasicDevtoolsPlugin, DevtoolsPlugin {
    /// Our connection to the flipper server
    public let flipperPlugin: DevtoolsFlipperPlugin
    /// Keep a reference so the messenger doesn't get garbage collected and destroyed
    public var messenger: Messenger?

    public init(id: String, flipperPlugin: DevtoolsFlipperPlugin? = nil) {
        self.flipperPlugin = flipperPlugin ?? DevtoolsFlipperPlugin()
        super.init(playerID: id)
    }

    // Let listeners know that this plugin and its messenger are going away
    deinit {
        // TODO: make the removeListener work?
//        flipperPlugin.removeListener(//)
        guard let messenger else {
            print("[KORITEST] Messenger does not exist!")
            return
        }
        print("[KORITEST] Destroying Messenger")
        messenger.destroy()
    }
}
