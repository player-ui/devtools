load("//helpers:ios.bzl", "swiftui_plugin")

swiftui_plugin(
    name = "DevtoolsPlugin",
    resources = ["//devtools/plugin/core:core_native_bundle"],
    deps = [
      "@swiftpkg_swiftflipper//:SwiftFlipper",
      "//devtools/types/ios:PlayerUIDevToolsTypes",
      "//devtools/messenger/ios:PlayerUIDevToolsMessenger",
      ],
    test_deps = []
)