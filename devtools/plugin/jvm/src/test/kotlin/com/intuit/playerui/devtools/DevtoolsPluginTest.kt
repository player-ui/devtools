package com.intuit.playerui.devtools

import com.intuit.playerui.core.bridge.serialization.format.registerSerializersModule
import com.intuit.playerui.devtools.DevtoolsPlugin.Module.DevtoolsPlugin
import com.intuit.playerui.utils.test.RuntimeTest
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertInstanceOf

class DevtoolsPluginTest :
    RuntimeTest(),
    DevtoolsHandler {
    override fun processInteraction(interaction: DevtoolsPluginInteractionEvent) {
        TODO("processInteraction")
    }

    override fun checkIfDevtoolsIsActive(): Boolean = true

    @Test fun smoke() {
        val plugin =
            runtime.DevtoolsPlugin(
                DevtoolsPlugin.Options(
                    "test",
                    emptyMap(),
                    this,
                ),
            )

        assertTrue(plugin.checkIfDevtoolsIsActive())
    }

    @Test fun `registered messenger sends store messages`() {
        runtime.format.registerSerializersModule {
            polymorphicDefault(Event::class) { UnknownEvent.serializer() }
        }
        val sent = CompletableDeferred<Event>()
        val plugin =
            runtime.DevtoolsPlugin(
                DevtoolsPlugin.Options(
                    "test",
                    emptyMap(),
                    this,
                ),
            )
        val messenger =
            Messenger(
                Messenger.Options(
                    context = TransactionMetaData.Context.PLAYER,
                    id = "test",
                    sendMessage = { sent.complete(it) },
                    addListener = {},
                    removeListener = {},
                    messageCallback = plugin.store::dispatch,
                ),
            ).apply { apply(runtime) }

        plugin.registerMessenger(messenger)
        plugin.store.dispatch(
            PlayerInitEvent(
                payload = PlayerInitEvent.Payload(emptyMap()),
                id = -1,
                timestamp = 0,
                sender = "test",
                context = JsonPrimitive("player"),
                tag = true,
            ),
        )

        val init = assertInstanceOf<PlayerInitEvent>(runBlocking { withTimeout(5000) { sent.await() } })
        assertEquals("test", init.sender)
        assertEquals(JsonPrimitive("player"), init.context)
    }
}
