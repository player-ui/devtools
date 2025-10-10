load("@rules_jvm_external//:defs.bzl", "artifact")
load("//helpers:jvm.bzl", "kt_jvm")

main_exports = [
    "//helpers:kotlin_serialization",
    artifact("com.intuit.playerui:core"),
]

main_deps = main_exports + [
    artifact("com.intuit.playerui.plugins:set-time-out"),
]

main_resources = [
    "//devtools/messenger/core:core_native_bundle",
]

test_deps = [
    "//helpers:kotlin_serialization",
    artifact("com.intuit.playerui:testutils"),
    artifact("com.intuit.playerui:j2v8-all"),
]

kt_jvm(
    name = "messenger",
    main_deps = main_deps,
    main_exports = main_exports,
    main_resources = main_resources,
    test_deps = test_deps,
    test_package = "com.intuit.playerui.devtools",
)
