import PlayerUI
import PlayerUILogger
import Foundation
import PlayerUIDevToolsPlugins
import PlayerUIDevToolsTypes
import PlayerUIDevToolsBaseBasicDevtoolsPlugin
import PlayerUIDevToolsMessenger

/// A Player Plugin that provides DevTools capabilities via Flipper.
/// This is entirely just a wrapper around the JSBasePlugin
public class BasicDevtoolsPlugin: BaseBasicDevtoolsPlugin, DevtoolsPlugin {
    /// Our connection to the flipper server
    public let flipperPlugin: DevtoolsFlipperPlugin

    public init(id: String, flipperPlugin: DevtoolsFlipperPlugin? = nil) {
        self.flipperPlugin = flipperPlugin ?? DevtoolsFlipperPlugin()
        super.init(playerID: id)
    }

    public func apply<P>(player: P) where P: HeadlessPlayer {
        print("[DEVTOOLSPLUGIN] in apply")
        guard let jsContext = context else {
            player.logger.e(DevtoolsError.jsContextNotFound)
            return
        }

        do {
            let playerID = try playerID
            let options = MessengerOptions(
                id: playerID,
                jsContext: jsContext,
                context: .player,
                logger: PlayerLogger(logger: player.logger),
                sendMessage: flipperPlugin.sendMessage(_:),
                addListener: flipperPlugin.addListener(_:),
                removeListener: flipperPlugin.removeListener(_:),
                messageCallback: try store.dispatch(event:)
            )
            let messenger = try Messenger(options: options)
            _ = registerMessenger(messenger: messenger)
        } catch {
            player.logger.e(error)
        }

//        player.hooks?.state.tap { state in
//            // TODO: what is happening here on android?
//            let temp: BaseFlowState = .init(status: .completed)
//        }
    }
}

/// This just wraps the player logger
struct PlayerLogger: MessengerLogger {
    let logger: TapableLogger
    func log(_ args: Any...) { logger.d(args) }
}
