# This constructs the xcodeproj, including the demo app target and all individual targets
load("@rules_xcodeproj//xcodeproj:defs.bzl", "xcodeproj", "top_level_target")

xcodeproj(
    name = "xcodeproj",
    project_name = "DemoProject",
    tags = ["manual"],
    top_level_targets = [
        top_level_target("//ios/demo:DemoApp", target_environments = ["simulator"]),

        # Plugins. Add all plugin test targets here so the demo project can reference them.
        "//plugins/example-player/ios:ExamplePlayerPluginTests",
        # TODO: Add all other plugin test targets here
        "//plugins/fancy/swiftui:ExampleFancyPluginViewInspectorTests",

        # Assets. Add all asset test targets here so the demo project can reference them.
        # TODO: Add all asset test targets here
        "//assets/fancy-dog/swiftui:ExampleFancyDogAssetUITests",
        "//assets/fancy-dog/swiftui:ExampleFancyDogAssetViewInspectorTests",
    ],
)