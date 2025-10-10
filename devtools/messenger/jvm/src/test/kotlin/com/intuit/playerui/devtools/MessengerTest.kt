package com.intuit.playerui.devtools

import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.core.bridge.runtime.runtimeFactory
import com.intuit.playerui.core.bridge.serialization.format.registerSerializersModule
import com.intuit.playerui.core.player.PlayerException
import com.intuit.playerui.devtools.TransactionMetaData.Context
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertInstanceOf

class MessengerTest : Messenger.Logger {

    lateinit var runtime: Runtime<*>

    val sent = arrayListOf<Event>() @Synchronized get
    val listeners = mutableSetOf<MessageHandler>() @Synchronized get
    val handled = arrayListOf<Event>() @Synchronized get
    val failed = arrayListOf<Event>() @Synchronized get
    val logs = mutableListOf<String>() @Synchronized get

    override fun log(vararg args: Any?) {
        args.joinToString(", ")
            .also(::println)
            .also(logs::add)
    }

    @BeforeEach fun setup() {
        runtime = runtimeFactory.create {
            timeout = Long.MAX_VALUE
            coroutineExceptionHandler = CoroutineExceptionHandler { _, throwable -> throw throwable }
        }.apply {
            format.registerSerializersModule {
                polymorphicDefault(Event::class) {
                    UnknownEvent.serializer()
                }
            }
        }

        sent.clear()
        listeners.clear()
        handled.clear()
        failed.clear()
        logs.clear()
    }

    @AfterEach
    fun log() {
        println("Sent: ${sent.joinToString("\n")}")
        println("Listeners: $listeners")
        println("Handled: $handled")
        println("Failed: $failed")
        println("Logs: $logs")
        runtime.release()
    }

    private fun buildMessenger(id: String, configure: Messenger.Options.() -> Messenger.Options = { this }) = Messenger(Messenger.Options(
        context = Context.DEVTOOLS,
        id = id,
        //
        logger = this,
        debug = true,
        sendMessage = sent::add,
        addListener = listeners::add,
        removeListener = listeners::remove,
        messageCallback = handled::add,
        handleFailedMessage = failed::add,
    ).run(configure)).apply { apply(runtime) }

    private fun buildTestEvent(count: Int) = buildJsonObject {
        put("type", "TEST")
        put("payload", buildJsonObject {
            put("count", count)
        })
    }

    @Test
    fun beacons() = runBlocking {
        val beacon = suspendCancellableCoroutine { cont ->
            buildMessenger("queue") {
                copy(
                    sendMessage = {
                        sent.add(it)
                        if (sent.size > 2) {
                            cont.resumeWith(Result.success(it))
                        }
                    }
                )
            }
        }

        assertInstanceOf<BeaconEvent>(beacon)
        assertEquals("queue", beacon.sender)
    }

    @Test fun `queue messages while handshake is in progress, and send them as the connection is established`() = runBlocking {
        val batch = suspendCancellableCoroutine { cont ->
            val messenger = buildMessenger("queue") {
                copy(
                    sendMessage = {
                        sent.add(it)
                        if (it is EventsBatchEvent) {
                            cont.resumeWith(Result.success(it))
                        }
                    }
                )
            }

            launch {
                messenger.sendMessage(buildTestEvent(0))
                delay(1000)
                messenger.sendMessage(buildTestEvent(1))
                delay(1000)
                messenger.sendMessage(buildTestEvent(2))
                delay(1000)
                listeners.first().invoke(
                    BeaconEvent(
                        id = 0,
                        timestamp = 0,
                        sender = "test-2",
                        context = JsonPrimitive("content-script"),
                        tag = true,
                    )
                )
            }
        }

        assertInstanceOf<EventsBatchEvent>(batch)
        assertEquals(3, batch.payload.events.size)
        batch.payload.events.forEachIndexed { index, event ->
            assertInstanceOf<UnknownEvent>(event)
            assertEquals(index, event.node.getObject("payload")?.get("count"))
        }
    }

    @Test fun `failure sending message triggers failure handler`() = runBlocking {
        val failed = suspendCancellableCoroutine { cont ->
            val messenger = buildMessenger("failure") {
                copy(
                    sendMessage = {
                        throw PlayerException("Failed to send message")
                    },
                    handleFailedMessage = {
                        cont.resumeWith(Result.success(it))
                    }
                )
            }
            messenger.sendMessage(buildJsonObject {
                put("type", "TEST")
                put("payload", buildJsonObject {
                    put("count", 1)
                })
            })
        }

        assertInstanceOf<UnknownEvent>(failed)
        assertEquals(1, failed.node.getObject("payload")?.get("count"))
    }

    @Test fun `destroy removes listener`() {
        val messenger = buildMessenger("destroy")
        assertEquals(1, listeners.size)
        messenger.destroy()
        assertEquals(0, listeners.size)
    }

    @Test fun `reset removes listeners`() {
        val messenger = buildMessenger("reset")
        assertEquals(1, listeners.size)
        listeners.first().invoke(
            BeaconEvent(
                id = 0,
                timestamp = 0,
                sender = "test-2",
                context = JsonPrimitive("content-script"),
                tag = true,
            )
        )
        assertEquals(1, messenger.node.runtime.getObject("Messenger")?.getObject("Messenger")?.getObject("connections")?.size)
        messenger.reset()
        assertEquals(0, messenger.node.runtime.getObject("Messenger")?.getObject("Messenger")?.getObject("connections")?.size)
    }
}
