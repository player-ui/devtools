// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

// ⚠️⚠️⚠️⚠️⚠️⚠️⚠️ //
// NOTE: When this file is changed, navigate to the directory of this file and run the 
// following commands for the changes to take effect:
// swift package update
// bazel mod tidy
// ⚠️⚠️⚠️⚠️⚠️⚠️⚠️ //

/* SPM doesn't isolate dependencies that are not used by products. So relying on a tool, like 
SwiftLint, a consuming user will still need to resolve that even though they would not use 
it. This can cause conflicts for packages not used by the product at runtime

So this file is used to generate dependencies for bazel so we can keep the actual 
Package.swift clean since the spm rules for bazel only work from a Package.swift */
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
        .package(url:"https://github.com/chiragramani/SwiftFlipper.git", branch: "0.1"),

        // Formatting Dependencies
        .package(url: "https://github.com/realm/SwiftLint.git", from: "0.54.0"), // REQUIRED. Do not remove.

        // Testing Dependencies
        .package(url: "https://github.com/nalexn/viewinspector.git", from: "0.10.2") // REQUIRED. Do not remove.
    ],
    targets: []
)
