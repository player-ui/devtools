load("@aspect_rules_js//js:defs.bzl", "js_library")
load("@aspect_rules_ts//ts:defs.bzl", "ts_config")
load("@npm//:defs.bzl", "npm_link_all_packages")
load("@rules_player//internal:defs.bzl", "stamp")
load("@rules_player//ios:defs.bzl", "assemble_pod", "ios_publish")
# load("@rules_swift_package_manager//swiftpkg:defs.bzl", "swift_update_packages")
# load("@bazel_gazelle//:def.bzl", "gazelle_binary", "gazelle")
load("//helpers:defs.bzl", "as_target")

##### Start user-defined variables #####
# TODO: Fill these out
project_name = "DevTools"
repo = "git@github.com:player-ui/devtools.git"
##### End user-defined variables #####

package(default_visibility = ["//visibility:public"])

###### Start JS ######
npm_link_all_packages(
    name = "node_modules",
)

exports_files([
    "VERSION",
    "tsconfig.json",
    ".eslintrc.js",
    ".prettierrc.js",
    "package.json",
    "vitest.config.mts",
    ".editorconfig",
    ".all-contributorsrc",
    "README.md",
])

js_library(
    name = "vitest_config",
    testonly = True,
    srcs = [
        "//helpers:vitest_setup",
        "vitest.config.mts",
    ],
    visibility = ["//visibility:public"],
    deps = [
        "//:node_modules/@testing-library/jest-dom",
        "//:node_modules/@testing-library/react",
        "//:node_modules/@testing-library/react-hooks",
        "//:node_modules/@testing-library/user-event",
        "//:node_modules/@vitest/coverage-v8",
        "//:node_modules/happy-dom",
        "//:node_modules/vitest",
        "//helpers:vitest_coverage_mapper",
    ],
)

js_library(
    name = "eslint_config",
    testonly = True,
    srcs = [
        "eslint.config.mts",
    ],
    visibility = ["//visibility:public"],
    deps = [
        ":node_modules/@eslint/js",
        ":node_modules/typescript-eslint",
        ":node_modules/eslint",
        ":node_modules/eslint-plugin-prettier",
        ":node_modules/eslint-plugin-react",
        ":node_modules/eslint-config-prettier",
        ":node_modules/jiti"
    ],
)

js_library(
    name = "tsup_config",
    srcs = [
        "tsup.config.ts",
    ],
    data = [":typings"],
    visibility = ["//visibility:public"],
    deps = [
        ":node_modules/@types/node",
        ":node_modules/tsup",
        ":node_modules/typescript",
        ":node_modules/vitest",
    ],
)

js_library(
    name = "typings",
    srcs = [
        "tsconfig.build.json",
        "tsconfig.json",
    ] + glob(["typings/*"], allow_empty=True),
    visibility = ["//visibility:public"],
)

ts_config(
    name = "tsconfig",
    src = "tsconfig.json",
    visibility = ["//visibility:public"],
)

###### End JS ######

###### Start iOS ######
# SwiftLint
exports_files([".swiftlint.yml"])



# Validation against the actual release package (what users will consume)
sh_binary(
    name = "ios-validate-release-package",
    srcs = ["//helpers/release:validate-release-package.sh"],
    data = ["//:ios_publish_package"],
    tags = ["manual"],
)

sh_binary(
    name = "ios-validate-release-package-verbose", 
    srcs = ["//helpers/release:validate-release-package.sh"],
    data = ["//:ios_publish_package"],
    args = ["--verbose"],
    tags = ["manual"],
)

# iOS target discovery helper
sh_binary(
    name = "discover-ios-targets",
    srcs = ["//helpers/release:discover-ios-targets.sh"],
    tags = ["manual"],
)

# iOS Swift Package Manager targets
load("//helpers:ios.bzl", "ios_spm_package")

# You can run `bazel run //:discover-ios-targets` to help you find the plugins/assets to include
ios_spm_package(
    name = "ios_publish",
    package_swift = "//:Package.swift",
    repository = "https://github.com/player-ui/devtools-ios.git",
    target_branch = "main",
    plugins = [
        {
            "target": "//plugins/fancy/swiftui:ExampleFancyPlugin_Sources",
            "resourceTarget": "//plugins/fancy/core:core_native_bundle",
        },
        {
            "target": "//plugins/example-player/ios:ExamplePlayerPlugin_Sources",
            "resourceTarget": "//plugins/example-player/core:core_native_bundle",
        },
    ],
    assets = [
        {
            "target": "//assets/fancy-dog/swiftui:ExampleFancyDogAsset_Sources",
            "resourceTarget": "//assets/fancy-dog/core:core_native_bundle",
        },
    ],
)

###### End iOS ######