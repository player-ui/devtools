load("@build_constants//:constants.bzl", "GROUP", "VERSION")
load("@rules_jvm_external//:defs.bzl", "artifact")
load("@rules_player//kotlin:defs.bzl", _kt_android = "kt_android")

DEFAULT_INSTRUMENTED_DEPS = [
    "@rules_robolectric//bazel:android-all",
    artifact("org.robolectric:robolectric"),
    artifact("androidx.compose.ui:ui-test-manifest"),
    artifact("androidx.compose.ui:ui-test-junit4"),
]

def kt_android(
        *,
        name,
        group = GROUP,
        instrumented_test_deps = [],
        instrumented_test_opts = "//helpers:kt_test_options",
        lint_config = "//helpers:kt_lint_config",
        main_opts = "//helpers:kt_main_options",
        unit_test_opts = "//helpers:kt_test_options",
        version = VERSION,
        pom_template = "//helpers:pom.tpl",
        **kwargs):
    _kt_android(
        name = name,
        group = group,
        instrumented_test_deps = instrumented_test_deps + [dep for dep in DEFAULT_INSTRUMENTED_DEPS if dep not in instrumented_test_deps],
        instrumented_test_opts = instrumented_test_opts,
        lint_config = lint_config,
        main_opts = main_opts,
        unit_test_opts = unit_test_opts,
        version = version,
        pom_template = pom_template,
        **kwargs
    )
