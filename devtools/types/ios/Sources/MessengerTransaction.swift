//
// MessengerTransaction.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation

/// A message with metaData attached to it. The metaData is added to all messages automatically by the `Messenger`.
public struct MessengerTransaction { // "Transaction" is already taken in Swift
    /// The message itself
    public let message: [String: Any]
    /// MetaData, including the message ID, timestamp, etc.
    public let metaData: TransactionMetaData

    /// Create a MessageTransaction
    /// - Parameters:
    ///   - message: The message itself
    ///   - metaData: MetaData, including the message ID, timestamp, etc.
    public init(message: [String: Any], metaData: TransactionMetaData) {
        self.message = message
        self.metaData = metaData
    }

    /// Combines the message and transaction metaData into a single dictionary
    /// that JS can parse into an object
    var jsCompatible: [String: Any] {
        metaData.jsCompatible
            // Keys should always be unique, but we must provide a uniquing fn
            .merging(message) { lhs, _ in lhs }
    }
}

/// Swift implementation of TransactionMetadata matching the TypeScript interface
/// Contains metadata about a messenger transaction
public struct TransactionMetaData: Equatable {
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

    var jsCompatible: [String: Any] {
        [
            "id": id,
            "timestamp": timestamp,
            "sender": sender,
            "context": context,
            "_messenger_": isMessenger
        ]
    }
}
