package com.intuit.playerui.devtools

import com.intuit.playerui.devtools.DevtoolsPlugin.Module.DevtoolsPlugin
import com.intuit.playerui.utils.test.RuntimeTest
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class DevtoolsPluginTest : RuntimeTest(), DevtoolsHandler {

    override fun processInteraction(interaction: DevtoolsPluginInteractionEvent) {
        TODO("processInteraction")
    }

    override fun checkIfDevtoolsIsActive(): Boolean = true

    @Test fun smoke() {
        val plugin = runtime.DevtoolsPlugin(DevtoolsPlugin.Options(
            "test",
            emptyMap(),
            this
        ))

        assertTrue(plugin.checkIfDevtoolsIsActive())
    }
}
