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
        "//devtools/messenger/ios:PlayerUIDevtoolsMessengerTests",
        "//devtools/utils/ios:PlayerUIDevtoolsUtilsTests",
        "//devtools/utils/swiftui:PlayerUIDevtoolsUtilsSwiftUIViewInspectorTests",
        "//devtools/types/ios:PlayerUIDevtoolsTypesTests",
        "//devtools/plugin/ios:PlayerUIDevtoolsPluginViewInspectorTests",
        "//devtools/plugin/swiftui:PlayerUIDevtoolsSwiftUIPluginViewInspectorTests",
        "//devtools/plugins/basic/ios:PlayerUIDevtoolsBaseBasicDevtoolsPluginTests",
        "//devtools/plugins/basic/swiftui:PlayerUIDevtoolsBasicPluginViewInspectorTests",
    ],
)