package com.intuit.playerui.plugins.example.demo.ui.player

import com.intuit.playerui.plugins.example.demo.ui.base.BasePlayerFragment

class DemoPlayerFragment : BasePlayerFragment() {
    override val flow: String get() = arguments?.getString("flow")!!
}
