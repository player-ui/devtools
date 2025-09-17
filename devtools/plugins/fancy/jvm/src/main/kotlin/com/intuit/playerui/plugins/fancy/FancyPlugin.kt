package com.intuit.playerui.plugins.fancy

import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.core.bridge.runtime.ScriptContext
import com.intuit.playerui.core.player.Player
import com.intuit.playerui.core.plugins.JSScriptPluginWrapper
import com.intuit.playerui.core.plugins.PlayerPlugin
import com.intuit.playerui.core.plugins.PlayerPluginException
import com.intuit.playerui.core.plugins.findPlugin

public class FancyPlugin(
    private val _isFancy: Boolean = false,
) : JSScriptPluginWrapper(PLUGIN_NAME, sourcePath = BUNDLED_SOURCE_PATH),
    PlayerPlugin {
    public val isFancy: Boolean get() =
        instance.getBoolean("isFancy")
            // If there's no sane fallback behavior, error to not silently swallow
            ?: throw PlayerPluginException("Expected boolean isFancy value from backing object, received ${instance.get("isFancy")}")

    override fun apply(runtime: Runtime<*>) {
        // Load source into [runtime]
        runtime.load(ScriptContext(script, BUNDLED_SOURCE_PATH))
        // Build the JS instance manually using our constructor
        instance = runtime.buildInstance("""(new $name($_isFancy))""")
    }

    override fun apply(player: Player) {
        player.logger.info(
            "Applying JVM $name plugin with fancy mode: isFancy",
        )
    }

    private companion object {
        // Name of the JS class, scoped as bundled
        private const val PLUGIN_NAME = "FancyPlugin.FancyPlugin"

        // Path of the bundled JS source to load
        private const val BUNDLED_SOURCE_PATH = "plugins/fancy/core/dist/FancyPlugin.native.js"
    }
}

/** Convenience getter to find the first [FancyPlugin] registered to the [Player] */
public val Player.fancyPlugin: FancyPlugin? get() = findPlugin()
