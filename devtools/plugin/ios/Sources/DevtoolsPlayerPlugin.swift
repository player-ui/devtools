import PlayerUI
import JavaScriptCore
import SwiftFlipper
import PlayerUIDevToolsTypes
import PlayerUIDevToolsMessenger
import PlayerUILogger

/// A Player Plugin that provides DevTools capabilities via Flipper
public class DevtoolsPlayerPlugin: JSBasePlugin, NativePlugin {
    /// Configuration for this plugin
    let options: DevtoolsPluginOptions

    /// Our connection to the flipper server
    private let flipperPlugin = DevtoolsFlipperPlugin()

    /// The id of the plugin
    public var pluginID: String? {
        get { pluginRef?.invokeMethod("pluginID", withArguments: []).toString() }
    }

    /// The id of the player
    public var playerID: String? {
        get { pluginRef?.invokeMethod("playerID", withArguments: []).toString() }
    }

    // TODO: do we need the store to be public?

    public init(options: DevtoolsPluginOptions) {
        self.options = options
        super.init(fileName: "DevtoolsPlugin.native", pluginName: "DevtoolsPlugin")
    }

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

        player.hooks?.state.tap { state in
            // TODO: wtf is happening here on android?
            let temp: BaseFlowState = .init(status: .completed)
        }
    }

    public override func getUrlForFile(fileName: String) -> URL? {
        Bundle.module.url(forResource: fileName, withExtension: "js")
    }

    public override func getArguments() -> [Any] { [options.jsCompatible] }

    func registerMessenger(messenger: Messenger) -> Unsubscribe {
        let unsubscribe = pluginRef?.invokeMethod("registerMessenger", withArguments: [messenger.jsCompatible])
        return { unsubscribe?.call(withArguments: []) }
    }
}

public struct DevtoolsPluginOptions {
    let playerID: String
    let handler: DevtoolsHandler

    public init(playerID: String, handler: DevtoolsHandler) {
        self.playerID = playerID
        self.handler = handler
    }

    /// Format the options into a type JS can parse
    var jsCompatible: [String: Any] {
        [
            "playerID": playerID,
            "handler": handler.jsCompatible
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
