package com.intuit.playerui.plugins.devtools.profiler

import androidx.annotation.StyleRes
import com.intuit.playerui.android.AndroidPlayer
import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.devtools.AndroidDevtoolsPlugin
import com.intuit.playerui.plugins.devtools.profiler.ProfilerDevtoolsPlugin.Module.ProfilerDevtoolsPlugin

public class ProfilerAndroidDevtoolsPlugin(
    private val id: String,
    @StyleRes private val overlayStyle: Int? = R.style.ProfilerAndroidDevtoolsPlugin,
) : AndroidDevtoolsPlugin<ProfilerDevtoolsPlugin>() {
    override fun Runtime<*>.buildCorePlugin(): ProfilerDevtoolsPlugin =
        ProfilerDevtoolsPlugin(
            ProfilerDevtoolsPlugin.Options(id, this@ProfilerAndroidDevtoolsPlugin),
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
