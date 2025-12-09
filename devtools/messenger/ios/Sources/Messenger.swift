//
// Messenger.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import PlayerUI
import JavaScriptCore
import PlayerUIDevToolsTypes
import PlayerUIDevToolsUtils

/// Swift wrapper for the JavaScript Messenger implementation.
/// Provides a native Swift API while delegating to the JS implementation.
public class Messenger {
    /// A thread-safe way to access the JS Messenger
    private let jsMessengerActor: JSMessengerActor

    /// This object in a format that JS can understand. DO NOT attempt to call methods on this directly.
    public let jsCompatible: JSValue

    /// Initialize a new Messenger instance
    /// - Parameter options: The options to use for this instance
    /// - Throws: MessengerError if initialization fails
    public init(options: MessengerOptions) throws {
        // We can pull the jsContext from the MessengerOptions. This is helpful
        // because the options and Messenger need to have the same context
        guard let jsOptions = options.asJSValue, let context = jsOptions.context else {
            throw MessengerError.failedToConvertOptionsToJSValue
        }

        // TODO: Actually do something with logger + debug option
        let jsMessenger = try context.construct(
            className: "Messenger",
            inBundle: Bundle.module,
            withArguments: [jsOptions],
            withPolyfill: { _ in /* TODO: remove this set up */ }
        )
        self.jsMessengerActor = JSMessengerActor(jsMessenger)
        self.jsCompatible = jsMessenger
    }

    /// Send a message through the messenger.
    ///
    /// - Parameter message: The message to send
    public func sendMessage(_ message: Message) async throws {
        try await send(message: message)
    }

    /// Send a message as a JSON string
    ///
    /// - Parameter messageString: The message
    public func sendMessage(_ messageString: String) async throws {
        try await send(message: messageString)
    }

    /// Helper to actually send the message.
    /// Usually, we want to avoid `Any`. However, the JS function accepts `[Any]` as arguments.
    /// So in this case, it's... okay.
    private func send(message: Any) async throws {
        guard let promise = jsMessengerActor.messenger
            .invokeMethodSafely("sendMessage", withArguments: [message])
        else {
            throw MessengerError.didNotReceiveJSPromise
        }

        // This is a wrapper that allows us to wait for the then/catch callbacks from the JS Promise
        try await withCheckedThrowingContinuation { continuation in
            let onResolve: @convention(block) () -> Void = { continuation.resume() }
            guard let context = promise.context else {
                return continuation.resume(throwing: MessengerError.didNotReceiveJSPromise)
            }
            let jsResolve = JSValue(object: onResolve, in: context)
            _ = promise.invokeMethodSafely("then", withArguments: [jsResolve as Any])
        }
    }

    /// Destroy the messenger instance and clean up resources.
    /// If this is not done, the interval will continue to send out beacons for this Messenger even when it doesn't exist anymore.
    /// This is the equivalent to the manual `destroy()` on the JS layer.
    deinit {
        print("[DEINIT] Messenger.swift")
        _ = jsMessengerActor.messenger.invokeMethodSafely("destroy")
    }
}

// MARK: - Error Types

/// The different types of errors that can occur when using the Messenger
public enum MessengerError: Error, LocalizedError {
    /// Failed to initialize the JavaScript Messenger instance
    case failedToConvertOptionsToJSValue

    case didNotReceiveJSPromise

    case failedToSendMessage

    /// A localized description of the error
    public var errorDescription: String? {
        switch self {
        case .failedToConvertOptionsToJSValue:
            return "Failed to convert Swift native options to JS options"
        case .didNotReceiveJSPromise:
            return "Failed to send message: JS messenger did not return Promise"
        case .failedToSendMessage:
            return "Failed to send message: propagated JS error"
        }
    }
}

/// A wrapper for the JSValue needed by the Messenger.
class JSMessengerActor {
    let messenger: JSValue

    init(_ messenger: JSValue) {
        self.messenger = messenger
    }
}
