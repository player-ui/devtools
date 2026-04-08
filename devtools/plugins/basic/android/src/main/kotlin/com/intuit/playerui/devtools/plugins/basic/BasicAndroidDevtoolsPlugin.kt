package com.intuit.playerui.devtools.plugins.basic

import androidx.annotation.StyleRes
import com.intuit.playerui.android.AndroidPlayer
import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.devtools.AndroidDevtoolsPlugin
import com.intuit.playerui.devtools.plugins.basic.BasicDevtoolsPlugin.Module.BasicDevtoolsPlugin
import com.intuit.playerui.devtools.plugins.basic.R

public class BasicAndroidDevtoolsPlugin(
    private val id: String,
    @StyleRes private val overlayStyle: Int? = R.style.BasicAndroidDevtoolsPlugin,
) : AndroidDevtoolsPlugin<BasicDevtoolsPlugin>() {
    override fun Runtime<*>.buildCorePlugin(): BasicDevtoolsPlugin =
        BasicDevtoolsPlugin(
            BasicDevtoolsPlugin.Options(id, this@BasicAndroidDevtoolsPlugin),
        )

    override fun apply(androidPlayer: AndroidPlayer) {
        if (!checkIfDevtoolsIsActive()) return

        super.apply(androidPlayer)

        overlayStyle?.let(::listOf)?.let {
            androidPlayer.hooks.context.tap(this::class.simpleName!!) { _, context ->
                androidPlayer.getCachedStyledContext(context, it)
            }
        }
    }
}
