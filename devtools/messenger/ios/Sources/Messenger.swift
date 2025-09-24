//
// Messenger.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import PlayerUI
import JavaScriptCore
import PlayerUIDevToolsTypes

/// Swift wrapper for the JavaScript Messenger implementation
/// Provides a native Swift API while delegating to the JS implementation
public class Messenger<Message: BaseEvent> {
    private let jsContext: JSContext?
    private let jsMessenger: JSValue
    
    /// Initialize a new Messenger instance
    /// - Parameter options: Configuration options for the messenger
    /// - Throws: MessengerError if initialization fails
    public init(options: MessengerOptions<Message>) throws {
        // Load the context
        let context = JSContext()
        guard let url = ResourceUtilities.urlForFile(name: "Messenger.native", ext: "js", bundle: Bundle.module),
              let jsString = try? String(contentsOf: url, encoding: String.Encoding.utf8) else {
            throw MessengerError.jsSourceNotFound
        }
        self.jsContext = context
        
        // Create the options object for JavaScript
        let jsOptions = Self.createJSOptions(from: options, context: context)
        // The JavaScript file returns an object with exports, get Messenger from there
        guard let result = context?.evaluateScript(jsString),
              let messengerClass = result.objectForKeyedSubscript("Messenger"),
              let messenger = messengerClass.construct(withArguments: [jsOptions]) else {
            throw MessengerError.initializationFailed
        }
        self.jsMessenger = messenger
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
        guard let messengerClass = jsContext?.objectForKeyedSubscript("Messenger") else {
            print("Warning: Messenger class not found in JavaScript context")
            return
        }
        
        messengerClass.invokeMethod("reset", withArguments: [])
    }
}

private extension Messenger {
    // Create the options to pass down to the JavaScript Messenger
    static func createJSOptions(from options: MessengerOptions<Message>, context: JSContext?) -> [String: Any] {
        var jsOptions: [String: Any] = [
            "context": options.context.rawValue,
            "id": options.id,
            "beaconIntervalMS": options.beaconIntervalMS,
            "debug": options.debug
        ]
        
        // Create JavaScript functions that bridge to Swift closures
        jsOptions["sendMessage"] = Self.createSendMessageCallback(options.sendMessage, context: context)
        jsOptions["messageCallback"] = Self.createTransactionCallback(options.messageCallback, context: context)
        jsOptions["addListener"] = Self.createListenerCallback(options.addListener, context: context)
        jsOptions["removeListener"] = Self.createListenerCallback(options.removeListener, context: context)
        
        if let handleFailedMessage = options.handleFailedMessage {
            jsOptions["handleFailedMessage"] = Self.createTransactionCallback(handleFailedMessage, context: context)
        }
        
        jsOptions["logger"] = Self.createLoggerObject(options.logger, context: context)
        
        return jsOptions
    }
    
    /// Helper to create a callback for sending messages
    private static func createSendMessageCallback<T: BaseEvent>(_ sendMessage: @escaping (T) async throws -> Void, context: JSContext?) -> JSValue? {
        return JSValue(object: { (message: JSValue) in
            Task {
                do {
                    guard let decodedMessage: T = Self.decodeJSValue(message) else { return }
                    try await sendMessage(decodedMessage)
                } catch {
                    print("Failed to send message: \(error)")
                }
            }
        }, in: context)
    }
    
    /// Helper to create a callback for transaction handling
    private static func createTransactionCallback<T: BaseEvent>(_ callback: @escaping (MessengerTransaction<T>) -> Void, context: JSContext?) -> JSValue? {
        return JSValue(object: { (transaction: JSValue) in
            guard let decodedTransaction: MessengerTransaction<T> = Self.decodeJSValue(transaction) else { return }
            callback(decodedTransaction)
        }, in: context)
    }
    
    /// Helper to create listener callbacks that encode transactions to JSON
    private static func createListenerCallback<T: BaseEvent>(_ listenerMethod: @escaping (@escaping (MessengerTransaction<T>) -> Void) -> Void, context: JSContext?) -> JSValue? {
        return JSValue(object: { (callback: JSValue) in
            listenerMethod { transaction in
                guard let encodedString = Self.encodeToJSONString(transaction) else { return }
                callback.call(withArguments: [encodedString])
            }
        }, in: context)
    }
    
    /// Helper to create the logger object
    private static func createLoggerObject(_ logger: MessengerLogger, context: JSContext?) -> [String: JSValue?] {
        return [
            "log": JSValue(object: { (args: [JSValue]) in
                let logArgs = args.compactMap { $0.toString() }
                logger.log(logArgs)
            }, in: context)
        ]
    }
    
    /// Generic helper to decode JSValue to Swift object
    private static func decodeJSValue<T: Codable>(_ jsValue: JSValue) -> T? {
        guard let jsonString = jsValue.toString(),
              let jsonData = jsonString.data(using: .utf8) else {
            print("Failed to convert JSValue to string")
            return nil
        }
        
        do {
            return try JSONDecoder().decode(T.self, from: jsonData)
        } catch {
            print("Failed to decode \(T.self): \(error)")
            return nil
        }
    }
    
    /// Generic helper to encode Swift object to JSON string
    private static func encodeToJSONString<T: Codable>(_ object: T) -> String? {
        do {
            let data = try JSONEncoder().encode(object)
            return String(data: data, encoding: .utf8)
        } catch {
            print("Failed to encode \(T.self): \(error)")
            return nil
        }
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
