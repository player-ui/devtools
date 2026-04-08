load("@aspect_rules_js//js:defs.bzl", "js_library")
load("@bazel_skylib//:bzl_library.bzl", "bzl_library")
load("@rules_kotlin//kotlin:core.bzl", "define_kt_toolchain", "kt_compiler_plugin", "kt_kotlinc_options")
load("@rules_kotlin//kotlin:jvm.bzl", "kt_jvm_library")
load("@rules_kotlin//kotlin:lint.bzl", "ktlint_config")
load("@rules_jvm_external//:defs.bzl", "artifact")

exports_files([
    "defs.bzl",
    "pom.tpl",
    "tsup.config.ts.tmpl",
    "vitest.config.mts.tmpl",
])

js_library(
    name = "vitest_setup",
    srcs = ["vitest.setup.ts"],
    visibility = ["//visibility:public"],
)

js_library(
    name = "vitest_coverage_mapper",
    srcs = ["vitest_coverage_mapper.ts"],
    visibility = ["//visibility:public"],
)

bzl_library(
    name = "defs",
    srcs = ["defs.bzl"],
    visibility = ["//visibility:public"],
)

# Common Kotlin setup
kt_compiler_plugin(
    name = "serialization_plugin",
    compile_phase = True,
    id = "org.jetbrains.kotlin.serialization",
    stubs_phase = True,
    deps = [
        "@rules_kotlin//kotlin/compiler:kotlinx-serialization-compiler-plugin",
    ],
)

kt_jvm_library(
    name = "kotlin_serialization",
    srcs = [],
    exported_compiler_plugins = [":serialization_plugin"],
    visibility = ["//visibility:public"],
    exports = ["@maven//:org_jetbrains_kotlinx_kotlinx_serialization_core_jvm"],
)

kt_compiler_plugin(
    name = "jetpack_compose_compiler_plugin",
    id = "androidx.compose.compiler.plugins.kotlin",
    options = {"sourceInformation": "true"},
    target_embedded_compiler = True,
    visibility = ["//visibility:public"],
    deps = [artifact("org.jetbrains.kotlin:kotlin-compose-compiler-plugin-embeddable")],
)

optins = [
    "kotlin.RequiresOptIn",
    "kotlinx.coroutines.ExperimentalCoroutinesApi",
    "com.intuit.playerui.core.utils.InternalPlayerApi",
    "com.intuit.playerui.core.experimental.ExperimentalPlayerApi",
]

# Common main Kotlin compiler options
kt_kotlinc_options(
    name = "kt_main_options",
    visibility = ["//visibility:public"],
    x_context_receivers = True,
    x_explicit_api_mode = "strict",
    x_optin = optins,
)

# Common test Kotlin compiler options
kt_kotlinc_options(
    name = "kt_test_options",
    visibility = ["//visibility:public"],
    x_context_receivers = True,
    x_optin = optins,
)

ktlint_config(
    name = "kt_lint_config",
    editorconfig = "//:.editorconfig",
    visibility = ["//visibility:public"],
)

define_kt_toolchain(
    name = "kotlin_toolchain",
    api_version = "1.8",
    kotlinc_options = ":kt_test_options",
    language_version = "1.8",
)
