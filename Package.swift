// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

// --- START DECLARATIONS ---
// Declare dependencies up here to reduce the number of strings we have to type.

// Exclude items that are not part of the package, e.g. test folders and BUILD files.
// This will prevent us from exporting files that require test dependencies we don't include.
let excluded = ["ViewInspector", "UITests", "Tests", "BUILD"]

let playerUIDependency: Target.Dependency = .product(name: "PlayerUI", package: "playerui-swift-package")
let playerUISwiftUIDependency: Target.Dependency = .product(name: "PlayerUISwiftUI", package: "playerui-swift-package")

// TODO: Add your plugins here. Remember to prefix them with the same prefix as in helpers/ios.bzl.
let messengerPlugin: Target = .target(
    name: "PlayerUIDevToolsMessenger",
    dependencies: [
        playerUIDependency,
        playerUISwiftUIDependency
    ],
    path: "devtools/messenger/ios",
    exclude: excluded,
    resources: [.process("Resources")]
)

// --- END DECLARATIONS ---

// This is the Package.swift for our SPM release.
// During release, this file and the Swift sources will be published to:
// https://github.com/player-ui/devtools-ios
let package = Package(
    name: "PlayerUIDevTools", // Should match the package name in the BUILD file.
    platforms: [
        .iOS(.v16),
        // In an ideal world, we would not include macOS here. However, this is the most efficient way to support
        // Package.swift validation. (Which will try to run for MacOS by default.)
        .macOS(.v11) 
    ],
    products: [
        .library(
            name: messengerPlugin.name,
            targets: [messengerPlugin.name]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/player-ui/playerui-swift-package.git", from: "0.11.2"),
        .package(url:"https://github.com/chiragramani/SwiftFlipper.git", from: "0.1.0"),
    ],
    targets: [messengerPlugin]
)
