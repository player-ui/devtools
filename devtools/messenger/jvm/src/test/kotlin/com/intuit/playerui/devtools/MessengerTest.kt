package com.intuit.playerui.devtools

import com.intuit.playerui.core.bridge.Promise
import com.intuit.playerui.devtools.TransactionMetaData.Context
import com.intuit.playerui.utils.test.RuntimeTest
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class MessengerTest : RuntimeTest(), Logger {

    val logs = mutableListOf<Array<out Any?>>()

    override fun log(vararg args: Any?) {
        println(args.joinToString(", "))
        logs.add(args)
    }

    @Test
    fun beacons() {
        val sent = arrayListOf<Messenger.Event>()
        val listeners = mutableSetOf<MessageHandler>()
        val handled = arrayListOf<Messenger.Transaction>()
        val failed = arrayListOf<Messenger.Transaction>()
        val options = Messenger.Options(
            id = "devtools",
            debug = true,

            logger = this,
            context = Context.DEVTOOLS,

            sendMessage = { sent.add(it); runtime.Promise.resolve(Unit) },
            addListener = listeners::add,
            removeListener = listeners::remove,
            messageCallback = handled::add,
            handleFailedMessage = failed::add,
        )

        val messenger = Messenger(options).apply { apply(runtime) }

        runBlocking {
            delay(1000)
        }

        assertEquals(BeaconEvent, sent.first().event)
    }
}
