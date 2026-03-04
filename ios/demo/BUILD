load("@build_bazel_rules_apple//apple:ios.bzl", "ios_application")
load("@build_bazel_rules_apple//apple:resources.bzl", "apple_resource_bundle")
load("@rules_swift//swift:swift_library.bzl", "swift_library")

swift_library(
    name = "DemoSources",
    srcs = glob(["Sources/**/*.swift"]),
    data = [":Mocks",],
    # If you add to any of these, you'll need to regenerate the xcodeproj
    deps = [
        # These are the packages needed by the development package or demo app itself.
        # DO NOT put packages that require XCTest here (i.e. UI test dependencies).
        "@swiftpkg_playerui_swift_package//:PlayerUI",
        "@swiftpkg_playerui_swift_package//:PlayerUISwiftUI",
        "@swiftpkg_playerui_swift_package//:PlayerUIReferenceAssets",
        "@swiftpkg_playerui_swift_package//:PlayerUIPrintLoggerPlugin",
        "@swiftpkg_swift_hooks//:SwiftHooks",
        "@swiftpkg_swiftflipper//:SwiftFlipper",

        # These are the components under development.
        "//devtools/plugin/ios:PlayerUIDevtoolsPlugins",
        "//devtools/plugins/basic/swiftui:PlayerUIDevtoolsBasicPlugin",
        "//devtools/plugins/profiler/ios:PlayerUIDevToolsProfilerDevtoolsPlugin",
    ]
)

# A provisioning profile is needed if you are trying to build for a physical device.
provisioning_profiles = glob(["ProvisioningProfile/*.mobileprovision"], allow_empty = True)
provisioning_profile = provisioning_profiles[0] if len(provisioning_profiles) > 0 else None

# This generates the demo app target
ios_application(
    name = "DemoApp",
    bundle_id = "com.intuit.DemoApp",
    provisioning_profile = provisioning_profile,
    families = [
        "iphone",
        "ipad",
    ],
    infoplists = ["Resources/Info.plist"],
    minimum_os_version = "15.0",
    visibility = ["//visibility:public"],
    deps = [":DemoSources"],
)

 # Mock targets that are used in the demo app.
apple_resource_bundle(
    name = "Mocks",
    structured_resources = [
        "//helpers/mocks:all_mocks"
    ]
)