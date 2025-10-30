//
// MessengerTransaction.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation

/// A message with metaData attached to it. The metaData is added to all messages automatically by the `Messenger`.
public struct MessengerTransaction<Message: BaseEvent>: Codable, Equatable { // "Transaction" is already taken in Swift
    /// The message itself
    public let message: Message
    /// MetaData, including the message ID, timestamp, etc.
    public let metaData: TransactionMetaData

    /// Create a MessageTransaction
    /// - Parameters:
    ///   - message: The message itself
    ///   - metaData: MetaData, including the message ID, timestamp, etc.
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

/// Swift implementation of TransactionMetadata matching the TypeScript interface
/// Contains metadata about a messenger transaction
public struct TransactionMetaData: Codable, Equatable {
    /// Unique ID
    public let id: Int
    
    /// Timestamp
    public let timestamp: Int
    
    /// Sender ID
    public let sender: String
    
    /// Context (player or devtools)
    public let context: MessengerContext
    
    /// Messenger tag
    let isMessenger: Bool
    
    /// Initialize TransactionMetadata
    /// - Parameters:
    ///   - id: Unique identifier for the transaction
    ///   - timestamp: Timestamp when the transaction was created
    ///   - sender: ID of the sender
    ///   - context: Transaction context (player or devtools)
    ///   - isMessenger: Flag indicating this is a messenger transaction
    public init(
        id: Int,
        timestamp: Int,
        sender: String,
        context: MessengerContext,
        isMessenger: Bool = true
    ) {
        self.id = id
        self.timestamp = timestamp
        self.sender = sender
        self.context = context
        self.isMessenger = isMessenger
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case timestamp
        case sender
        case context
        case isMessenger = "_messenger_"
    }
}
