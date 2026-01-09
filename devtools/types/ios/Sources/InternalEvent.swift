//
// InternalEvent.swift
// Created by Koriann South - October 8, 2025

/// Any event required for the Messengers to function.
/// "Event" in this case is a fancy word for "message"
public struct InternalEvent<Payload: Equatable>: BaseEvent {
    public var type: String
    public var target: String?
    public var payload: Payload?

    public init(
        type: InternalEventType,
        target: String?,
        payload: Payload? = nil
    ) {
        self.type = type.rawValue
        self.target = target
        self.payload = payload
    }
}

public enum InternalEventType: String, RawRepresentable {
    /// A message from a Messenger letting other Messengers know it exists.
    /// Each Messenger will send out this event on a consistent schedule.
    case beacon = "MESSENGER_BEACON"
    /// A message from a Messenger to let other Messengers know it is disconnecting.
    case disconnect = "MESSENGER_DISCONNECT"
    /// Request events this Messenger might have missed from other Messengers
    case requestLostEvents = "MESSENGER_REQUEST_LOST_EVENTS"
    /// Allows multiple events to be sent at once
    case eventsBatch = "MESSENGER_EVENT_BATCH"

    case devtoolsPluginInteraction = "PLAYER_DEVTOOLS_PLUGIN_INTERACTION"
}
