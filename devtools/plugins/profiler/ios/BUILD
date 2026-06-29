load("//helpers:ios.bzl", "ios_library")

ios_library(
    name = "BaseProfilerDevtoolsPlugin",
    resources = ["//devtools/plugins/profiler/core:core_native_bundle"],
    deps = [
      "//devtools/plugin/ios:PlayerUIDevtoolsPlugin",
      "//devtools/utils/swiftui:PlayerUIDevtoolsUtilsSwiftUI",
    ],
)
