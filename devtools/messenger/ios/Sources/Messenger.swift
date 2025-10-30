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
public class Messenger<Message: BaseEvent> {
    /// A thread-safe way to access the JS Messenger
    private let jsMessengerActor: JSMessengerActor

    /// Initialize a new Messenger instance
    /// - Parameter options: The options to use for this instance
    /// - Throws: MessengerError if initialization fails
    public init(options: MessengerOptions<Message>) throws {
        // We can pull the jsContext from the MessengerOptions. This is helpful
        // because the options and Messenger need to have the same context
        guard let jsOptions = options.asJSValue, let context = jsOptions.context else {
            throw MessengerError.failedToConvertOptionsToJSValue
        }

        // If the debug flag is set, we will log debug messages. Otherwise, we will not.
        let logger = options.isDebug ? options.logger : nil
        let jsMessenger = try context.construct(
            className: "Messenger",
            inBundle: Bundle.module,
            withArguments: [jsOptions],
            withPolyfill: { $0.setupMessengerPolyfill(logger: logger) }
        )
        self.jsMessengerActor = JSMessengerActor(jsMessenger)
    }

    /// Send a message through the messenger.
    ///
    /// - Parameter message: The message to send
    public func sendMessage(_ message: Message) async throws {
        let messageData = try JSONEncoder().encode(message)
        let messageString = String(data: messageData, encoding: .utf8) ?? "{}"
        try await send(message: messageString)
    }

    /// Send a message as a JSON string
    ///
    /// - Parameter messageString: The message
    public func sendMessage(_ messageString: String) async throws {
        try await send(message: messageString)
    }

    /// Helper to actually send the message.
    private func send(message: String) async throws {
        guard let promise = await jsMessengerActor.messenger.invokeMethod("sendMessage", withArguments: [message]),
              !promise.isUndefined
        else {
            throw MessengerError.didNotReceiveJSPromise
        }

        // This is a wrapper that allows us to wait for the then/catch callbacks from the JS Promise
        try await withCheckedThrowingContinuation { continuation in
            let onResolve: @convention(block) () -> Void = { continuation.resume() }
            promise.invokeMethod("then", withArguments: [onResolve])
        }
    }

    /// Destroy the messenger instance and clean up resources.
    /// If this is not done, the interval will continue to send out beacons for this Messenger even when it doesn't exist anymore.
    /// This is the equivalent to the manual `destroy()` on the JS layer.
    deinit {
        Task { [jsMessengerActor] in
            await jsMessengerActor.messenger.invokeMethod("destroy", withArguments: [])
        }
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

extension JSContext {
    /**
     Sets up polyfills for JavaScript APIs required by the Messenger implementation.

     Provides setInterval, clearInterval, and console.log implementations for the JS Messenger
     used by the Swift wrapper, which will not have access to the browser APIs.
     (I.e. this is a polyfill for the JS Messenger.)

     This method must be called before initializing any Messenger instances in this context.
     The polyfills enable:
     - `setInterval`: Registers repeating timers for periodic tasks (e.g., beacon messages)
     - `clearInterval`: Cancels active timers
     - `console.log`: Provides debug logging output
     */
    func setupMessengerPolyfill(logger: MessengerLogger?) {
        // A polyfill for console.log. This leverages the logger from the MessengerOptions
        let console: @convention(block) (JSValue?) -> Void = { (args) in
            if let args = args?.toArray() {
                logger?.log("Swift DevTools:", args)
            }
        }

        guard let jsSetInterval = JSValue(object: setInterval, in: self),
              let jsClearInterval = JSValue(object: clearInterval, in: self),
              let jsConsole = JSValue(object: console, in: self)
        else { return }
        setObject(jsSetInterval, forKeyedSubscript: "setInterval" as NSString)
        setObject(jsClearInterval, forKeyedSubscript: "clearInterval" as NSString)
        setObject(jsConsole, forKeyedSubscript: "console" as NSString)
    }

    /// Registers a repeating job that happens every `delay` milliseconds .This is a Swift-native polyfill for JS's `setInterval`.
    private var setInterval: @convention(block) (JSValue?, JSValue?) -> JSValue? {
        { (callback, delay) in
            guard let callback, let delayInt32 = delay?.toInt32() else { return nil }

            let semaphore = DispatchSemaphore(value: 0)
            var timerId: Int = 0
            Task {
                // Use defer to ensure the thread is freed even if the Task is cancelled or fails
                defer { semaphore.signal() }
                timerId = await SharedMessengerLayer.asyncIntervalManager
                    .createTimer(callback: callback, delay: Int(delayInt32))
            }
            semaphore.wait()

            return JSValue(int32: Int32(timerId), in: self)
        }
    }

    /// Cancels the repeating job. This is a Swift-native polyfill for JS's `clearInterval`.
    private var clearInterval: @convention(block) (JSValue?) -> Void {
        { timerId in
            guard let timerId = timerId?.toInt32() else { return }
            Task { await SharedMessengerLayer.asyncIntervalManager.cancelTimer(id: Int(timerId)) }
        }
    }
}

/// A wrapper for the JSValue needed by the Messenger. The compiler will enforce thread-safety for actors.
actor JSMessengerActor {
    let messenger: JSValue

    init(_ messenger: JSValue) {
        self.messenger = messenger
    }
}
