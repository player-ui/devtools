import PlayerUI
import PlayerUILogger
import Foundation
import PlayerUIDevtoolsPlugins
import PlayerUIDevtoolsMessenger
import PlayerUIDevtoolsTypes
import JavaScriptCore
import PlayerUIDevtoolsUtilsSwiftUI
import PlayerUIDevtoolsSwiftUIPlugins

public class BaseProfilerDevtoolsPlugin: JSBasePlugin, BaseDevtoolsPlugin {
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
        
        // PluginData is nil. The core basic plugin provides its own plugin data
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

/// A Player Plugin that provides DevTools capabilities via Flipper.
/// This is entirely just a wrapper around the JSBasePlugin
public class ProfilerDevtoolsPlugin: BaseProfilerDevtoolsPlugin, DevtoolsPlugin {
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

    /* Let flipper know that this plugin is going away. Deregister the listeners we
     attached to the DevtoolsFlipperPlugin.

     Deinits will NOT run when the app is terminated. But if the app is terminated,
     flipper will gracefully handle the abrupt, implicit disconnect, and deregistering
     the listeners won't matter anymore since they won't be called if the app is dead. */
    deinit {
        // If you make your own DevtoolsPlugin, you will need to implement your own
        // deinit, exactly like this. The DevtoolsPlugin protocol cannot provide a deinit,
        // unfortunately.
        if let messenger {
            messenger.destroy()
        } else {
            print("[DEBUG] Could not destroy messenger. Messenger already no longer exists.")
        }
        listeners.forEach { flipperPlugin.removeListener(id: $0) }
        print("[DEBUG] BasicDevtoolsPlugin deinited")
    }
}
