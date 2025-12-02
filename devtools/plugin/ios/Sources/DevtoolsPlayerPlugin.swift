import PlayerUI
import JavaScriptCore
import SwiftFlipper
import PlayerUIDevToolsTypes
import PlayerUIDevToolsMessenger
import PlayerUILogger

/// A Player Plugin that provides DevTools capabilities via Flipper
open class DevtoolsPlayerPlugin: BaseDevtoolsPlayerPlugin, NativePlugin {
    /// Our connection to the flipper server
    private let flipperPlugin = DevtoolsFlipperPlugin()

    public func apply<P>(player: P) where P: HeadlessPlayer {
        guard let jsContext = context else {
            player.logger.e(DevtoolsError.jsContextNotFound)
            return
        }

        let options = MessengerOptions(
            id: flipperPlugin.id,
            jsContext: jsContext,
            context: .player,
            logger: PlayerLogger(logger: player.logger),
            sendMessage: flipperPlugin.sendMessage(_:),
            addListener: flipperPlugin.addListener(_:),
            removeListener: flipperPlugin.removeListener(_:),
            messageCallback: { _ in } // TODO: implement
        )
        do {
            let messenger = try Messenger(options: options)
            _  = registerMessenger(messenger: messenger)
        } catch {
            player.logger.e(error)
        }

//        player.hooks?.state.tap { state in
//            // TODO: what is happening here on android?
//            let temp: BaseFlowState = .init(status: .completed)
//        }
    }

    private func registerMessenger(messenger: Messenger) -> Unsubscribe {
        let unsubscribe = pluginRef?.invokeMethod("registerMessenger", withArguments: [messenger.jsCompatible])
        return { unsubscribe?.call(withArguments: []) }
    }
}

/// A Player Plugin that provides DevTools capabilities via Flipper
open class BaseDevtoolsPlayerPlugin: JSBasePlugin { // TODO: split out to different folders
    /// Configuration for this plugin
    let options: DevtoolsPluginOptions

    /// The id of the plugin
    public var pluginID: String? {
        get { pluginRef?.forProperty("pluginID")?.toString() }
    }

    /// The id of the player
    public var playerID: String? {
        get { pluginRef?.forProperty("playerID")?.toString() }
    }

    public init(options: DevtoolsPluginOptions) {
        self.options = options
        super.init(fileName: "DevtoolsPlugin.native", pluginName: "DevtoolsPlugin.DevtoolsPlugin")
    }

    public override func getUrlForFile(fileName: String) -> URL? {
        Bundle.module.url(forResource: fileName, withExtension: "js")
    }

    public override func getArguments() -> [Any] { [options.jsCompatible] }
}

public struct DevtoolsPluginOptions {
    let playerID: String
    let handler: DevtoolsHandler
    let pluginData: PluginData?

    public init(playerID: String, handler: DevtoolsHandler, pluginData: PluginData? = nil) {
        self.playerID = playerID
        self.handler = handler
        self.pluginData = pluginData
    }

    /// Format the options into a type JS can parse
    public var jsCompatible: [String: Any] {
        var dict: [String: Any] = [
            "playerID": playerID,
            "handler": handler.jsCompatible
        ]
        if let pluginData {
            dict["pluginData"] = pluginData.jsCompatible
        }
        return dict
    }
}

public struct PluginData {
    let id: String
    let version: String
    let name: String
    let description: String
    let flow: [String: Any]

    public init(id: String, version: String, name: String, description: String, flow: [String: Any]) {
        self.id = id
        self.version = version
        self.name = name
        self.description = description
        self.flow = flow
    }

    var jsCompatible: [String: Any] {
        [
            "id": id,
            "version": version,
            "name": name,
            "description": description,
            "flow": flow
        ]
    }
}

/// This just wraps the player logger
struct PlayerLogger: MessengerLogger {
    let logger: TapableLogger
    func log(_ args: Any...) { logger.d(args) }
}

enum DevtoolsError: LocalizedError {
    case jsContextNotFound

    var errorDescription: String? {
        switch self {
        case .jsContextNotFound:
            return "Did not receive non-nil JSContext from Player. Devtools will not be initialized."
        }
    }
}
