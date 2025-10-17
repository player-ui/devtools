# Wrap core
load("@rules_jvm_external//:defs.bzl", "artifact")
load("//helpers:jvm.bzl", "kt_jvm")

main_exports = [
    "//devtools/plugin/jvm:plugin",
]

main_deps = main_exports + []

main_resources = [
    "//devtools/plugins/basic/core:core_native_bundle",
]

test_deps = [
    artifact("com.intuit.playerui:testutils"),
    artifact("com.intuit.playerui:j2v8-all"),
]

kt_jvm(
    name = "plugin",
    group = "com.intuit.playerui.plugins.devtools.basic",
    main_deps = main_deps,
    main_exports = main_exports,
    main_resources = main_resources,
    test_deps = test_deps,
    test_package = "com.intuit.playerui.plugins.devtools.basic",
)
