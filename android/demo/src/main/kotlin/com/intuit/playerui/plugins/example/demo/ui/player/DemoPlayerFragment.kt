package com.intuit.playerui.devtools.example.demo.ui.player

import com.intuit.playerui.devtools.example.demo.ui.base.BasePlayerFragment

class DemoPlayerFragment : BasePlayerFragment() {
    override val flow: String get() = arguments?.getString("flow")!!
}
