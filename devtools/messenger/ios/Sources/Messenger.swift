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
        // Create a shared JSContext for both the options and the messenger
        let sharedContext = JSContext()!
        
        guard let jsOptions = try options.asJSValue(in: sharedContext) else {
            throw MessengerError.initializationFailed
        }
        
        self.jsMessenger = try JSValue.construct(
            className: "Messenger",
            fromFile: "Messenger.native",
            inBundle: Bundle.module,
            withArguments: [jsOptions],
            inContext: sharedContext,
            withPolyfill: { sharedContext.setupMessengerPolyfill() }
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

extension JSContext {
    /**
     Provides setInterval, clearInterval, and console.log implementations for the JS Messenger
     used by the Swift wrapper, which will not have access to the browser APIs.
     (I.e. this is a polyfill for the JS Messenger.)
     */
    func setupMessengerPolyfill() {
        // Store timers in a class-level dictionary to avoid JSValue storage issues
        let timerStorage = TimerStorage.shared
        
        // setInterval in JS registers a repeating job that happens every x milliseconds.
        let setInterval: @convention(block) (JSValue?, JSValue?) -> JSValue? = { (callback, delay) in
            guard let callback = callback,
                  let delay = delay?.toInt32() else { return nil }
            
            let timerId = timerStorage.createTimer(callback: callback, delay: Int(delay))
            return JSValue(int32: Int32(timerId), in: self)
        }

        // clearInterval in JS cancels the repeating job.
        let clearInterval: @convention(block) (JSValue?) -> Void = { timerId in
            guard let timerId = timerId?.toInt32() else { return }
            timerStorage.cancelTimer(id: Int(timerId))
        }
        
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

// Separate timer storage class to avoid JSValue memory management issues
private class TimerStorage {
    static let shared = TimerStorage()
    
    private var timers: [Int: DispatchSourceTimer] = [:]
    private var callbacks: [Int: JSValue] = [:]
    private var timerCounter = 0
    private let queue = DispatchQueue(label: "timer-storage", attributes: .concurrent)

    private init() {}
    
    func createTimer(callback: JSValue, delay: Int) -> Int {
        return queue.sync(flags: .barrier) {
            timerCounter += 1
            let timerId = timerCounter

            // Store the callback strongly to prevent deallocation
            callbacks[timerId] = callback
            
            let timer = DispatchSource.makeTimerSource(queue: .global(qos: .background))
            timer.schedule(deadline: .now(), repeating: .milliseconds(delay))
            timer.setEventHandler { [weak self] in
                // Ensure we're on the main queue for JSValue operations
                DispatchQueue.main.async {
                    self?.queue.sync {
                        if let storedCallback = self?.callbacks[timerId] {
                            storedCallback.call(withArguments: [])
                        }
                    }
                }
            }
            timer.resume()
            
            timers[timerId] = timer
            return timerId
        }
    }
    
    func cancelTimer(id: Int) {
        queue.sync(flags: .barrier) {
            if let timer = timers[id] {
                timer.cancel()
                timers.removeValue(forKey: id)
                callbacks.removeValue(forKey: id)
            }
        }
    }
    
    deinit {
        queue.sync(flags: .barrier) {
            for timer in timers.values {
                timer.cancel()
            }
            timers.removeAll()
            callbacks.removeAll()
        }
    }
}
