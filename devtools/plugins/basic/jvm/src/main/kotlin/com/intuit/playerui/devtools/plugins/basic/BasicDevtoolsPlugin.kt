package com.intuit.playerui.devtools.plugins.basic

import com.intuit.playerui.core.bridge.Node
import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.core.bridge.runtime.add
import com.intuit.playerui.core.bridge.serialization.serializers.NodeWrapperSerializer
import com.intuit.playerui.core.player.PlayerException
import com.intuit.playerui.core.plugins.RuntimePlugin
import com.intuit.playerui.devtools.DevtoolsHandler
import com.intuit.playerui.devtools.DevtoolsPlugin
import com.intuit.playerui.devtools.ModuleLoader
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import java.util.concurrent.atomic.AtomicInteger

@Serializable(with = BasicDevtoolsPlugin.Serializer::class)
public class BasicDevtoolsPlugin(
    node: Node,
) : DevtoolsPlugin(node) {
    @Serializable
    public data class Options(
        public val playerID: String,
        public val handler: DevtoolsHandler,
    )

    public companion object Module : RuntimePlugin by ModuleLoader(
        BasicDevtoolsPlugin.NAME,
        BasicDevtoolsPlugin.BUNDLED_SOURCE_PATH,
    ) {
        private val count = AtomicInteger(0)

        public fun Runtime<*>.BasicDevtoolsPlugin(options: Options): BasicDevtoolsPlugin {
            // Polyfill WeakRef if it doesn't exist in the runtime -- should ideally be provided as a plugin like `setTimeout`
            if (!runtime.contains(
                    "WeakRef",
                )
            ) {
                runtime.execute(
                    "class WeakRef { value = null; constructor(value) { this.value = value }; deref() { return this.value } }",
                )
            }

            // Load module into runtime
            apply(this)

            // Create an instance of the plugin
            val argsKey = "basicDevtoolsPluginArgs_${count.getAndIncrement()}"
            runtime.add(argsKey, options)
            val instance =
                runtime.execute("(new $NAME.$NAME($argsKey))") as? Node
                    ?: throw PlayerException("Could not instantiate BasicDevtoolsPlugin")
            return BasicDevtoolsPlugin(instance)
        }

        private const val NAME = "BasicDevtoolsPlugin"
        private const val BUNDLED_SOURCE_PATH = "devtools/plugins/basic/core/dist/$NAME.native.js"
    }

    internal object Serializer : KSerializer<BasicDevtoolsPlugin> by NodeWrapperSerializer(::BasicDevtoolsPlugin)
}
