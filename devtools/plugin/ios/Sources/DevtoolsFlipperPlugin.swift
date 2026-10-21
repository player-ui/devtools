import SwiftFlipper
import JavaScriptCore
import Foundation
import PlayerUI
import PlayerUIDevtoolsTypes

/// Something that can be told to disconnect.
public protocol FlipperDisconnectable: AnyObject {
    /// Tell devtools this player is gone and stop talking to it.
    func disconnect()
}

/// A Flipper Plugin that provides Devtools capabilities via Flipper. This is the layer that allows everybody else to
/// send messages to and receive messages from Flipper.
public class DevtoolsFlipperPlugin: FlipperPlugin {
    public var id: String = "player-ui-devtools"
    public var runInBackground = false
    
    /// Our connection to the flipper server
    private var flipperConnection: FlipperConnection?
    /// The listeners that are attached to this connection
    public private(set) var listeners: [UUID: MessageListener] = [:]

    /// Attached plugins, by player ID and kind of plugin.
    private var registered: [String: WeakDisconnectable] = [:]
    private let registeredLock = NSLock()

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

    /// Attach `plugin` as the `kind` of plugin (e.g. basic, profiler) for the player `playerID`.
    ///
    /// If a plugin of the same kind is already attached for that player, it is being replaced, so it is
    /// disconnected first. Other player IDs are left alone. Plugins are held weakly.
    ///
    /// Messages are sent in the background, so the old plugin's "stopped" is very likely, but not guaranteed,
    /// to arrive before the new plugin's "init".
    public func register(_ plugin: FlipperDisconnectable, playerID: String, kind: String) {
        let key = "\(playerID)#\(kind)"
        registeredLock.lock()
        let replaced = registered[key]?.value.flatMap { $0 === plugin ? nil : $0 }
        registered[key] = WeakDisconnectable(plugin)
        registeredLock.unlock()

        // Outside the lock, as disconnecting calls `unregister`
        replaced?.disconnect()
    }

    /// Detach `plugin`. Does nothing if it was not attached.
    public func unregister(_ plugin: FlipperDisconnectable) {
        registeredLock.lock()
        defer { registeredLock.unlock() }
        // Also clears entries for plugins that are already gone
        registered = registered.filter { $0.value.value != nil && $0.value.value !== plugin }
    }
}

private struct WeakDisconnectable {
    weak var value: FlipperDisconnectable?

    init(_ value: FlipperDisconnectable) {
        self.value = value
    }
}
