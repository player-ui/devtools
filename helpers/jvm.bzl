load("@build_constants//:constants.bzl", "GROUP", "VERSION")
load("@rules_player//kotlin:defs.bzl", _kt_jvm = "kt_jvm")

def kt_jvm(
        *,
        name,
        test_package = None,
        group = GROUP,
        lint_config = "//helpers:kt_lint_config",
        main_opts = "//helpers:kt_main_options",
        test_opts = "//helpers:kt_test_options",
        version = VERSION,
        **kwargs):
    _kt_jvm(
        name = name,
        group = group,
        lint_config = lint_config,
        main_opts = main_opts,
        test_opts = test_opts,
        test_package = test_package if test_package else group,
        version = version,
        **kwargs
    )
