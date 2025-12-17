package com.intuit.playerui.devtools

import com.intuit.playerui.core.bridge.Invokable
import com.intuit.playerui.core.bridge.Node
import com.intuit.playerui.core.bridge.Promise
import com.intuit.playerui.core.bridge.deserialize
import com.intuit.playerui.core.bridge.getInvokable
import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.core.bridge.runtime.ScriptContext
import com.intuit.playerui.core.bridge.runtime.add
import com.intuit.playerui.core.bridge.serialization.serializers.NodeWrapperSerializer
import com.intuit.playerui.core.player.PlayerException
import com.intuit.playerui.core.plugins.JSScriptPluginWrapper
import com.intuit.playerui.plugins.settimeout.SetTimeoutPlugin
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.Transient
import kotlinx.serialization.json.JsonElement

public typealias MessageHandler = (Event) -> Unit

@Serializable(with = Messenger.Serializer::class)
public class Messenger(
    internal val options: Options,
) : JSScriptPluginWrapper(NAME, sourcePath = BUNDLED_SOURCE_PATH),
    MessageHandler {
    override fun apply(runtime: Runtime<*>) {
        SetTimeoutPlugin().apply(runtime)
        // TODO: setInterval should come from SetTimeoutPlugin
        if (!runtime.contains("setInterval")) {
            runtime.add(
                "setInterval",
                runtime.executeRaw("((callback, timeout) => setTimeout(() => { callback(); setInterval(callback, timeout) }, timeout))"),
            )
        }

        runtime.load(ScriptContext(script, BUNDLED_SOURCE_PATH))
        val optionsKey = "messengerOptions_${hashCode()}"
        runtime.add(
            optionsKey,
            options.copy(
                // hijack listeners to ensure we can remove them w/ stable JVM references
                addListener = { _ -> options.addListener(this) },
                removeListener = { options.removeListener(this) },
            ),
        )
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
        instance.runtime
            .getObject(NAME)
            ?.getObject(NAME)
            ?.getInvokable<Unit>("reset")
            ?: throw PlayerException("Could not find static reset function on Messenger class")
    }

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
    public data class Options(
        public val context: TransactionMetaData.Context,
        // Not transient because we want to require an implementation, but it does mean deserialization not supported
        @SerialName("_sendMessage") public val sendMessage: suspend (message: Event) -> Unit,
        public val addListener: (callback: MessageHandler) -> Unit,
        public val removeListener: (callback: MessageHandler) -> Unit,
        @SerialName("_messageCallback") public val messageCallback: MessageHandler,
        @Transient public val handleFailedMessage: MessageHandler? = null,
        public val id: String? = null,
        public val beaconIntervalMS: Long? = null,
        public val debug: Boolean? = null,
        @Transient public val logger: Logger = Logger { },
    ) {
        // [Logger] structure can't automatically serialize, so we represent as it should be manually
        @SerialName("logger")
        @Suppress("ktlint:standard:backing-property-naming")
        private val _logger: Map<String, Invokable<Unit>> = mapOf("log" to Invokable { logger.log(*it) })

        @SerialName("sendMessage")
        @Suppress("ktlint:standard:backing-property-naming")
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

        @SerialName("handleFailedMessage")
        @Suppress("ktlint:standard:backing-property-naming")
        private val _handleFailedMessage = { message: Node ->
            handleFailedMessage?.let {
                try {
                    message.deserialize<Event>().let(it)
                } catch (e: Throwable) {
                    e.printStackTrace()
                    throw e
                }
            }
        }

        @SerialName("messageCallback")
        @Suppress("ktlint:standard:backing-property-naming")
        private val _messageCallback = { message: Node ->
            try {
                messageCallback(message.deserialize<Event>())
            } catch (e: Throwable) {
                println("Failed to handle message callback for $message")
                e.printStackTrace()
                throw e
            }
        }
    }

    private companion object {
        private const val NAME = "Messenger"
        private const val BUNDLED_SOURCE_PATH = "devtools/messenger/core/dist/Messenger.native.js"
    }

    internal object Serializer : KSerializer<Messenger> by NodeWrapperSerializer({
        throw SerializationException("Messenger deserialization is not supported")
    })
}
