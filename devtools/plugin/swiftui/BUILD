load("//helpers:ios.bzl", "swiftui_plugin")

swiftui_plugin(
    name = "SwiftUIPlugins",
    deps = [
        "//devtools/plugin/ios:PlayerUIDevtoolsPlugins",
        "//devtools/utils/swiftui:PlayerUIDevtoolsUtilsSwiftUI",
        "@swiftpkg_playerui_swift_package//:PlayerUILogger",
    ],
    test_deps = [
        "@swiftpkg_playerui_swift_package//:PlayerUITestUtilitiesCore",
    ]
)

