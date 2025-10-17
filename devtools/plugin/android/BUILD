load("@rules_jvm_external//:defs.bzl", "artifact")
load("//helpers:android.bzl", "kt_android")

main_exports = [
    "//devtools/plugin/jvm:plugin",
    artifact("com.intuit.playerui:android"),
]

main_deps = main_exports + [
    artifact("com.facebook.flipper:flipper"),
]

main_resources = [
    "//devtools/messenger/core:core_native_bundle",
]

test_deps = [
    "//helpers:kotlin_serialization",
    artifact("com.intuit.playerui:testutils"),
    artifact("com.intuit.playerui:j2v8-all"),
]

kt_android(
    name = "plugin-android",
    main_deps = main_deps,
    main_exports = main_exports,
    main_resources = main_resources,
    unit_test_deps = test_deps,
    unit_test_package = "com.intuit.playerui.devtools",
)
