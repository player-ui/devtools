package com.intuit.playerui.devtools

import com.intuit.playerui.core.bridge.Invokable
import com.intuit.playerui.core.bridge.Node
import com.intuit.playerui.core.bridge.NodeWrapper
import com.intuit.playerui.core.bridge.deserialize
import com.intuit.playerui.core.bridge.getInvokable
import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.core.bridge.runtime.ScriptContext
import com.intuit.playerui.core.bridge.runtime.add
import com.intuit.playerui.core.bridge.serialization.serializers.NodeSerializableField
import com.intuit.playerui.core.bridge.serialization.serializers.NodeWrapperSerializer
import com.intuit.playerui.core.experimental.ExperimentalPlayerApi
import com.intuit.playerui.core.player.Player
import com.intuit.playerui.core.player.PlayerException
import com.intuit.playerui.core.plugins.PlayerPlugin
import com.intuit.playerui.core.plugins.RuntimePlugin
import kotlinx.serialization.Contextual
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import java.util.concurrent.atomic.AtomicInteger

@Serializable(with = DevtoolsHandler.Serializer::class)
public interface DevtoolsHandler {
    public fun processInteraction(interaction: DevtoolsPluginInteractionEvent)
    public fun checkIfDevtoolsIsActive(): Boolean

    @Serializable
    public data class SerializedHandler(
        @Transient val processInteraction: (DevtoolsPluginInteractionEvent) -> Unit = { error("Deserialization not supported" )},
        val checkIfDevtoolsIsActive: () -> Boolean,
    ) : DevtoolsHandler {
        // hijack to deserialize the event before passing to the real handler
        @SerialName("processInteraction")
        private val _processInteraction = { event: Node -> processInteraction(event.deserialize()) }

        override fun checkIfDevtoolsIsActive(): Boolean = checkIfDevtoolsIsActive.invoke()

        override fun processInteraction(interaction: DevtoolsPluginInteractionEvent) {
            processInteraction.invoke(interaction)
        }
    }

    public object Serializer : KSerializer<DevtoolsHandler> {
        override val descriptor: SerialDescriptor = SerializedHandler.serializer().descriptor
        override fun serialize(encoder: Encoder, value: DevtoolsHandler) {
            encoder.encodeSerializableValue(SerializedHandler.serializer(), SerializedHandler(value::processInteraction, value::checkIfDevtoolsIsActive))
        }

        override fun deserialize(decoder: Decoder): DevtoolsHandler = decoder.decodeSerializableValue(SerializedHandler.serializer())
    }
}

@Serializable(with = DevtoolsPluginStore.Serializer::class)
public data class DevtoolsPluginStore(override val node: Node) : NodeWrapper {

    // TODO: Expose internals

    internal object Serializer : KSerializer<DevtoolsPluginStore> by NodeWrapperSerializer(::DevtoolsPluginStore)
}

@Serializable(with = PluginStore.Serializer::class)
public class PluginStore(override val node: Node) : NodeWrapper {

    private val dispatch by lazy {
        node.getInvokable<Unit>("dispatch")
            ?: throw PlayerException("Could not find dispatch on PluginStore instance")
    }

    public fun dispatch(event: Event) {
        dispatch.invoke(event)
    }

    private val getState by lazy {
        node.getInvokable<DevtoolsPluginStore>("getState")
            ?: throw PlayerException("Could not find getState on PluginStore instance")
    }

    public fun getState(): DevtoolsPluginStore = getState.invoke()

    private val subscribe by lazy {
        node.getInvokable<() -> Unit>("subscribe")
            ?: throw PlayerException("Could not find subscribe on PluginStore instance")
    }

    public fun subscribe(subscriber: (DevtoolsPluginStore) -> Unit): () -> Unit = subscribe.invoke { store: Node ->
        try {
            subscriber(store.deserialize())
        } catch (throwable: Throwable) {
            throw PlayerException("Error while subscribing to PluginStore", throwable).also(Throwable::printStackTrace)
        }
    }

    internal object Serializer : KSerializer<PluginStore> by NodeWrapperSerializer(::PluginStore)
}

// TODO: Implement if required
public typealias PluginData = Map<String, @Contextual Any?>

@Serializable(with = DevtoolsPlugin.Serializer::class)
public open class DevtoolsPlugin(
    override val node: Node,
) : DevtoolsHandler, PlayerPlugin, NodeWrapper {

    public val pluginID: String by NodeSerializableField()
    public val playerID: String by NodeSerializableField()
    public val store: PluginStore by NodeSerializableField()

    private val checkIfDevtoolsIsActive by lazy {
        node.getInvokable<Boolean>("checkIfDevtoolsIsActive")
            ?: throw PlayerException("Could not find checkIfDevtoolsIsActive on DevtoolsPlugin instance")
    }

    override fun checkIfDevtoolsIsActive(): Boolean = checkIfDevtoolsIsActive.invoke()

    private val processInteraction by lazy {
        node.getInvokable<Unit>("processInteraction")
            ?: throw PlayerException("Could not find processInteraction on DevtoolsPlugin instance")
    }

    override fun processInteraction(interaction: DevtoolsPluginInteractionEvent): Unit = processInteraction.invoke(interaction)

    private val registerMessenger by lazy {
        node.getInvokable<Invokable<Unit>>("registerMessenger")
            ?: throw PlayerException("Could not find registerMessenger on DevtoolsPlugin instance")
    }

    public fun registerMessenger(messenger: Messenger): () -> Unit = registerMessenger.invoke(messenger)

    private val apply by lazy {
        node.getInvokable<Unit>("apply")
            ?: throw PlayerException("Could not find apply on DevtoolsPlugin instance")
    }

    override fun apply(player: Player) {
        apply.invoke(player)
    }

    @Serializable
    public data class Options(
        public val playerID: String,
        public val pluginData: PluginData,
        public val handler: DevtoolsHandler,
    )

    public companion object Module : RuntimePlugin by ModuleLoader(DevtoolsPlugin.NAME, DevtoolsPlugin.BUNDLED_SOURCE_PATH) {
        // TODO: Kotlin 2.0: Use AtomicInt
        private val count = AtomicInteger(0)

        public fun Runtime<*>.DevtoolsPlugin(options: Options): DevtoolsPlugin {
            // TODO: Move to Player globals implementations
            runtime.execute("class WeakRef { value = null; constructor(value) { this.value = value }; deref() { return this.value } }")

            apply(this)

            val argsKey = "devtoolsPluginArgs_${count.getAndIncrement()}"
            runtime.add(argsKey, options)
            val instance = runtime.execute("(new $NAME.$NAME($argsKey))") as? Node
                ?: throw PlayerException("Could not instantiate DevtoolsPlugin")
            return DevtoolsPlugin(instance)
        }

        private const val NAME = "DevtoolsPlugin"
        private const val BUNDLED_SOURCE_PATH = "devtools/plugin/core/dist/$NAME.native.js"
    }

    internal object Serializer : KSerializer<DevtoolsPlugin> by NodeWrapperSerializer(::DevtoolsPlugin)
}

// TODO: Uplevel to Player lib as solution JS Player plugin loading
@ExperimentalPlayerApi
public class ModuleLoader(
    private val name: String,
    private val scriptContext: ScriptContext,
) : RuntimePlugin {

    public constructor(name: String, path: String) : this(name, ScriptContext(readScript(name, path), path))

    override fun apply(runtime: Runtime<*>) {
        if (!runtime.contains(name)) runtime.load(scriptContext)
    }

    private companion object {
        fun readScript(name: String, path: String): String = ModuleLoader::class.java.classLoader.getResource(path)?.readText()
            ?: throw PlayerException("Could not find bundled script for $name at $path")
    }
}
