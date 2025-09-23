//
// TransactionMetadata.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation

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
