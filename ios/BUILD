# This constructs the xcodeproj, including the demo app target and all individual targets
load("@rules_xcodeproj//xcodeproj:defs.bzl", "xcodeproj", "top_level_target")

# Xcode project for development and testing
xcodeproj(
    name = "xcodeproj",
    project_name = "DemoProject",
    tags = ["manual"],
    top_level_targets = [
        top_level_target("//ios/demo:DemoApp", target_environments = ["simulator"]),

        # Add all test targets here. ONLY test targets should go here
        "//devtools/messenger/ios:PlayerUIDevToolsMessengerTests",
        "//devtools/utils/ios:PlayerUIDevToolsUtilsTests",
        "//devtools/types/ios:PlayerUIDevToolsTypesTests",
        "//devtools/plugin/ios:PlayerUIDevToolsPluginsViewInspectorTests",
        "//devtools/plugins/basic/ios:PlayerUIDevToolsBasicCoreWrapperTests",
        "//devtools/plugins/basic/swiftui:PlayerUIDevToolsBasicPluginViewInspectorTests",
    ],
)