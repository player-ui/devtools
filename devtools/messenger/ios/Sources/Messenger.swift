//
// Messenger.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import PlayerUI
import JavaScriptCore
import PlayerUIDevToolsTypes
import PlayerUIDevToolsUtils

/// Swift wrapper for the JavaScript Messenger implementation
/// Provides a native Swift API while delegating to the JS implementation
public class Messenger<Message: BaseEvent> {
    private let jsMessenger: JSValue

    /// Initialize a new Messenger instance
    /// - Parameter options: Configuration options for the messenger
    /// - Throws: MessengerError if initialization fails
    public init(options: MessengerOptions<Message>) throws {
        let jsOptions = try options.asJSValue()
        self.jsMessenger = try JSValue.construct(
            className: "Messenger",
            inBundle: Bundle.module,
            withArguments: [jsOptions as Any]
        )
    }

    /// Send a message through the messenger
    /// - Parameter message: The message to send
    public func sendMessage(_ message: Message) {
        do {
            let messageData = try JSONEncoder().encode(message)
            let messageString = String(data: messageData, encoding: .utf8) ?? "{}"

            jsMessenger.invokeMethod("sendMessage", withArguments: [messageString])
        } catch {
            print("Failed to encode message: \(error)")
        }
    }

    /// Send a message as a JSON string
    /// - Parameter messageString: The message as a JSON string
    public func sendMessage(_ messageString: String) {
        jsMessenger.invokeMethod("sendMessage", withArguments: [messageString])
    }

    /// Destroy the messenger instance and clean up resources
    public func destroy() {
        jsMessenger.invokeMethod("destroy", withArguments: [])
    }

    /// Reset static records (bridges to JavaScript implementation)
    ///
    /// **Important:** This method calls the static `Messenger.reset()` method in JavaScript,
    /// which clears ALL static state (events and connections) for ALL messenger instances
    /// that share the same JavaScript context. This affects:
    ///
    /// - All Swift Messenger instances (since they share `sharedJSContext`)
    /// - All events stored in the JavaScript static `events` record
    /// - All connections stored in the JavaScript static `connections` record
    ///
    /// This is an instance method (not static) because it needs access to the shared
    /// JavaScript context, but it performs a global operation affecting all instances.
    /// Use with caution in multi-instance scenarios.
    public func reset() {
        guard let messengerClass = JSContext()
            .objectForKeyedSubscript("Messenger")
            .objectForKeyedSubscript("Messenger")
        else {
            print("Warning: Messenger class not found in JavaScript context")
            return
        }

        messengerClass.invokeMethod("reset", withArguments: [])
    }
}

// MARK: - Error Types

/// The different types of errors that can occur when using the Messenger
public enum MessengerError: Error, LocalizedError {
    case jsSourceNotFound
    case initializationFailed
    case encodingFailed
    case decodingFailed

    public var errorDescription: String? {
        switch self {
        case .jsSourceNotFound:
            return "JavaScript Messenger source file not found"
        case .initializationFailed:
            return "Failed to initialize JavaScript Messenger"
        case .encodingFailed:
            return "Failed to encode message"
        case .decodingFailed:
            return "Failed to decode message"
        }
    }
}
