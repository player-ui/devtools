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
    /// Keep a reference so the messenger doesn't get garbage collected and destroyed
    var messenger: Messenger? { get set }
}


public extension DevtoolsPlugin where Self: NativePlugin {
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
            self.messenger = messenger
            _ = registerMessenger(messenger: messenger)
        } catch {
            player.logger.e(error)
        }
    }
}

/// This just wraps the player logger
struct PlayerLogger: MessengerLogger {
    let logger: TapableLogger
    func log(_ args: Any...) { logger.d(args) }
}
