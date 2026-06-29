import PlayerUI
import PlayerUILogger
import Foundation
import PlayerUIDevtoolsPlugin
import PlayerUIDevtoolsMessenger
import PlayerUIDevtoolsTypes
import JavaScriptCore
import PlayerUIDevtoolsUtilsSwiftUI

open class BaseProfilerDevtoolsPlugin: JSBasePlugin, BaseDevtoolsPlugin {
    /// Matches `bundle_name` / `ios_library(name=...)` in `devtools/plugins/profiler/ios/BUILD` (the `apple_resource_bundle` base name).
    private static let pluginResourceBundleName = "ProfilerDevtoolsPlugin"

    private let _playerID: String
    // This is a var so a different handler can be provided for testing
    var handler: DevtoolsHandler = Handler()

    public init(playerID: String) {
        self._playerID = playerID
        super.init(
            fileName: "ProfilerDevtoolsPlugin.native",
            pluginName: "ProfilerDevtoolsPlugin.ProfilerDevtoolsPlugin"
        )
    }

    public final override func getUrlForFile(fileName: String) -> URL? {
        if let url = Bundle.module.url(forResource: fileName, withExtension: "js") {
            return url
        }
        if let bundleURL = Bundle.main.url(
            forResource: Self.pluginResourceBundleName,
            withExtension: "bundle"
        ),
            let pluginBundle = Bundle(url: bundleURL),
            let url = pluginBundle.url(forResource: fileName, withExtension: "js") {
            return url
        }
        return Bundle.main.url(forResource: fileName, withExtension: "js")
    }

    public override func getArguments() -> [Any] {
        guard let context else { return [] }
        // TODO: replace with proper polyfill plugin after https://github.com/player-ui/player/issues/773
        context.polyfill()

        // PluginData is nil. The core profiler plugin provides its own plugin data
        let options = DevtoolsPluginOptions(in: context , playerID: _playerID, handler: handler)
        return [options.jsCompatible]
    }

    /// This will process messages. The core plugin augments this handler with some logging and metadata
    struct Handler: DevtoolsHandler {
        var isActive = true

        // This plugin has no extra steps for processInteraction beyond the core impl.
        func processInteraction(interaction: PlayerUIDevtoolsTypes.Message) {}

        // This plugin has no extra steps for log beyond the core impl.
        func log(message: String) {}
    }
}
