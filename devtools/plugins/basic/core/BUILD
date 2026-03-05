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

content_entrypoint = ["src/content/index.tsx"]

# TODO: Figure out what to do here -- I didn't use helpers cause its so opinionated, I don't really think content deserves to be alongside the core code since it needs to be compiled separately and there are likely use cases that won't include a core impl, but this one shares constants
dsl_compile(
    name = "content",
    srcs = content_entrypoint,
    config = ":dsl_config",
    data = glob(
        ["src/content/**"],
        content_entrypoint,
    ) + [
        # All this to afford sharing constants between content and plugin
        ":src/constants.ts",
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
    package_name = "@player-devtools/basic-plugin",
    srcs = glob(
        ["src/**"],
        ["src/content/**"],
    ) + [":content"], # This is the generated DSL content
    native_bundle = "BasicDevtoolsPlugin",
    deps = [
        ":node_modules/@player-devtools/messenger",
        ":node_modules/@player-devtools/plugin",
        ":node_modules/@player-devtools/types",
        "//:node_modules/@devtools-ui/plugin",
        "//:node_modules/@player-ui/player",
        "//:node_modules/@types/react",
        "//:node_modules/@swc/core",
        "//:node_modules/dequal",
        "//:node_modules/dset",
        "//:node_modules/immer",
    ],
)
