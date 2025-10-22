//
// InternalEvent.swift
// Created by Koriann South - October 8, 2025

/// Any event required for the Messengers to function.
/// "Event" in this case is a fancy word for "message"
public protocol InternalEvent: BaseEvent {}

/// A message from a Messenger letting other Messengers know it exists.
/// Each Messenger will send out this event on a consistent schedule.
public struct BeaconEvent: InternalEvent {
    public var type = "MESSENGER_BEACON"
    public var target: String?
}

/// A message from a Messenger to let other Messengers know it is disconnecting.
public struct DisconnectEvent: InternalEvent {
    public var type = "MESSENGER_DISCONNECT"
    public var target: String?
}

/// Request events this Messenger might have missed from other Messengers
public struct RequestLostEventsEvent: InternalEvent {
    public var type = "MESSENGER_REQUEST_LOST_EVENTS"
    public var target: String?
    public var payload: PayloadType?
    
    public struct PayloadType: Codable {
        public let messagesReceived: Int
    }
}

/// Allows multiple events to be sent at once
public struct EventsBatchEvent<Message: InternalEvent>: InternalEvent {
    public var type = "MESSENGER_EVENT_BATCH"
    public var target: String?
    public var payload: PayloadType?
    
    public struct PayloadType: Codable {
        public let events: [MessengerTransaction<Message>]
    }
}
