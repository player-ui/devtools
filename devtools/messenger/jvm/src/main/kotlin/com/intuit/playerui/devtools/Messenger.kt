package com.intuit.playerui.devtools

import com.intuit.playerui.core.bridge.Invokable
import com.intuit.playerui.core.bridge.Promise
import com.intuit.playerui.core.bridge.getInvokable
import com.intuit.playerui.core.bridge.getSerializable
import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.core.bridge.runtime.ScriptContext
import com.intuit.playerui.core.bridge.runtime.add
import com.intuit.playerui.core.player.PlayerException
import com.intuit.playerui.core.plugins.JSScriptPluginWrapper
import com.intuit.playerui.plugins.settimeout.SetTimeoutPlugin
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

// TODO: This should be a funterface, serialization issues
public typealias MessageHandler = (Messenger.Transaction) -> Unit

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
        runtime.add(optionsKey, options)
        instance = runtime.buildInstance("(new $name.$name($optionsKey))")
    }

    // TODO: This actually doesn't work b/c `instance` isn't available -- need to rework how JS wrappers are loaded, lifecycle to guarantee we don't get a thing until we have the thing
    // TODO: This might not work, NodeSerializableFunction isn't available
    private val sendMessage: (message: Any) -> Unit by lazy {
        instance.getSerializable("sendMessage")
            ?: throw PlayerException("Could not find sendMessage function on Messenger instance")
    }
    private val destroy: () -> Unit by lazy {
        instance.getSerializable("destroy")
            ?: throw PlayerException("Could not find destroy function on Messenger instance")
    }

    public fun sendMessage(message: Event) {
        sendMessage.invoke(message)
    }

    public fun sendMessage(message: String) {
        sendMessage.invoke(message)
    }

    public fun destroy() {
        destroy.invoke()
    }

    public fun reset() {
        instance.runtime.getObject(NAME)!!.getInvokable<Unit>("reset")!!.invoke()
    }

    // should be InternalEvent<T> | BaseEvent<unknown>
    @Serializable
    public data class Event/*<T> -- necessary for batched events*/(
        val event: InternalEvent
    )

    // should be InternalEvent<T> | BaseEvent<unknown>
    @Serializable
    public data class Transaction/*<T> -- necessary for batched events*/(
        // TODO: Pull out metadata from object, populate metaData
        val metaData: TransactionMetaData,
        // TODO: This should really be taking the [...rest] and deserializing as event, otherwise, this needs to be an Event too
        val event: Event,
    )


//    public fun interface MessageHandler {
//        public fun onMessage(message: Transaction)
//    }

    // TODO: Turn into abstract class w/ pseudo-constructor that takes callback in argument form
    @Serializable
    public data class Options(
        @Transient
        val logger: Logger = Logger {},
        val context: TransactionMetaData.Context,

        // TODO: Convert suspendable to Promise on serialization
        val sendMessage: (message: Event) -> Promise,
        val addListener: (callback: MessageHandler) -> Unit,
        val removeListener: (callback: MessageHandler) -> Unit,
        val messageCallback: MessageHandler,

        val id: String? = null,
        val beaconIntervalMS: Long? = null,
        val debug: Boolean? = null,
        val handleFailedMessage: MessageHandler? = null,
    ) {
        // [Logger] structure can't automatically serialize, so we represent as it should be manually
        @SerialName("logger")
        internal val _logger: Map<String, Invokable<Unit>> = mapOf("log" to Invokable { logger.log(*it) })
    }

    private companion object {
        private const val NAME = "Messenger"
        private const val BUNDLED_SOURCE_PATH = "devtools/messenger/core/dist/Messenger.native.js"
    }
}
