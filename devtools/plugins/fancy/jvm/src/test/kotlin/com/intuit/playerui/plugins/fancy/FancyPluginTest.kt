package com.intuit.playerui.plugins.fancy

import com.intuit.playerui.utils.test.PlayerTest
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.TestTemplate

class FancyPluginTest : PlayerTest() {
    override val plugins = listOf(FancyPlugin(true))

    @TestTemplate fun `test plugin is loaded and applied`() {
        val plugin = player.fancyPlugin
        Assertions.assertNotNull(plugin)
        Assertions.assertTrue(plugin!!.isFancy)
    }
}
