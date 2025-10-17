package com.intuit.playerui.plugins.devtools.basic

import com.intuit.playerui.devtools.DevtoolsHandler
import com.intuit.playerui.devtools.DevtoolsPluginInteractionEvent
import com.intuit.playerui.plugins.devtools.basic.BasicDevtoolsPlugin.Module.BasicDevtoolsPlugin
import com.intuit.playerui.utils.test.RuntimePluginTest
import com.intuit.playerui.utils.test.RuntimeTest
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class BasicDevtoolsPluginTest : RuntimeTest(), DevtoolsHandler {

    override fun processInteraction(interaction: DevtoolsPluginInteractionEvent) {
        TODO("Not yet implemented")
    }

    override fun checkIfDevtoolsIsActive(): Boolean {
        return true
    }

    @Test fun smoke() {
        val plugin = runtime.BasicDevtoolsPlugin(BasicDevtoolsPlugin.Options("test", this))
        assertTrue(plugin.checkIfDevtoolsIsActive())
    }
}
