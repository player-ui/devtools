//
// BaseEvent.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation

/// Swift implementation of BaseEvent matching the TypeScript interface
/// Generic protocol representing a base event with type, payload, and optional target
public protocol BaseEvent: Codable {
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
    /* This is syntactic sugar to provide a nil-payload. If an Event
     should have no associated payload (just a type & target), this allows
     the user to avoid explicitly setting the payload to some random type. */
    public var payload: String? { nil }
}

enum BaseEventCodingKeys: CodingKey {
    case type
    case target
    case payload
}
