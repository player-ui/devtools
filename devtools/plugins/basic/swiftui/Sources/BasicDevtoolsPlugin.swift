import PlayerUI
import Foundation
import PlayerUIDevToolsPlugins
import PlayerUIDevToolsTypes
import PlayerUIDevToolsBasicCoreWrapper

/// A Player Plugin that provides DevTools capabilities via Flipper.
/// This is entirely just a wrapper around the JSBasePlugin
public class BasicDevtoolsPlugin: BaseBasicDevtoolsPlugin, NativePlugin {
    public init(id: String) {
        super.init(playerID: id, handler: DemoDevtoolsHandler())
    }

    public func apply<P>(player: P) where P: HeadlessPlayer {
        print("DEBUG [BasicDevtoolsCoreWrapper]: apply() called on player")
    }
}

// TODO: rename
struct DemoDevtoolsHandler: DevtoolsHandler {
    var isActive: Bool = true
    func processInteraction(interaction: PlayerUIDevToolsTypes.Message) {
        print("DEBUG [DemoDevtoolsHandler]: DEVTOOLS INTERACTION: \(interaction)")
    }
}
