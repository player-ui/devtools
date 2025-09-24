//
// BaseEvent.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation

/// Swift implementation of BaseEvent matching the TypeScript interface
/// Generic protocol representing a base event with type, payload, and optional target
public protocol BaseEvent: Codable {
    // /// The string representation of the event type. This will be included in the message sent to the Messenger.
    // associatedtype EventType: RawRepresentable where EventType.RawValue == String

    /// The payload type for this event
    associatedtype Payload: Codable
    
    /// The string representation of the event type. This will be included in the message sent to the Messenger.
    var type: String { get }
    
    /// Event payload
    var payload: Payload? { get }

    /// Target ID
    var target: String? { get }
}

extension BaseEvent {
    public var payload: String? { nil }
}

enum BaseEventCodingKeys: CodingKey {
    case type
    case target
    case payload
}
