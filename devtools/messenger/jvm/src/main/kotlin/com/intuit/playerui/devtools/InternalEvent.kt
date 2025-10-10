package com.intuit.playerui.devtools

import com.intuit.playerui.devtools.Messenger.Event
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

public enum class EventType {
    MESSENGER_BEACON
}

public enum class Meta

@Serializable
//@JsonClassDiscriminator("type")
public sealed class BaseEvent<P> {
    public abstract val type: EventType

    public open val payload: P? = null

    public open val target: String? = null
}

public sealed interface InternalEvent

public object BeaconEvent : BaseEvent<Nothing>() {
    override val type: EventType = EventType.MESSENGER_BEACON
}


@Serializable
public data class TransactionMetaData(
    val id: Long,
    val timestamp: Long,
    val sender: String,
    val context: Context,
    @SerialName("_messenger_")
    val tag: Boolean,
) {
    @Serializable
    public enum class Context(public val value: String) {
        PLAYER("player"),
        DEVTOOLS("devtools");
    }
}

//@Serializable
public fun interface Logger {
    public fun log(vararg args: Any?)
}
