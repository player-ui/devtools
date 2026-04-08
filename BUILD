load("@aspect_rules_js//js:defs.bzl", "js_library")
load("@aspect_rules_ts//ts:defs.bzl", "ts_config")
load("@npm//:defs.bzl", "npm_link_all_packages")
load("@rules_player//ios:defs.bzl", "assemble_ios_release", "spm_publish")

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
assemble_ios_release(
    name = "spm_publish_zip",
    data = {
        "//:Package.swift": "",
        "//:LICENSE": "",

        # Utils
        "//devtools/utils/ios:PlayerUIDevtoolsUtils_Sources": "devtools/utils/ios/",

        # UtilsSwiftUI
        "//devtools/utils/swiftui:PlayerUIDevtoolsUtilsSwiftUI_Sources": "devtools/utils/swiftui/",

        # Types
        "//devtools/types/ios:PlayerUIDevtoolsTypes_Sources": "devtools/types/ios/",

        # Messenger
        "//devtools/messenger/ios:PlayerUIDevtoolsMessenger_Sources": "devtools/messenger/ios/",
        "//devtools/messenger/core:core_native_bundle": "devtools/messenger/ios/Resources/",

        # Plugin
        "//devtools/plugin/ios:PlayerUIDevtoolsPlugin_Sources": "devtools/plugin/ios/",
        "//devtools/plugin/core:core_native_bundle": "devtools/plugin/ios/Resources/",

        # SwiftUIPlugin
        "//devtools/plugin/swiftui:PlayerUIDevtoolsSwiftUIPlugin_Sources": "devtools/plugin/swiftui/",

        # BaseBasicDevtoolsPlugin
        "//devtools/plugins/basic/ios:PlayerUIDevtoolsBaseBasicDevtoolsPlugin_Sources": "devtools/plugins/basic/ios/",
        "//devtools/plugins/basic/core:core_native_bundle": "devtools/plugins/basic/ios/Resources/",

        # BasicPlugin
        "//devtools/plugins/basic/swiftui:PlayerUIDevtoolsBasicPlugin_Sources": "devtools/plugins/basic/swiftui/",
    },
)

spm_publish(
    name = "spm_publish",
    repository = "git@github.com:player-ui/devtools-ios.git",
    zip = "//:spm_publish_zip",
)

###### End iOS ######