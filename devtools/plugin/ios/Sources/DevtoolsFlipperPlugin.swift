import SwiftFlipper
import JavaScriptCore
import Foundation
import PlayerUI
import PlayerUIDevToolsTypes

/// A Flipper Plugin that provides DevTools capabilities via Flipper
public class DevtoolsFlipperPlugin: FlipperPlugin {
    public var id: String = "player-ui-devtools"
    public var runInBackground = false

    /// Our connection to the flipper server
    private var flipperConnection: FlipperConnection?
    /// The messengers that are attached to this connection
    private var listeners: [MessageListener] = []

    public init() {}

    public func didConnect(connection: SwiftFlipper.FlipperConnection) {
        flipperConnection = connection
        // Listen to messages from methods registered under the name "message::flipper"
        connection.receive(method: "message::flipper") { message, _ in
            // We received a message from the flipper server.
            self.listeners.forEach { $0(message) }
        }
    }

    public func didDisconnect() { flipperConnection = nil }

    public func sendMessage(_ message: Message) {
        flipperConnection?.send(method: "message::plugin", params: message)
    }

    public func addListener(_ listener: @escaping MessageListener) {
        listeners.append(listener)
    }

    func removeListener(_ listener: @escaping MessageListener) {
        /* TODO: we can't compare listeners directly on ios.
         Implement workaround. E.g. register listeners by ID? */
    }
}
