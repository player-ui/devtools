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
    /// A mechanism to log any debug messages on the Swift layer. If nil, no logging will be performed.
    private let logger: MessengerLogger?

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
        self.logger = logger
    }

    /// Send a message through the messenger
    /// - Parameter message: The message to send
    public func sendMessage(_ message: Message) {
        do {
            let messageData = try JSONEncoder().encode(message)
            let messageString = String(data: messageData, encoding: .utf8) ?? "{}"

            Task {
                await jsMessengerActor.messenger.invokeMethod("sendMessage", withArguments: [messageString])
            }
        } catch {
            logger?.log("Failed to encode message: \(error)")
        }
    }

    /// Send a message as a JSON string
    /// - Parameter messageString: The message as a JSON string
    public func sendMessage(_ messageString: String) {
        Task {
            await jsMessengerActor.messenger.invokeMethod("sendMessage", withArguments: [messageString])
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

    /// A localized description of the error
    public var errorDescription: String? {
        return "JavaScript Messenger source file not found"
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
        let intervalManager = SharedMessengerLayer.syncIntervalManager

        // setInterval in JS registers a repeating job that happens every x milliseconds.
        // This callback MUST be synchronous. We can't pass async functions to the JS layer
        let setInterval: @convention(block) (JSValue?, JSValue?) -> JSValue? = { (callback, delay) in
            guard let callback = callback,
                  let delay = delay?.toInt32() else { return nil }
            let timerId = intervalManager.createTimer(callback: callback, delay: Int(delay))
            return JSValue(int32: Int32(timerId), in: self)
        }

        // clearInterval in JS cancels the repeating job.
        // This callback MUST be synchronous. We can't pass async functions to the JS layer
        let clearInterval: @convention(block) (JSValue?) -> Void = { timerId in
            guard let timerId = timerId?.toInt32() else { return }
            intervalManager.cancelTimer(id: Int(timerId))
        }

        // Add console.log polyfill
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
}

/// A wrapper for the JSValue needed by the Messenger. The compiler will enforce thread-safety for actors.
actor JSMessengerActor {
    let messenger: JSValue

    init(_ messenger: JSValue) {
        self.messenger = messenger
    }
}
