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

public class Messenger(
    internal val options: Options
) : JSScriptPluginWrapper(NAME, sourcePath = BUNDLED_SOURCE_PATH) {


    override fun apply(runtime: Runtime<*>) {
        SetTimeoutPlugin().apply(runtime)
        if (!runtime.contains("setInterval")) {
            runtime.add("setInterval", runtime.executeRaw("((callback, timeout) => setTimeout(() => { callback(); setInterval(callback, timeout) }, timeout))"))
        }

        runtime.load(ScriptContext(script, BUNDLED_SOURCE_PATH))
        // TODO: Add UUID to messengerOptions
        val optionsKey = "messengerOptions"
        // TODO: Proxy addListener to ensure we create the listener object according to the JVM instance
        runtime.add(optionsKey, options)
        instance = runtime.buildInstance("(new $name.$name($optionsKey))")
    }

    // TODO: This actually doesn't work b/c `instance` isn't available -- need to rework how JS wrappers are loaded, lifecycle to guarantee we don't get a thing until we have the thing
    // TODO: This might not work, NodeSerializableFunction isn't available
    private val sendMessage: (message: Any) -> Unit by lazy {
        // TODO: This doesn't work, supposedly b/c [thisVal] isn't configured for functions, as it is for invokables
        // instance.getSerializable("sendMessage")
        instance.getInvokable("sendMessage")
            ?: throw PlayerException("Could not find sendMessage function on Messenger instance")
    }
    private val destroy: () -> Unit by lazy {
        instance.getInvokable("destroy")
            ?: throw PlayerException("Could not find destroy function on Messenger instance")
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
        instance.runtime.getObject(NAME)!!.getInvokable<Unit>("reset")!!.invoke()
    }

    public fun interface Logger {
        public fun log(vararg args: Any?)
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
            // TODO: Test typing here -- callback might need to be Invokable
            addListener(callback)
        }

        @SerialName("removeListener")
        internal val _removeListener = { callback: MessageHandler ->
            // TODO: This may be useless cause callback will just be a random Invokable :( maybe Node would work?
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
