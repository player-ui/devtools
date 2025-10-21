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
///
/// ## ⚠️ Note
/// All instances of Messenger will share the same JSContext
public class Messenger<Message: BaseEvent> {
    // A thread-safe way to access the Messenger
    private let jsMessengerActor: JSMessengerActor

    /// Initialize a new Messenger instance
    /// - Parameter options: Configuration options for the messenger
    /// - Throws: MessengerError if initialization fails
    public init(options: MessengerOptions<Message>) throws {
        guard let jsOptions = options.asJSValue else {
            throw MessengerError.initializationFailed
        }
        
        let jsMessenger = try JSValue.construct(
            className: "Messenger",
            inBundle: Bundle.module,
            withArguments: [jsOptions],
            inContext: SharedMessengerLayer.context,
            withPolyfill: { SharedMessengerLayer.context.setupMessengerPolyfill() }
        )

        self.jsMessengerActor = JSMessengerActor(jsMessenger)
    }
    
    /// Send a message through the messenger
    /// - Parameter message: The message to send
    public func sendMessage(_ message: Message) { // TODO: decide if we should leave the Task part up to the consumer and make these async
        do {
            let messageData = try JSONEncoder().encode(message)
            let messageString = String(data: messageData, encoding: .utf8) ?? "{}"

            Task {
                await jsMessengerActor.messenger.invokeMethod("sendMessage", withArguments: [messageString])
            }
        } catch {
            // TODO: log this instead?
            print("Failed to encode message: \(error)")
        }
    }
    
    /// Send a message as a JSON string
    /// - Parameter messageString: The message as a JSON string
    public func sendMessage(_ messageString: String) {
        Task {
            await jsMessengerActor.messenger.invokeMethod("sendMessage", withArguments: [messageString])
        }
    }
    
    /// Destroy the messenger instance and clean up resources. This MUST be called manually before the Messenger is de-init.
    /// If it is not called, other Messengers will continue to expect messages from this Messenger.
    ///
    /// ⚠️ We can't run this in Swift's deinit because deinit does not support asynchronous code.
    public func destroy() {
        Task {
            await jsMessengerActor.messenger.invokeMethod("destroy", withArguments: [])
        }
    }
}

// MARK: - Error Types

/// The different types of errors that can occur when using the Messenger
public enum MessengerError: Error, LocalizedError {
    /// Failed to initialize the JavaScript Messenger instance
    case initializationFailed
    
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
    func setupMessengerPolyfill() {
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

        // TODO: log via plugin instead?
        // Add console.log polyfill
        let console: @convention(block) (JSValue?) -> Void = { (args) in
            if let args = args?.toArray() {
                print("Swift DevTools, Debug mode:", args)
            }
        }
        
        guard let jsSetInterval = JSValue(object: setInterval, in: self) else { return }
        setObject(jsSetInterval, forKeyedSubscript: "setInterval" as NSString)
        guard let jsClearInterval = JSValue(object: clearInterval, in: self) else { return }
        setObject(jsClearInterval, forKeyedSubscript: "clearInterval" as NSString)
        guard let jsConsole = JSValue(object: console, in: self) else { return }
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
