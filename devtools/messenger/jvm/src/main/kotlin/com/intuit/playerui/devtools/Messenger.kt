package com.intuit.playerui.devtools

import com.intuit.playerui.core.bridge.Invokable
import com.intuit.playerui.core.bridge.Node
import com.intuit.playerui.core.bridge.Promise
import com.intuit.playerui.core.bridge.deserialize
import com.intuit.playerui.core.bridge.getInvokable
import com.intuit.playerui.core.bridge.getSerializable
import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.core.bridge.runtime.ScriptContext
import com.intuit.playerui.core.bridge.runtime.add
import com.intuit.playerui.core.player.PlayerException
import com.intuit.playerui.core.plugins.JSScriptPluginWrapper
import com.intuit.playerui.plugins.settimeout.SetTimeoutPlugin
import kotlinx.serialization.Contextual
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.json.JsonElement

// TODO: This should be a funterface, serialization issues
public typealias MessageHandler = (Event) -> Unit

//public fun interface MessageHandler {
//    public fun handle(message: Event)
//}

public class Messenger(
    internal val options: Options
) : MessageHandler, JSScriptPluginWrapper(NAME, sourcePath = BUNDLED_SOURCE_PATH) {

    override fun apply(runtime: Runtime<*>) {
        SetTimeoutPlugin().apply(runtime)
        // TODO: setInterval should come from SetTimeoutPlugin
        if (!runtime.contains("setInterval")) {
            runtime.add("setInterval", runtime.executeRaw("((callback, timeout) => setTimeout(() => { callback(); setInterval(callback, timeout) }, timeout))"))
        }

        runtime.load(ScriptContext(script, BUNDLED_SOURCE_PATH))
        // TODO: Add UUID to messengerOptions
        val optionsKey = "messengerOptions"
        runtime.add(optionsKey, options.copy(
            // hijack listeners to ensure we can remove them w/ stable JVM references
            addListener = { _ -> options.addListener(this) },
            removeListener = { options.removeListener(this) }
        ))
        instance = runtime.buildInstance("(new $name.$name($optionsKey))")
    }

    private val handleMessage: MessageHandler by lazy {
        // TODO: Instead of lazy init, just invoke w/ core options.addListner
        instance.getInvokable<Unit>("handleMessage")
            ?: throw PlayerException("Could not find handleMessage function on Messenger instance")
    }

    private val sendMessage: (message: Any) -> Unit by lazy {
        instance.getInvokable("sendMessage")
            ?: throw PlayerException("Could not find sendMessage function on Messenger instance")
    }

    private val destroy: () -> Unit by lazy {
        instance.getInvokable("destroy")
            ?: throw PlayerException("Could not find destroy function on Messenger instance")
    }

    private val reset: () -> Unit by lazy {
        instance.runtime.getObject(NAME)?.getInvokable<Unit>("reset")
            ?: throw PlayerException("Could not find static reset function on Messenger class")
    }

//    override fun handle(message: Event) {
//        handleMessage.handle(message)
//    }

    override fun invoke(message: Event) {
        handleMessage.invoke(message)
    }

    public fun sendMessage(message: Event) {
        sendMessage.invoke(message)
    }

    public fun sendMessage(message: JsonElement) {
        sendMessage.invoke(message.toString())
    }

    public fun destroy() {
        destroy.invoke()
    }

    public fun reset() {
        reset.invoke()
    }

    public fun interface Logger {
        public fun log(vararg args: Any?)
    }

    @Serializable
    public abstract class Options2(
        public val context: TransactionMetaData.Context,
        public val id: String? = null,
//        @Transient public val logger: Logger = Logger {},
        public val beaconIntervalMS: Long? = null,
        public val debug: Boolean? = null,
    ){
        public abstract suspend fun sendMessage(message: Event)
        public abstract fun addListener(callback: MessageHandler)
        public abstract fun removeListener(callback: MessageHandler)
        public abstract fun messageCallback(message: Event)
        public abstract fun handleFailedMessage(message: Event)
        public abstract fun log(vararg args: Any?)

        @SerialName("logger")
        private val _logger: Map<String, Invokable<Unit>> = mapOf("log" to Invokable { log(*it) })

        @SerialName("sendMessage")
        private val _sendMessage = { message: Node ->
            message.runtime.Promise { resolve, reject ->
                try {
                    sendMessage(message.deserialize<Event>())
                    resolve(Unit)
                } catch (e: Throwable) {
                    e.printStackTrace()
                    reject(e)
                }
            }
        }

        @SerialName("addListener")
        private val _addListener = { callback: MessageHandler ->
            addListener(callback)
        }

        @SerialName("removeListener")
        private val _removeListener = { callback: MessageHandler ->
            removeListener(callback)
        }

        @SerialName("handleFailedMessage")
        private val _handleFailedMessage = { message: Node ->
            handleFailedMessage(message.deserialize<Event>())
        }

        @SerialName("messageCallback")
        private val _messageCallback = { message: Node ->
            messageCallback(message.deserialize<Event>())
        }
    }

    // TODO: Turn into abstract class w/ pseudo-constructor that takes callback in argument form
    @Serializable
    public data class Options(
        @Transient val logger: Logger = Logger {},
        val context: TransactionMetaData.Context,

        @Transient val sendMessage: suspend (message: Event) -> Unit = error("sendMessage not provided"),
        @Transient val addListener: (callback: MessageHandler) -> Unit = {},
        @Transient val removeListener: (callback: MessageHandler) -> Unit = {},
        @Transient val messageCallback: MessageHandler = {},
        @Transient val handleFailedMessage: MessageHandler? = null,

        val id: String? = null,
        val beaconIntervalMS: Long? = null,
        val debug: Boolean? = null,
    ) {
        // [Logger] structure can't automatically serialize, so we represent as it should be manually
        @SerialName("logger")
        internal val _logger: Map<String, Invokable<Unit>> = mapOf("log" to Invokable { logger.log(*it) })

        @SerialName("sendMessage")
        internal val _sendMessage = { message: Node ->
            message.runtime.Promise { resolve, reject ->
                try {
                    sendMessage(message.deserialize<Event>())
                    resolve(Unit)
                } catch (e: Throwable) {
                    e.printStackTrace()
                    reject(e)
                }
            }
        }

        @SerialName("addListener")
        internal val _addListener = { callback: MessageHandler ->
            addListener(callback)
        }

        @SerialName("removeListener")
        internal val _removeListener = { callback: MessageHandler ->
            removeListener(callback)
        }

        @SerialName("handleFailedMessage")
        internal val _handleFailedMessage = { message: Node ->
            handleFailedMessage?.let { message.deserialize<Event>().let(it) }
        }

        @SerialName("messageCallback")
        internal val _messageCallback = { message: Node ->
            messageCallback(message.deserialize<Event>())
        }
    }

    private companion object {
        private const val NAME = "Messenger"
        private const val BUNDLED_SOURCE_PATH = "devtools/messenger/core/dist/Messenger.native.js"
    }
}
