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

js_pipeline(
    package_name = "@player-devtools/basic-plugin",
    srcs = glob(["src/**"]),
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