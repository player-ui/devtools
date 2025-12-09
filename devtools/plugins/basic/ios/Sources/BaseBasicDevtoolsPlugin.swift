import PlayerUI
import PlayerUILogger
import Foundation
import PlayerUIDevToolsPlugins
import PlayerUIDevToolsMessenger
import PlayerUIDevToolsTypes
import JavaScriptCore

/// A Player Plugin that provides DevTools capabilities via Flipper
open class BaseBasicDevtoolsPlugin: JSBasePlugin, BaseDevtoolsPlugin {
    let _playerID: String
    // This is a var so a different handler can be provided for testing
    var handler: DevtoolsHandler = Handler()

    // TODO: revisit all the names
    public init(playerID: String) {
        self._playerID = playerID
        super.init(
            fileName: "BasicDevtoolsPlugin.native",
            pluginName: "BasicDevtoolsPlugin.BasicDevtoolsPlugin"
        )
    }

    public override func getUrlForFile(fileName: String) -> URL? {
        Bundle.module.url(forResource: fileName, withExtension: "js")
    }

    public override func getArguments() -> [Any] {
        guard let context else { return [] }
        context.polyfill() // TODO: replace with the proper poylfill plugin

        // PluginData is nil. The core basic plugin provides its own plugin data
        let options = DevtoolsPluginOptions(in: context , playerID: _playerID, handler: handler)
        return [options.jsCompatible]
    }

    /// This will process messages. The core plugin augments this handler with some logging and metadata
    struct Handler: DevtoolsHandler {
        var isActive = true

        func processInteraction(interaction: PlayerUIDevToolsTypes.Message) {
            print("[DEVTOOLS] processInteraction called with: \(interaction)")
        }

        func log(message: String) {
            print("[DEVTOOLS] log: \(message)")
        }
    }
}
