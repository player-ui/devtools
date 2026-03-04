package com.intuit.playerui.plugins.devtools.profiler

import com.intuit.playerui.core.bridge.Node
import com.intuit.playerui.core.bridge.deserialize
import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.core.bridge.runtime.add
import com.intuit.playerui.core.bridge.serialization.serializers.NodeWrapperSerializer
import com.intuit.playerui.core.player.PlayerException
import com.intuit.playerui.core.plugins.RuntimePlugin
import com.intuit.playerui.devtools.DevtoolsHandler
import com.intuit.playerui.devtools.DevtoolsPlugin
import com.intuit.playerui.devtools.DevtoolsPluginInteractionEvent
import com.intuit.playerui.devtools.ModuleLoader
import com.intuit.playerui.devtools.PluginData
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import java.util.concurrent.atomic.AtomicInteger

@Serializable(with = ProfilerDevtoolsPlugin.Serializer::class)
public class ProfilerDevtoolsPlugin(node: Node) : DevtoolsPlugin(node) {

    @Serializable
    public data class Options(
        public val playerID: String,
        public val handler: DevtoolsHandler,
    )

    public companion object Module : RuntimePlugin by ModuleLoader(
        ProfilerDevtoolsPlugin.NAME,
        ProfilerDevtoolsPlugin.BUNDLED_SOURCE_PATH
    ) {
        private val count = AtomicInteger(0)
        public fun Runtime<*>.ProfilerDevtoolsPlugin(options: Options): ProfilerDevtoolsPlugin {
            runtime.execute("class WeakRef { value = null; constructor(value) { this.value = value }; deref() { return this.value } }")

            val argsKey = "profilerDevtoolsPluginArgs_${count.getAndIncrement()}"
            runtime.add(argsKey, options)
            apply(this)
            val instance = runtime.execute("(new ${NAME}.${NAME}($argsKey))") as? Node
                ?: throw PlayerException("Could not instantiate ProfilerDevtoolsPlugin")
            return ProfilerDevtoolsPlugin(instance)
        }

        private const val NAME = "ProfilerDevtoolsPlugin"
        private const val BUNDLED_SOURCE_PATH = "devtools/plugins/profiler/core/dist/$NAME.native.js"
    }

    internal object Serializer : KSerializer<ProfilerDevtoolsPlugin> by NodeWrapperSerializer(::ProfilerDevtoolsPlugin)
}
