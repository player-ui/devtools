import PlayerUI
import Foundation
import PlayerUIDevToolsPlugins


/// A Player Plugin that provides DevTools capabilities via Flipper
open class BasicDevtoolsCoreWrapper: JSBasePlugin {
    /// Configuration for this plugin
    let options: DevtoolsPluginOptions

    public init(playerID: String, handler: DevtoolsHandler) {
        // PluginData is nil. The core basic plugin provides its own plugin data
        self.options = .init(playerID: playerID, handler: handler)
        super.init(fileName: "BasicDevtoolsPlugin.native", pluginName: "BasicDevtoolsPlugin.BasicDevtoolsPlugin")
    }

    public override func getUrlForFile(fileName: String) -> URL? {
        Bundle.module.url(forResource: fileName, withExtension: "js")
    }

    public override func getArguments() -> [Any] { [options.jsCompatible] }
}
