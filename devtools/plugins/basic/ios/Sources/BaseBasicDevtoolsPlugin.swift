import PlayerUI
import PlayerUILogger
import Foundation
import PlayerUIDevToolsPlugins
import PlayerUIDevToolsMessenger
import PlayerUIDevToolsTypes
import JavaScriptCore

/// A Player Plugin that provides DevTools capabilities via Flipper
open class BaseBasicDevtoolsPlugin: JSBasePlugin, BaseDevtoolsPlugin {
    private let _playerID: String
    // This is a var so a different handler can be provided for testing
    var handler: DevtoolsHandler = Handler()
    
    public init(playerID: String) {
        self._playerID = playerID
        super.init(
            fileName: "BasicDevtoolsPlugin.native",
            pluginName: "BasicDevtoolsPlugin.BasicDevtoolsPlugin"
        )
    }
    
    public final override func getUrlForFile(fileName: String) -> URL? {
        Bundle.module.url(forResource: fileName, withExtension: "js")
    }

    public override func getArguments() -> [Any] {
        guard let context else { return [] }
        // TODO: replace with proper polyfill plugin after https://github.com/player-ui/player/issues/773
        context.polyfill()
        
        // PluginData is nil. The core basic plugin provides its own plugin data
        let options = DevtoolsPluginOptions(in: context , playerID: _playerID, handler: handler)
        return [options.jsCompatible]
    }
    
    /// This will process messages. The core plugin augments this handler with some logging and metadata
    struct Handler: DevtoolsHandler {
        var isActive = true
        
        // This plugin has no extra steps for processInteraction beyond the core impl.
        func processInteraction(interaction: PlayerUIDevToolsTypes.Message) {}
        
        // This plugin has no extra steps for log beyond the core impl.
        func log(message: String) {}
    }
}
