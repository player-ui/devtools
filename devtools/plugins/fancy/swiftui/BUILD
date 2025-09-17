load("//helpers:ios.bzl", "swiftui_plugin")

swiftui_plugin(
    # TODO: change this to the name you want
    # This name should always match the "native_bundle" field in ../core/BUILD
    name = "FancyPlugin",
    # This "core_native_bundle" bazel target is auto-generated provided the ../core is set-up properly
    resources = ["//plugins/fancy/core:core_native_bundle"],
    # To use an external dependency:
    # 1. Add it as normal in the Package.swift file
    # 2. Find use_repo in the top-level MODULE.bazel file. Add the package to the use_repo list,
    #   e.g. if the package is PlayerUISwiftPackage, add "swiftpkg_playerui_swift_package".
    # 3. Reference the dependency here in deps using the format:
    #    @swiftpkg_{package_name}//:{product_name}
    #    For example, if you added PlayerUISwiftUI, you would use:
    #    @swiftpkg_playerui_swift_package//:PlayerUISwiftUI
    deps = [],
    test_deps = []
)