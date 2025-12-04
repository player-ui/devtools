package com.intuit.playerui.devtools

import com.facebook.flipper.android.AndroidFlipperClient
import com.intuit.playerui.android.AndroidPlayer
import com.intuit.playerui.android.AndroidPlayerPlugin
import com.intuit.playerui.core.bridge.runtime.Runtime
import com.intuit.playerui.core.player.state.ReleasedState
import com.intuit.playerui.core.plugins.LoggerPlugin
import com.intuit.playerui.core.plugins.RuntimePlugin

public abstract class AndroidDevtoolsPlugin<T : DevtoolsPlugin> : DevtoolsHandler, AndroidPlayerPlugin, RuntimePlugin {

    private var flipperPlugin: PlayerDevtoolsFlipperPlugin? = null
        get() = field ?: AndroidFlipperClient.getInstanceIfInitialized()
            ?.getPluginByClass(PlayerDevtoolsFlipperPlugin::class.java)
            ?.also { field = it }

    private var logger: LoggerPlugin? = null

    protected lateinit var corePlugin: T; private set

    public val playerID: String get() = corePlugin.playerID

    public val store: PluginStore get() = corePlugin.store

    public abstract fun Runtime<*>.buildCorePlugin(): T

    final override fun apply(runtime: Runtime<*>) {
        corePlugin = runtime.buildCorePlugin()
    }

    override fun apply(androidPlayer: AndroidPlayer) {
        if (!checkIfDevtoolsIsActive()) return
        val flipperPlugin = flipperPlugin ?: return
        if (!::corePlugin.isInitialized) {
            androidPlayer.logger.warn("Core plugin not initialized, can't apply ${this::class.simpleName}")
            return
        }

        val messenger = Messenger(
            Messenger.Options(
                id = playerID,
                context = TransactionMetaData.Context.PLAYER,
                messageCallback = this.store::dispatch,
                sendMessage = flipperPlugin::sendMessage,
                addListener = flipperPlugin::addListener,
                removeListener = flipperPlugin::removeListener,
                logger = androidPlayer.logger::debug,
                // TODO: Make this configurable
                debug = true,
            )
        )

        messenger.apply(corePlugin.node.runtime)
        corePlugin.registerMessenger(messenger)
        corePlugin.apply(androidPlayer.player)
N 
        androidPlayer.hooks.state.tap("AndroidDevtoolsPlugin") { state ->
            if (state is ReleasedState) {
                // messenger and core plugin are already gone at this point
                flipperPlugin.removeListener(messenger)
            }
        }
    }

    override fun processInteraction(interaction: DevtoolsPluginInteractionEvent): Unit = Unit

    final override fun checkIfDevtoolsIsActive(): Boolean = flipperPlugin != null
}
