// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

// --- START DECLARATIONS ---
// Declare dependencies up here to reduce the number of strings we have to type.

// Exclude items that are not part of the package, e.g. test folders and BUILD files.
// This will prevent us from exporting files that require test dependencies we don't include.
let excluded = ["ViewInspector", "UITests", "Tests", "BUILD"]

let playerUIDependency: Target.Dependency = .product(name: "PlayerUI", package: "playerui-swift-package")
let playerUILoggerDependency: Target.Dependency = .product(name: "PlayerUILogger", package: "playerui-swift-package")
let swiftFlipperDependency: Target.Dependency = .product(name: "SwiftFlipper", package: "SwiftFlipper")

let utils: Target = .target(
    name: "PlayerUIDevtoolsUtils",
    dependencies: [
        playerUIDependency
    ],
    path: "devtools/utils/ios",
    exclude: excluded
)

let utilsSwiftUI: Target = .target(
    name: "PlayerUIDevtoolsUtilsSwiftUI",
    dependencies: [
        playerUIDependency,
        playerUILoggerDependency
    ],
    path: "devtools/utils/swiftui",
    exclude: excluded
)

let types: Target = .target(
    name: "PlayerUIDevtoolsTypes",
    dependencies: [
        playerUIDependency,
        "PlayerUIDevtoolsUtils"
    ],
    path: "devtools/types/ios",
    exclude: excluded
)

let messenger: Target = .target(
    name: "PlayerUIDevtoolsMessenger",
    dependencies: [
        playerUIDependency,
        "PlayerUIDevtoolsTypes",
        "PlayerUIDevtoolsUtils"
    ],
    path: "devtools/messenger/ios",
    exclude: excluded,
    resources: [.process("Resources")]
)

let plugin: Target = .target(
    name: "PlayerUIDevtoolsPlugin",
    dependencies: [
        playerUIDependency,
        playerUILoggerDependency,
        swiftFlipperDependency,
        "PlayerUIDevtoolsTypes",
        "PlayerUIDevtoolsMessenger"
    ],
    path: "devtools/plugin/ios",
    exclude: excluded,
    resources: [.process("Resources")]
)

let swiftUIPlugin: Target = .target(
    name: "PlayerUIDevtoolsSwiftUIPlugin",
    dependencies: [
        playerUIDependency,
        "PlayerUIDevtoolsPlugin",
        "PlayerUIDevtoolsUtilsSwiftUI",
        playerUILoggerDependency
    ],
    path: "devtools/plugin/swiftui",
    exclude: excluded
)

let baseBasicDevtoolsPlugin: Target = .target(
    name: "PlayerUIDevtoolsBaseBasicDevtoolsPlugin",
    dependencies: [
        playerUIDependency,
        playerUILoggerDependency,
        "PlayerUIDevtoolsPlugin",
        "PlayerUIDevtoolsUtilsSwiftUI"
    ],
    path: "devtools/plugins/basic/ios",
    exclude: excluded,
    resources: [.process("Resources")]
)

let basicPlugin: Target = .target(
    name: "PlayerUIDevtoolsBasicPlugin",
    dependencies: [
        swiftFlipperDependency,
        "PlayerUIDevtoolsSwiftUIPlugin",
        "PlayerUIDevtoolsBaseBasicDevtoolsPlugin"
    ],
    path: "devtools/plugins/basic/swiftui",
    exclude: excluded
)

// --- END DECLARATIONS ---

let allTargets: [Target] = [
    utils,
    utilsSwiftUI,
    types,
    messenger,
    plugin,
    swiftUIPlugin,
    baseBasicDevtoolsPlugin,
    basicPlugin
]

// This is the Package.swift for our SPM release.
// During release, this file and the Swift sources will be published to:
// https://github.com/player-ui/devtools-ios
let package = Package(
    name: "PlayerUIDevtools", // Should match the package name in the BUILD file.
    platforms: [
        .iOS(.v16),
        // In an ideal world, we would not include macOS here. However, this is the most efficient way to support
        // Package.swift validation. (Which will try to run for MacOS by default.)
        .macOS(.v11)
    ],
    products: allTargets.map { .library(name: $0.name, targets: [$0.name]) },
    dependencies: [
        .package(url: "https://github.com/player-ui/playerui-swift-package.git", from: "0.11.2"),
        .package(url: "https://github.com/chiragramani/SwiftFlipper.git", from: "0.1.0"),
    ],
    targets: allTargets
)
