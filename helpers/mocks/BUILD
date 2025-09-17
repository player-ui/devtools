load("@rules_player//player:defs.bzl", generate_mocks_manifest = "generate_mocks_manifest")
load("@aspect_rules_js//npm:defs.bzl", "npm_package")

PLUGIN_MOCKS = [ # TODO: Add all plugins here
    "example-player",
]

# This one is used directly by iOS, and indirectly by the other platforms.
filegroup(
    name = "all_mocks",
    srcs = ["//plugins/{}/mocks".format(plugin) for plugin in PLUGIN_MOCKS],
    visibility = ["//visibility:public"],
)

generate_mocks_manifest(
    name = "manifest",
    mocks = [":all_mocks"],
)

npm_package(
    name = "mocks",
    visibility = ["//visibility:public"],
    package = "@player-devtools/mocks", # TODO: Change this to match your project
    srcs = [
        ":manifest",
        "package.json"
    ],
    tags = ["do-not-publish"],
)

java_library(
    name = "jar",
    resource_strip_prefix = "helpers",
    resources = [":manifest"],
    visibility = ["//visibility:public"],
)
