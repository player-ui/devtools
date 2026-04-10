load("@npm//:defs.bzl", "npm_link_all_packages")
load("@rules_player//javascript:defs.bzl", "js_pipeline")
load("//helpers:defs.bzl", "tsup_config", "vitest_config")

npm_link_all_packages(name = "node_modules")

tsup_config(name = "tsup_config")

vitest_config(name = "vitest_config")

js_pipeline(
    package_name = "@player-devtools/basic-plugin-react",
    deps = [
        ":node_modules/@player-devtools/basic-plugin",
        ":node_modules/@player-devtools/plugin-react",
        ":node_modules/@player-devtools/types",
        "//:node_modules/@devtools-ui/plugin",
        "//:node_modules/@player-ui/react",
        "//:node_modules/@types/react",
        "//:node_modules/@types/uuid",
        "//:node_modules/dequal",
        "//:node_modules/dset",
        "//:node_modules/immer",
        "//:node_modules/uuid",
    ],
)
