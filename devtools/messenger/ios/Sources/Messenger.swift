//
// Messenger.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import PlayerUI
import JavaScriptCore
import PlayerUIDevtoolsTypes
import PlayerUIDevtoolsUtils

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
            withArguments: [jsOptions]
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
            throw MessengerError.didNotReceiveJSPromise(method: "sendMessage")
        }

        // This is a wrapper that allows us to wait for the then/catch callbacks from the JS Promise
        let checkedContinuation: (CheckedContinuation<Void, any Error>) -> Void = { continuation in
                guard let context = promise.context else {
                    return continuation.resume(throwing: MessengerError.couldNotFindJSContext(variable: "promise"))
                }

                let onResolve: @convention(block) () -> Void = { continuation.resume() }
                let jsResolve = JSValue(object: onResolve, in: context)

                let onReject: @convention(block) (JSValue) -> Void = { error in
                    let message = error.toString() ?? "Error could not be parsed."
                    continuation.resume(throwing: MessengerError.promiseRejected(error: message))
                }
                let jsReject = JSValue(object: onReject, in: context)
                _ = promise.invokeMethodSafely("then", withArguments: [jsResolve as Any])
                _ = promise.invokeMethodSafely("catch", withArguments: [jsReject as Any])
        }
        try await withCheckedThrowingContinuation(checkedContinuation)
    }

    /// Destroy the messenger. 
    /// This should be called when the messenger is de-inited to properly inform other messengers that it is gone.
    public func destroy() {
        _ = jsMessengerActor.messenger.invokeMethodSafely("destroy")
    }
}

// MARK: - Error Types

/// The different types of errors that can occur when using the Messenger
public enum MessengerError: Error, LocalizedError {
    /// Failed to initialize the JavaScript Messenger instance
    case failedToConvertOptionsToJSValue

    case didNotReceiveJSPromise(method: String)

    case couldNotFindJSContext(variable: String)

    case promiseRejected(error: String)

    /// A localized description of the error
    public var errorDescription: String? {
        switch self {
        case .failedToConvertOptionsToJSValue:
            return "[JS SAFETY] Failed to convert Swift native options to JS options"
        case .didNotReceiveJSPromise(let method):
            return "[JS SAFETY] Failed to send message: JS messenger's '\(method)' function did not return a Promise"
        case .couldNotFindJSContext(let variable):
            return "[JS SAFETY] Failed to send message: '\(variable)' property does not have a valid JSContext associated with it"
        case .promiseRejected(let error):
            return "[JS SAFETY] Failed to send message: promise rejected with error='\(error)'"
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
