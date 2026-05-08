package com.intuit.playerui.plugins.devtools.profiler

import com.intuit.playerui.devtools.DevtoolsHandler
import com.intuit.playerui.devtools.DevtoolsPluginInteractionEvent
import com.intuit.playerui.plugins.devtools.profiler.ProfilerDevtoolsPlugin.Module.ProfilerDevtoolsPlugin
import com.intuit.playerui.utils.test.RuntimeTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ProfilerDevtoolsPluginTest : RuntimeTest(), DevtoolsHandler {

    private val interactions = mutableListOf<DevtoolsPluginInteractionEvent>()

    override fun processInteraction(interaction: DevtoolsPluginInteractionEvent) {
        interactions.add(interaction)
    }

    override fun checkIfDevtoolsIsActive(): Boolean = true

    private fun plugin(id: String = "test") =
        runtime.ProfilerDevtoolsPlugin(ProfilerDevtoolsPlugin.Options(id, this))

    // MARK: - Initialization

    @Test fun `plugin is active when handler reports active`() {
        assertTrue(plugin().checkIfDevtoolsIsActive())
    }

    @Test fun `playerID matches the id passed to options`() {
        val plugin = plugin("my-player")
        assertEquals("my-player", plugin.playerID)
    }

    @Test fun `pluginID is the profiler plugin id`() {
        val plugin = plugin()
        assertEquals("player-ui-profiler-plugin", plugin.pluginID)
    }

    @Test fun `store is accessible after construction`() {
        val plugin = plugin()
        assertNotNull(plugin.store.getState().node)
    }

    // MARK: - Interactions

    @Test fun `start-profiling interaction is handled without throwing`() {
        val plugin = plugin()
        plugin.processInteraction(interactionEvent("start-profiling"))
    }

    @Test fun `stop-profiling interaction is handled without throwing`() {
        val plugin = plugin()
        plugin.processInteraction(interactionEvent("stop-profiling"))
    }

    @Test fun `reset-profiling interaction is handled without throwing`() {
        val plugin = plugin()
        plugin.processInteraction(interactionEvent("reset-profiling"))
    }

    @Test fun `unknown interaction type is handled without throwing`() {
        val plugin = plugin()
        plugin.processInteraction(interactionEvent("unknown-interaction"))
    }
}

private fun interactionEvent(type: String) = DevtoolsPluginInteractionEvent(
    payload = DevtoolsPluginInteractionEvent.Payload(type = type, payload = ""),
    id = 0,
    timestamp = 0,
    sender = "test",
    context = kotlinx.serialization.json.JsonPrimitive("player"),
    tag = false,
)
