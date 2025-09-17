load("@rules_jvm_external//:defs.bzl", "artifact")
load("//helpers:jvm.bzl", "kt_jvm")

main_exports = [
  "//helpers:kotlin_serialization",
  artifact("com.intuit.playerui:core")
]

main_deps = main_exports

kt_jvm(
    name = "fancy-plugin",
    main_deps = main_deps,
    main_exports = main_exports,
    main_resources = ["//plugins/fancy/core:core_native_bundle"],
    test_package = "com.intuit.playerui.plugins.fancy",
    test_deps = [
      artifact("com.intuit.playerui:testutils"),
    ]
)
