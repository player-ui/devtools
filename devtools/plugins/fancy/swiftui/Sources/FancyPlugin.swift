//
//  FancyPlugin.swift
//  PlayerUI
//

import PlayerUI
import PlayerUISwiftUI
import SwiftUICore

/**
 Wraps the core FancyPlugin
 This plugin will allow a user to toggle a "fancy" UI mode in the Player.
 */
public class FancyPlugin: JSBasePlugin, NativePlugin {
    private static let name = "FancyPlugin"
    private var isFancy: Bool = true

    public convenience init(isFancy: Bool = true) {
        self.init(
            fileName: "\(Self.name).native",
            pluginName: "\(Self.name).\(Self.name)"
        )
        self.isFancy = isFancy
    }

    public func apply<P>(player: P) where P: HeadlessPlayer {
        guard let player = player as? SwiftUIPlayer else { return }
        player.hooks?.view.tap(name: pluginName) { (view: AnyView) -> AnyView in
            return AnyView(view.environment(\.isFancy, self.isFancy))
        }
    }

    // This allows the base plugin to be loaded
    override open func getUrlForFile(fileName: String) -> URL? {
        ResourceUtilities.urlForFile(name: fileName, ext: "js", bundle: Bundle.module)
    }

    // Pass the isFancy argument to the JS plugin
    override open func getArguments() -> [Any] {
        return [isFancy]
    }
}

public extension EnvironmentValues {
    /// Whether or not to make the view fancy when rendered
    @Entry var isFancy: Bool = false
}
