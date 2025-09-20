// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

// These are the dependencies for the demo app + testing. They are not used by the plugins themselves.
// This will NOT be used for any releases.
let package = Package(
    name: "DemoBazelDependencies",
    platforms: [
        .iOS(.v15)
    ],
    products: [],
    dependencies: [
        // Dependencies needed by the development package. This should be the exact same as the one in the root Package.swift.
        // Just copy it over.
        .package(url: "https://github.com/intuit/swift-hooks.git", from: "0.1.0"),
        .package(url: "https://github.com/player-ui/playerui-swift-package.git", from: "0.11.2"),

        // Formatting Dependencies
        .package(url: "https://github.com/realm/SwiftLint.git", from: "0.54.0"), // REQUIRED. Do not remove.

        // Testing Dependencies
        .package(url: "https://github.com/nalexn/viewinspector.git", from: "0.10.2") // REQUIRED. Do not remove.
    ],
    targets: []
)
