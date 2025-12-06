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
        print("[DevtoolsFlipperPlugin] didConnect called")
        // Listen to messages from methods registered under the name "message::flipper"
        // (Matches Android implementation)
        connection.receive(method: "message::flipper") { message, _ in
            // We received a message from the flipper server.
            print("[DevtoolsFlipperPlugin] Received message from Flipper:", message)
            print("[DevtoolsFlipperPlugin] Number of listeners:", self.listeners.count)
            self.listeners.forEach { $0(message) }
        }
    }

    public func didDisconnect() {
        flipperConnection = nil
    }

    public func sendMessage(_ message: Message) {
        flipperConnection?.send(method: "message::plugin", params: message)
    }

    public func addListener(_ listener: @escaping MessageListener) {
        listeners.append(listener)
    }

    public func removeListener(_ listener: @escaping MessageListener) {
        print("DEBUG [iOS DevtoolsFlipperPlugin]: removeListener() called")
        /* TODO: we can't compare listeners directly on ios.
         Implement workaround. E.g. register listeners by ID? */
    }
}
