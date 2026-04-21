load("//helpers:ios.bzl", "ios_library")

ios_library(
    name = "ProfilerDevtoolsPlugin",
    resources = ["//devtools/plugins/profiler/core:core_native_bundle"],
    deps = [
      "//devtools/plugin/ios:PlayerUIDevtoolsPlugins",
      "//devtools/utils/swiftui:PlayerUIDevtoolsUtilsSwiftUI",
      "//devtools/plugin/swiftui:PlayerUIDevtoolsSwiftUIPlugins",
    ],
)
