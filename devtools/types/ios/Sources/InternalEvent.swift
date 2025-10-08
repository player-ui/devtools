//
// InternalEvent.swift
// Created by Koriann South - October 8, 2025


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