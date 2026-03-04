package com.intuit.playerui.plugins.devtools.profiler

import com.intuit.playerui.devtools.DevtoolsHandler
import com.intuit.playerui.devtools.DevtoolsPluginInteractionEvent
import com.intuit.playerui.plugins.devtools.profiler.ProfilerDevtoolsPlugin.Module.ProfilerDevtoolsPlugin
import com.intuit.playerui.utils.test.RuntimeTest
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ProfilerDevtoolsPluginTest : RuntimeTest(), DevtoolsHandler {

    override fun processInteraction(interaction: DevtoolsPluginInteractionEvent) {
        TODO("Not yet implemented")
    }

    override fun checkIfDevtoolsIsActive(): Boolean {
        return true
    }

    @Test fun smoke() {
        val plugin = runtime.ProfilerDevtoolsPlugin(ProfilerDevtoolsPlugin.Options("test", this))
        assertTrue(plugin.checkIfDevtoolsIsActive())
        plugin.store.getState().node
    }
}
