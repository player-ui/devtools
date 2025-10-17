package com.intuit.playerui.plugins.devtools.basic

import com.intuit.playerui.android.AndroidPlayer
import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.devtools.AndroidDevtoolsPlugin
import com.intuit.playerui.plugins.devtools.basic.BasicDevtoolsPlugin.Module.BasicDevtoolsPlugin
import com.intuit.playerui.plugins.devtools.basic.R

public class BasicAndroidDevtoolsPlugin(private val id: String) : AndroidDevtoolsPlugin<BasicDevtoolsPlugin>() {
    override fun Runtime<*>.buildCorePlugin(): BasicDevtoolsPlugin = BasicDevtoolsPlugin(
        BasicDevtoolsPlugin.Options(id, this@BasicAndroidDevtoolsPlugin)
    )

    override fun apply(androidPlayer: AndroidPlayer) {
        if (!checkIfDevtoolsIsActive()) return

        super.apply(androidPlayer)

        androidPlayer.hooks.context.tap(this::class.simpleName!!) { _, context ->
            androidPlayer.getCachedStyledContext(context, listOf(R.style.Devtools))
        }
    }
}

