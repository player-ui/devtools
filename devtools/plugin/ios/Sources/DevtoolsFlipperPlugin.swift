import SwiftFlipper
import JavaScriptCore
import Foundation
import PlayerUI
import PlayerUIDevtoolsTypes

/// A Flipper Plugin that provides Devtools capabilities via Flipper. This is the layer that allows everybody else to
/// send messages to and receive messages from Flipper.
public class DevtoolsFlipperPlugin: FlipperPlugin {
    public var id: String = "player-ui-devtools"
    public var runInBackground = false
    
    /// Our connection to the flipper server
    private var flipperConnection: FlipperConnection?
    /// The listeners that are attached to this connection
    public private(set) var listeners: [UUID: MessageListener] = [:]

    public init() {}
    
    public func didConnect(connection: SwiftFlipper.FlipperConnection) {
        flipperConnection = connection
        // Listen to messages from methods registered under the name "message::flipper"
        // (Matches Android implementation)
        connection.receive(method: "message::flipper") { message, _ in
            // We received a message from the flipper server.
            self.listeners.values.forEach { $0(message) }
        }
    }
    
    public func didDisconnect() {
        flipperConnection = nil
    }
    
    public func sendMessage(_ message: Message) {
        flipperConnection?.send(method: "message::plugin", params: message)
    }

    /// Add a "listener". The "listener" is a function that will be called whenever we receive a message from flipper.
    /// Return a unique ID that can be used to remove this listener.
    ///
    /// If the owner of the listener goes away before app termination, ensure that the listeners are removed.
    public func addListener(_ listener: @escaping MessageListener) -> UUID {
        let id = UUID()
        listeners[id] = listener
        return id
    }

    /// Remove the listener with the given `id`.
    ///
    /// If the owner of a listener is going to go away before app termination, ensure that the listeners are removed.
    public func removeListener(id: UUID) {
        _ = listeners.removeValue(forKey: id)
    }
}
