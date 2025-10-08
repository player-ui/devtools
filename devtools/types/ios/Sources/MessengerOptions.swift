//
// MessengerOptions.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import JavaScriptCore
import PlayerUI
import PlayerUIDevToolsUtils

/// Context for the messenger instance
public enum MessengerContext: String, Codable, CaseIterable {
    case player = "player"
    case devtools = "devtools"
}

/// Logger protocol for handling log messages
public protocol MessengerLogger {
    func log(_ args: Any...)
}

/// Swift implementation of MessengerOptions matching the TypeScript interface
public class MessengerOptions<Message: BaseEvent> {
    /// API to send messages
    public let sendMessage: (Message) async throws -> Void
    
    /// API to add a listener
    public let addListener: (@escaping (MessengerTransaction<Message>) -> Void) -> Void
    
    /// API to remove a listener
    public let removeListener: (@escaping (MessengerTransaction<Message>) -> Void) -> Void
    
    /// Callback to handle messages
    public let messageCallback: (MessengerTransaction<Message>) -> Void
    
    /// Context (player or devtools)
    public let context: MessengerContext
    
    /// Unique id (required)
    public let id: String
    
    /// Time between beacons in milliseconds (defaults to 1000)
    public let beaconIntervalMS: Int
    
    /// Debug mode (defaults to false)
    public let debug: Bool
    
    /// Handle failed message (optional)
    public let handleFailedMessage: ((MessengerTransaction<Message>) -> Void)?
    
    /// Logger for handling log messages
    public let logger: MessengerLogger
    
    /// Initialize MessengerOptions
    /// - Parameters:
    ///   - sendMessage: Function to send messages
    ///   - addListener: Function to add message listeners
    ///   - removeListener: Function to remove message listeners
    ///   - messageCallback: Callback to handle incoming messages
    ///   - context: Messenger context (player or devtools)
    ///   - id: Required unique identifier
    ///   - beaconIntervalMS: Required beacon interval in milliseconds
    ///   - debug: Optional debug mode flag
    ///   - handleFailedMessage: Optional failed message handler
    ///   - logger: Logger instance for handling log output
    public init(
        sendMessage: @escaping (Message) async throws -> Void,
        addListener: @escaping (@escaping (MessengerTransaction<Message>) -> Void) -> Void,
        removeListener: @escaping (@escaping (MessengerTransaction<Message>) -> Void) -> Void,
        messageCallback: @escaping (MessengerTransaction<Message>) -> Void,
        context: MessengerContext,
        id: String,
        beaconIntervalMS: Int = 1000,
        debug: Bool = false,
        handleFailedMessage: ((MessengerTransaction<Message>) -> Void)? = nil,
        logger: MessengerLogger
    ) {
        self.sendMessage = sendMessage
        self.addListener = addListener
        self.removeListener = removeListener
        self.messageCallback = messageCallback
        self.context = context
        self.id = id
        self.beaconIntervalMS = beaconIntervalMS
        self.debug = debug
        self.handleFailedMessage = handleFailedMessage
        self.logger = logger
    }
    
    /// Generic helper to decode JSValue to Swift object
    private func decodeJSValue<T: Codable>(_ jsValue: JSValue) -> T? {
        // Try to get JSON representation of the object
        guard let context = jsValue.context else {
            return nil
        }
        
        // Use JSON.stringify to properly serialize the object
        guard let jsonStringify = context.objectForKeyedSubscript("JSON")?.objectForKeyedSubscript("stringify"),
              let jsonString = jsonStringify.call(withArguments: [jsValue])?.toString(),
              let jsonData = jsonString.data(using: .utf8) else {
            return nil
        }
        
        do {
            return try JSONDecoder().decode(T.self, from: jsonData)
        } catch {
            logger.log("Failed to decode \(T.self):", error)
            return nil
        }
    }
    
    /// Generic helper to encode Swift object to JSON string
    private func encodeToJSONString<T: Codable>(_ object: T) -> String? {
        do {
            let data = try JSONEncoder().encode(object)
            return String(data: data, encoding: .utf8)
        } catch {
            logger.log("Failed to encode \(T.self):", error)
            return nil
        }
    }
}

public struct MessengerTransaction<Message: BaseEvent>: Codable { // "Transaction" is already taken in Swift
    public let message: Message
    public let metaData: TransactionMetaData
    
    public init(message: Message, metaData: TransactionMetaData) {
        self.message = message
        self.metaData = metaData
    }
    
    public func encode(to encoder: any Encoder) throws {
        // For the message
        var eventContainer = encoder.container(keyedBy: BaseEventCodingKeys.self)
        try eventContainer.encode(self.message.type, forKey: .type)
        try eventContainer.encode(self.message.target, forKey: .target)
        try eventContainer.encode(self.message.payload, forKey: .payload)
        
        // For the metaData
        var metaDataContainer = encoder.container(keyedBy: TransactionMetaData.CodingKeys.self)
        try metaDataContainer.encode(self.metaData.id, forKey: .id)
        try metaDataContainer.encode(self.metaData.timestamp, forKey: .timestamp)
        try metaDataContainer.encode(self.metaData.sender, forKey: .sender)
        try metaDataContainer.encode(self.metaData.context, forKey: .context)
        try metaDataContainer.encode(self.metaData.isMessenger, forKey: .isMessenger)
    }
    
    public init(from decoder: any Decoder) throws {
        self.message = try Message(from: decoder)
        self.metaData = try TransactionMetaData(from: decoder)
    }
}

public protocol InternalEvent: BaseEvent {}

public struct BeaconEvent: InternalEvent {
    public var type = "MESSENGER_BEACON"
    public var target: String?
}

public struct DisconnectEvent: InternalEvent {
    public var type = "MESSENGER_DISCONNECT"
    public var target: String?
}

public struct RequestLostEventsEvent: InternalEvent {
    public var type = "MESSENGER_REQUEST_LOST_EVENTS"
    public var target: String?
    public var payload: PayloadType?
    
    public struct PayloadType: Codable {
        public let messagesReceived: Int
    }
}

public struct EventsBatchEvent<Message: InternalEvent>: InternalEvent {
    public var type = "MESSENGER_EVENT_BATCH"
    public var target: String?
    public var payload: PayloadType?
    
    public struct PayloadType: Codable {
        public let events: [MessengerTransaction<Message>]
    }
}

public extension MessengerOptions {
    // TODO: clean up
    func asJSValue(in context: JSContext) throws -> JSValue? {
        var jsOptions: [String: Any] = [
            "context": self.context.rawValue,
            "id": id,
            "beaconIntervalMS": beaconIntervalMS,
            "debug": debug
        ]
        
        // Create sendMessage callback with @convention(block) and wrap in JSValue
        // This needs to return a Promise since the JS code calls .catch() on the result
        let sendMessageCallback: @convention(block) (JSValue) -> JSValue? = { message in
            return JSUtilities.createPromise(context: context) { resolve, reject in
                Task {
                    do {
                        guard let decodedMessage: Message = self.decodeJSValue(message) else { 
                            reject("Failed to decode message")
                            return 
                        }
                        try await self.sendMessage(decodedMessage)
                        resolve()
                    } catch {
                        self.logger.log("Failed to send message:", error)
                        reject(error.localizedDescription)
                    }
                }
            }
        }
        jsOptions["sendMessage"] = JSValue(object: sendMessageCallback, in: context)
        
        // Create messageCallback with @convention(block) and wrap in JSValue
        let messageCallbackJS: @convention(block) (JSValue) -> Void = { transaction in
            guard let decodedTransaction: MessengerTransaction<Message> = self.decodeJSValue(transaction) else { return }
            self.messageCallback(decodedTransaction)
        }
        jsOptions["messageCallback"] = JSValue(object: messageCallbackJS, in: context)
        
        // Create addListener callback with @convention(block) and wrap in JSValue
        let addListenerJS: @convention(block) (JSValue) -> Void = { callback in
            self.addListener { transaction in
                guard let encodedString = self.encodeToJSONString(transaction) else { return }
                callback.call(withArguments: [encodedString])
            }
        }
        jsOptions["addListener"] = JSValue(object: addListenerJS, in: context)
        
        // Create removeListener callback with @convention(block) and wrap in JSValue
        let removeListenerJS: @convention(block) (JSValue) -> Void = { callback in
            self.removeListener { transaction in
                guard let encodedString = self.encodeToJSONString(transaction) else { return }
                callback.call(withArguments: [encodedString])
            }
        }
        jsOptions["removeListener"] = JSValue(object: removeListenerJS, in: context)
        
        // Create logger object with @convention(block) functions
        let logFunction: @convention(block) () -> Void = {
            // For now, just log a simple message - we can enhance this later
            self.logger.log("Log called from JavaScript")
        }
        jsOptions["logger"] = ["log": JSValue(object: logFunction, in: context)]
        
        // Add handleFailedMessage if present
        if let handleFailedMessage = handleFailedMessage {
            let handleFailedMessageJS: @convention(block) (JSValue) -> Void = { transaction in
                guard let decodedTransaction: MessengerTransaction<Message> = self.decodeJSValue(transaction) else { return }
                handleFailedMessage(decodedTransaction)
            }
            jsOptions["handleFailedMessage"] = JSValue(object: handleFailedMessageJS, in: context)
        }
        
        return JSValue(object: jsOptions, in: context)
    }
}
