//
// MessengerOptions.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import JavaScriptCore

/// Context for the messenger instance
public enum MessengerContext: String, Codable, CaseIterable {
    case player = "player"
    case devtools = "devtools"
}

/// Logger protocol for handling log messages
public protocol MessengerLogger {
    func log(_ args: Any...)
}

/// Default console logger implementation
public struct ConsoleLogger: MessengerLogger {
    public init() {}
    
    public func log(_ args: Any...) {
        let message = args.map { "\($0)" }.joined(separator: " ")
        print(message)
    }
}

/// Swift implementation of MessengerOptions matching the TypeScript interface
public struct MessengerOptions<Message: BaseEvent> {
    /// API to send messages
    public let sendMessage: (InternalEvent) async throws -> Void

    /// API to add a listener
    public let addListener: (@escaping (MessengerTransaction<Message>) -> Void) -> Void

    /// API to remove a listener  
    public let removeListener: (@escaping (MessengerTransaction<Message>) -> Void) -> Void

    /// Callback to handle messages
    public let messageCallback: (MessengerTransaction<Message>) -> Void

    /// Context (player or devtools)
    public let context: MessengerContext
    
    /// Unique id (optional, will be generated if not provided)
    public let id: String?
    
    /// Time between beacons in milliseconds (defaults to 1000)
    public let beaconIntervalMS: Int?
    
    /// Debug mode (defaults to false)
    public let debug: Bool?
    
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
    ///   - id: Optional unique identifier
    ///   - beaconIntervalMS: Optional beacon interval in milliseconds
    ///   - debug: Optional debug mode flag
    ///   - handleFailedMessage: Optional failed message handler
    ///   - logger: Logger instance for handling log output
    public init(
        sendMessage: @escaping (Message) async throws -> Void,
        addListener: @escaping (@escaping (MessengerTransaction<Message>) -> Void) -> Void,
        removeListener: @escaping (@escaping (MessengerTransaction<Message>) -> Void) -> Void,
        messageCallback: @escaping (MessengerTransaction<Message>) -> Void,
        context: MessengerContext,
        id: String? = nil,
        beaconIntervalMS: Int? = nil,
        debug: Bool? = nil,
        handleFailedMessage: ((MessengerTransaction<Message>) -> Void)? = nil,
        logger: MessengerLogger = ConsoleLogger()
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

public struct MessengerTransaction<Message: BaseEvent>: Codable { // "Transaction" is already taken in Swift
    public let message: Message
    public let metaData: TransactionMetaData

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

struct BeaconEvent: InternalEvent {
    var type = "MESSENGER_BEACON"
    var target: String?
}

struct DisconnectEvent: InternalEvent {
    var type = "MESSENGER_DISCONNECT"
    var target: String?
}

struct RequestLostEventsEvent: InternalEvent {
    var type = "MESSENGER_REQUEST_LOST_EVENTS"
    var target: String?
}

struct EventsBatchEvent<Message: InternalEvent>: InternalEvent {
    var type = "MESSENGER_EVENT_BATCH"
    var target: String?
    let events: [MessengerTransaction<Message>]
}
