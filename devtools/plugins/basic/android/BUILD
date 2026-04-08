# Android lib that consumes jvm similar to how react consumes core
load("@rules_jvm_external//:defs.bzl", "artifact")
load("//helpers:android.bzl", "kt_android")

main_exports = [
    "//devtools/plugin/android:plugin-android",
]

main_deps = main_exports + [
    "//devtools/plugins/basic/jvm:plugin",
]

main_resources = []

test_deps = [
    "//helpers:kotlin_serialization",
    artifact("com.intuit.playerui:testutils"),
    artifact("com.intuit.playerui:j2v8-all"),
]

kt_android(
    name = "basic-android",
    group = "%s.plugins" % GROUP,
    main_deps = main_deps,
    main_exports = main_exports,
    main_resources = main_resources,
    unit_test_deps = test_deps,
    unit_test_package = "com.intuit.playerui.devtools",
)

alias(
    name = "android",
    actual = "basic-android",
)
