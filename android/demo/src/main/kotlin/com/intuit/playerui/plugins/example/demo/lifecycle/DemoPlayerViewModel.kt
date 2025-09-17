package com.intuit.playerui.devtools.example.demo.lifecycle

import com.intuit.playerui.android.AndroidPlayer
import com.intuit.playerui.android.lifecycle.PlayerViewModel
import com.intuit.playerui.core.managed.AsyncFlowIterator
import com.intuit.playerui.core.player.state.PlayerFlowState
import com.intuit.playerui.devtools.example.ExampleAndroidPlayerPlugin
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class DemoPlayerViewModel(
    iterator: AsyncFlowIterator,
) : PlayerViewModel(iterator) {
    override val plugins =
        listOf(
            ExampleAndroidPlayerPlugin(),
        )

    private val _playerFlowState = MutableStateFlow<PlayerFlowState?>(null)

    public val playerFlowState: StateFlow<PlayerFlowState?> = _playerFlowState.asStateFlow()

    override fun apply(androidPlayer: AndroidPlayer) {
        super.apply(androidPlayer)

        androidPlayer.hooks.state.tap { state ->
            _playerFlowState.tryEmit(state)
        }
    }
}
