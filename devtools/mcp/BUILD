load("@aspect_bazel_lib//lib:directory_path.bzl", "directory_path")
load("@aspect_rules_js//js:defs.bzl", "js_binary", "js_run_binary")
load("@npm//:defs.bzl", "npm_link_all_packages")
load("@rules_player//javascript:defs.bzl", "js_pipeline")
load("//helpers:defs.bzl", "tsup_config", "vitest_config")

npm_link_all_packages(name = "node_modules")

tsup_config(name = "tsup_config")

vitest_config(name = "vitest_config")

deps = [
    ":node_modules/@player-devtools/client",
    ":node_modules/@player-devtools/messenger",
    ":node_modules/@player-devtools/types",
    "//:node_modules/@modelcontextprotocol/sdk",
    "//:node_modules/@types/ws",
    "//:node_modules/flipper-server",
    "//:node_modules/flipper-server-client",
    "//:node_modules/ws",
    "//:node_modules/zod",
]

js_pipeline(
    package_name = "@player-devtools/mcp",
    deps = deps,
    srcs = glob(["src/**/*", "bin/**/*"])
)

directory_path(
    name = "entrypoint",
    directory = ":mcp",
    path = "bin/run",
)

js_binary(
    name = "start",
    entry_point = ":entrypoint",
    data = [":mcp"] + deps,
)

# directory_path(
#     name = "mcp_inspector_entry",
#     directory = "//:node_modules/@modelcontextprotocol/inspector/dir",
#     path = "cli/build/cli.js",
# )

# js_binary(
#     name = "mcp_inspector",
#     data = ["//:node_modules", ":mcp_server"],
#     entry_point = ":mcp_inspector_entry",
# )
