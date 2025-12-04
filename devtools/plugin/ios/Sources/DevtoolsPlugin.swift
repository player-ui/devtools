import PlayerUI
import JavaScriptCore
import SwiftFlipper
import PlayerUIDevToolsTypes
import PlayerUIDevToolsMessenger
import PlayerUILogger

/// A protocol defining a Player Plugin that provides DevTools capabilities via Flipper
public protocol DevtoolsPlugin: BaseDevtoolsPlugin, NativePlugin {
    /// Our connection to the flipper server
    var flipperPlugin: DevtoolsFlipperPlugin { get }
}

extension DevtoolsPlugin {
    func apply<P>(player: P) where P: HeadlessPlayer {
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
