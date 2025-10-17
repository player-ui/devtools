package com.intuit.playerui.devtools

import com.facebook.flipper.core.FlipperConnection
import com.facebook.flipper.core.FlipperPlugin
import com.intuit.playerui.core.player.PlayerException
import kotlinx.serialization.StringFormat
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

public class PlayerDevtoolsFlipperPlugin : FlipperPlugin {
    private var flipperConnection: FlipperConnection? = null
    // multiple devtools plugins can listen for events
    private val listeners = mutableSetOf<(Event) -> Unit>()

    override fun getId(): String = "player-ui-devtools"
    override fun runInBackground(): Boolean = false

    override fun onConnect(connection: FlipperConnection) {
        flipperConnection = connection
        connection.receive("message::flipper") { message, _ ->
            try {
                val event: Event = Json.decodeFromString(message.toJsonString())
                listeners.forEach { it(event) }
            } catch (throwable: Throwable) {
                PlayerException("Failed to handle message from Flipper", throwable).printStackTrace()
            }
        }
    }

    override fun onDisconnect() {
        flipperConnection = null
    }

    internal fun sendMessage(event: Event) {
        flipperConnection?.send("message::plugin", Json.encodeToString(event))
    }

    internal fun addListener(listener: (Event) -> Unit) = listeners.add(listener)
    internal fun removeListener(listener: (Event) -> Unit) = listeners.remove(listener)

    private object Json : StringFormat by Json(builderAction = {
        ignoreUnknownKeys = true
        classDiscriminator = "_type"
        encodeDefaults = true
    })
}
