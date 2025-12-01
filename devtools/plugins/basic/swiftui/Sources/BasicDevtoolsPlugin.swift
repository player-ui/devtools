import PlayerUI
import Foundation
import PlayerUIDevToolsPlugins
import PlayerUIDevToolsTypes
import PlayerUIDevToolsBasicCoreWrapper

/// A Player Plugin that provides DevTools capabilities via Flipper.
/// This is entirely just a wrapper around the JSBasePlugin
public class BasicDevtoolsPlugin: BasicDevtoolsCoreWrapper, NativePlugin {
    public init(id: String) {
        super.init(playerID: id, handler: DemoDevtoolsHandler())
    }
}

struct DemoDevtoolsHandler: DevtoolsHandler {
    var isActive: Bool = true
    func processInteraction(interaction: PlayerUIDevToolsTypes.Message) {
        print("DEVTOOLS INTERACTION: \(interaction)")
    }
}
