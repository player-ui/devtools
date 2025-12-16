load("//helpers:ios.bzl", "swiftui_plugin")

swiftui_plugin(
    name = "Plugins",
    resources = ["//devtools/plugin/core:core_native_bundle"],
    deps = [
      "@swiftpkg_swiftflipper//:SwiftFlipper",
      "//devtools/types/ios:PlayerUIDevtoolsTypes",
      "//devtools/messenger/ios:PlayerUIDevtoolsMessenger",
      ],
    test_deps = [
      "@swiftpkg_playerui_swift_package//:PlayerUITestUtilitiesCore",
    ]
)