package com.intuit.playerui.devtools

import com.intuit.playerui.core.bridge.Node
import com.intuit.playerui.core.bridge.NodeWrapper
import com.intuit.playerui.core.bridge.serialization.serializers.NodeSerializableField
import com.intuit.playerui.core.bridge.serialization.serializers.NodeWrapperSerializer
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

// TODO: Likely should go to types for generic and basic for plugin-specific (if any)
public interface TransactionMetaData {
    public val id: Long
    public val timestamp: Long
    public val sender: String
    public val context: JsonElement // TODO: Why the hell isn't this a string
    @SerialName("_messenger_")
    public val tag: Boolean

    @Serializable
    public enum class Context {
        @SerialName("player") PLAYER,
        @SerialName("devtools") DEVTOOLS
    }
}

// This is effectively both Transaction and MessengerEvent
@Serializable public sealed class Event : TransactionMetaData {
    public abstract val type: String
}

@Serializable public sealed class EventWithPayload<Payload> : Event() {
    public abstract val payload: Payload
}

@Serializable public sealed interface InternalEvent

@Serializable
@SerialName("MESSENGER_BEACON")
public data class BeaconEvent(
    override val id: Long,
    override val timestamp: Long,
    override val sender: String,
    override val context: JsonElement,
    @SerialName("_messenger_")
    override val tag: Boolean,
) : Event(), InternalEvent {
    public override val type: String = "MESSENGER_BEACON"
}

@Serializable
@SerialName("MESSENGER_EVENT_BATCH")
public data class EventsBatchEvent(
    override val payload: Payload,
    override val id: Long,
    override val timestamp: Long,
    override val sender: String,
    override val context: JsonElement,
    @SerialName("_messenger_")
    override val tag: Boolean,
) : EventWithPayload<EventsBatchEvent.Payload>(), InternalEvent {
    public override val type: String = "MESSENGER_EVENT_BATCH"

    @Serializable
    public data class Payload(val events: List<Event>)
}

@Serializable
@SerialName("MESSENGER_REQUEST_LOST_EVENTS")
public data class RequestLostEventsEvent(
    override val payload: Payload,
    override val id: Long,
    override val timestamp: Long,
    override val sender: String,
    override val context: JsonElement,
    @SerialName("_messenger_")
    override val tag: Boolean,
) : EventWithPayload<RequestLostEventsEvent.Payload>(), InternalEvent {
    public override val type: String = "MESSENGER_REQUEST_LOST_EVENTS"

    @Serializable
    public data class Payload(val messagesReceived: Long)
}

@Serializable
@SerialName("MESSENGER_DISCONNECT")
public data class DisconnectEvent(
    override val id: Long,
    override val timestamp: Long,
    override val sender: String,
    override val context: JsonElement,
    @SerialName("_messenger_")
    override val tag: Boolean,
) : Event(), InternalEvent {
    public override val type: String = "MESSENGER_DISCONNECT"
}

@Serializable
@SerialName("PLAYER_DEVTOOLS_PLUGIN_INTERACTION")
public data class DevtoolsPluginInteractionEvent(
    override val payload: Payload,
    override val id: Long,
    override val timestamp: Long,
    override val sender: String,
    override val context: JsonElement,
    @SerialName("_messenger_")
    override val tag: Boolean,
) : EventWithPayload<DevtoolsPluginInteractionEvent.Payload>() {

    public override val type: String = "PLAYER_DEVTOOLS_PLUGIN_INTERACTION"

    @Serializable public data class Payload(
        public val type: String,
        public val payload: String,
    )
}

@Serializable
@SerialName("PLAYER_DEVTOOLS_PLAYER_INIT")
public data class PlayerInitEvent(
    override val payload: Payload,
    override val id: Long,
    override val timestamp: Long,
    override val sender: String,
    override val context: JsonElement,
    @SerialName("_messenger_")
    override val tag: Boolean,
) : EventWithPayload<PlayerInitEvent.Payload>() {
    public override val type: String = "PLAYER_DEVTOOLS_PLAYER_INIT"

    @Serializable public data class Payload(
        public val plugins: Map<String, JsonElement>
    )
}

@Serializable
@SerialName("PLAYER_DEVTOOLS_PLUGIN_DATA_CHANGE")
public data class DevtoolsDataChangeEvent(
    override val payload: Payload,
    override val id: Long,
    override val timestamp: Long,
    override val sender: String,
    override val context: JsonElement,
    @SerialName("_messenger_")
    override val tag: Boolean,
) : EventWithPayload<DevtoolsDataChangeEvent.Payload>() {
    public override val type: String = "PLAYER_DEVTOOLS_PLUGIN_DATA_CHANGE"

    @Serializable public data class Payload(
        public val pluginID: String,
        public val data: JsonElement,
    )
}

@Serializable(with = UnknownEvent.Serializer::class)
public data class UnknownEvent(
    override val node: Node,
): Event(), NodeWrapper {
    override val id: Long by NodeSerializableField()
    override val timestamp: Long by NodeSerializableField()
    override val sender: String by NodeSerializableField()
    override val context: JsonElement by NodeSerializableField()
    @SerialName("_messenger_")
    override val tag: Boolean by NodeSerializableField()
    override val type: String by NodeSerializableField()

    internal object Serializer : KSerializer<UnknownEvent> by NodeWrapperSerializer(::UnknownEvent)
}
