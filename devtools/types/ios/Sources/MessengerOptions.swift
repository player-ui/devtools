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
///
/// ## ⚠️ Note
/// All instances of MessengerOptions will share the same JSContext
public class MessengerOptions<Message: BaseEvent> {
    /// Unique id (required)
    public let id: String

    /// Context (player or devtools)
    public let context: MessengerContext

    /// Logger for handling log messages
    public let logger: MessengerLogger

    /// Time between beacons in milliseconds (defaults to 1000)
    public let beaconIntervalMS: Int

    /// Debug mode (defaults to false)
    public let debug: Bool

    /// API to send messages
    public let sendMessage: (Message) async throws -> Void
    
    /// API to add a listener
    public let addListener: (@escaping (MessengerTransaction<Message>) -> Void) -> Void
    
    /// API to remove a listener
    public let removeListener: (@escaping (MessengerTransaction<Message>) -> Void) -> Void
    
    /// Callback to handle messages
    public let messageCallback: (MessengerTransaction<Message>) -> Void

    /// Handle failed message (optional)
    public let handleFailedMessage: ((MessengerTransaction<Message>) -> Void)?
    
    /// Initialize MessengerOptions
    /// - Parameters:
    ///   - id: Required unique identifier
    ///   - context: Messenger context (player or devtools)
    ///   - logger: Logger instance for handling log output
    ///   - beaconIntervalMS: Beacon interval in milliseconds (defaults to 1000). This is how often this Messenger will
    ///   send out a beacon to let other Messengers know it exists.
    ///   - debug: Debug mode flag (defaults to false)
    ///   - sendMessage: Function to send messages
    ///   - addListener: Function to add message listeners
    ///   - removeListener: Function to remove message listeners
    ///   - messageCallback: Callback to handle incoming messages
    ///   - handleFailedMessage: Optional failed message handler
    public init(
        id: String,
        context: MessengerContext,
        logger: MessengerLogger,
        beaconIntervalMS: Int = 1000,
        debug: Bool = false,
        sendMessage: @escaping (Message) async throws -> Void,
        addListener: @escaping (@escaping (MessengerTransaction<Message>) -> Void) -> Void,
        removeListener: @escaping (@escaping (MessengerTransaction<Message>) -> Void) -> Void,
        messageCallback: @escaping (MessengerTransaction<Message>) -> Void,
        handleFailedMessage: ((MessengerTransaction<Message>) -> Void)? = nil
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
}

// MARK: - JSValue Extensions

extension JSValue {
    /// Decode a JSValue into a Swift Codable type
    /// Uses JSON.stringify to convert the JavaScript value to JSON, then decodes it
    /// - Parameter withLogger: Optional logger for error reporting
    func decode<T: Codable>(withLogger logger: MessengerLogger? = nil) -> T? {
        guard let context = self.context else {
            return nil
        }
        
        // Use JSON.stringify to properly serialize the object
        guard let jsonStringify = context.objectForKeyedSubscript("JSON")?.objectForKeyedSubscript("stringify"),
              let jsonString = jsonStringify.call(withArguments: [self])?.toString(),
              let jsonData = jsonString.data(using: .utf8) else {
            return nil
        }
        
        do {
            return try JSONDecoder().decode(T.self, from: jsonData)
        } catch {
            logger?.log("Failed to decode \(T.self) from JSValue:", error)
            return nil
        }
    }
}

// MARK: - Codable Extensions

extension Encodable {
    /// Convert a Codable object to a JSON string
    /// - Parameter withLogger: Optional logger for error reporting
    func toJSONString(withLogger logger: MessengerLogger? = nil) -> String? {
        do {
            let data = try JSONEncoder().encode(self)
            return String(data: data, encoding: .utf8)
        } catch {
            logger?.log("Failed to encode \(type(of: self)) to JSON string:", error)
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

public extension MessengerOptions {
    /// Convert MessengerOptions to a JSValue for use in JavaScript context
    /// Uses the shared JSContext from SharedMessengerLayer
    var asJSValue: JSValue? {
        var jsOptions: [String: Any] = [
            "context": context.rawValue,
            "id": id,
            "beaconIntervalMS": beaconIntervalMS,
            "debug": debug,
            "sendMessage": sendMessageCallback as Any,
            "messageCallback": messageCallbackValue as Any,
            "addListener": addListenerCallback as Any,
            "removeListener": removeListenerCallback as Any,
            "logger": loggerValue
        ]

        if let failedMessageCallback {
            jsOptions["handleFailedMessage"] = failedMessageCallback
        }

        return JSValue(object: jsOptions, in: SharedMessengerLayer.context)
    }
    
    // MARK: - Callback Creators

    /// The sendMessage callback that returns a Promise
    private var sendMessageCallback: JSValue? {
        let context = SharedMessengerLayer.context
        let callback: @convention(block) (JSValue) -> JSValue? = { message in
            return JSUtilities.createPromise(context: context) { resolve, reject in
                Task {
                    do {
                        guard let decodedMessage: Message = message.decode(withLogger: self.logger) else {
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
        return JSValue(object: callback, in: context)
    }

    /// The messageCallback that handles incoming messages
    private var messageCallbackValue: JSValue? {
        let context = SharedMessengerLayer.context
        let callback: @convention(block) (JSValue) -> Void = { transaction in
            guard let decodedTransaction: MessengerTransaction<Message> = transaction.decode(withLogger: self.logger) else {
                return
            }
            self.messageCallback(decodedTransaction)
        }
        return JSValue(object: callback, in: context)
    }

    /// The addListener callback
    private var addListenerCallback: JSValue? {
        let context = SharedMessengerLayer.context
        let callback: @convention(block) (JSValue) -> Void = { jsCallback in
            self.addListener { transaction in
                guard let encodedString = transaction.toJSONString(withLogger: self.logger) else { return }
                jsCallback.call(withArguments: [encodedString])
            }
        }
        return JSValue(object: callback, in: context)
    }

    /// The removeListener callback
    private var removeListenerCallback: JSValue? {
        let context = SharedMessengerLayer.context
        let callback: @convention(block) (JSValue) -> Void = { jsCallback in
            self.removeListener { transaction in
                guard let encodedString = transaction.toJSONString(withLogger: self.logger) else { return }
                jsCallback.call(withArguments: [encodedString])
            }
        }
        return JSValue(object: callback, in: context)
    }

    /// The logger object with log function
    private var loggerValue: [String: JSValue?] {
        let context = SharedMessengerLayer.context
        let logFunction: @convention(block) () -> Void = {
            self.logger.log("Log called from JavaScript")
        }
        return ["log": JSValue(object: logFunction, in: context)]
    }

    /// The handleFailedMessage callback if needed
    private var failedMessageCallback: JSValue? {
        guard let handleFailedMessage else { return nil }

        let context = SharedMessengerLayer.context
        let callback: @convention(block) (JSValue) -> Void = { transaction in
            guard let decodedTransaction: MessengerTransaction<Message> = transaction.decode(withLogger: self.logger) else {
                return
            }
            handleFailedMessage(decodedTransaction)
        }
        return JSValue(object: callback, in: context)
    }
}
