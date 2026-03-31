load("@npm//:defs.bzl", "npm_link_all_packages")
load("@rules_player//javascript:defs.bzl", "js_pipeline")
load("@rules_player//player:defs.bzl", "dsl_compile", create_base_dsl_config = "create_base_config")
load("//helpers:defs.bzl", "tsup_config", "vitest_config")

npm_link_all_packages(name = "node_modules")

tsup_config(name = "tsup_config")

vitest_config(name = "vitest_config")

create_base_dsl_config(
    name = "dsl_config",
    presets = [],
)

entrypoint = ["src/flow.tsx"]

dsl_compile(
    name = "compiled_flow",
    srcs = entrypoint,
    config = ":dsl_config",
    data = glob(
        ["src/**"],
        entrypoint,
    ) + [
        "//:node_modules/@devtools-ui/plugin",
        "//:node_modules/@player-tools/dsl",
        "//:node_modules/@player-ui/common-types-plugin",
        "//:node_modules/react",
    ],
    input_dir = "src",
    output_dir = "_generated",
    skip_test = True,
)

js_pipeline(
    package_name = "@player-devtools/basic-plugin-content",
    srcs = [
        "src/constants.ts",
        "src/index.ts",
        ":compiled_flow",
    ],
    deps = [
        ":node_modules/@player-devtools/types",
    ],
)
