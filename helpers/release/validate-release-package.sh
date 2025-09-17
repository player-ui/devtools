#!/bin/bash

# Script to validate the actual iOS release package
# This extracts the zip that gets published and validates it works correctly

set -euo pipefail

# Parse command line arguments
VERBOSE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [-v|--verbose]"
            exit 1
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# When running through Bazel, use BUILD_WORKSPACE_DIRECTORY, otherwise calculate from script location
if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
    ROOT_DIR="$BUILD_WORKSPACE_DIRECTORY"
else
    ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

# Output helper functions
log_info() {
    echo "$1"
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo "$1"
    fi
}

log_step() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo "$1"
    else
        echo -n "."
    fi
}

# Cleanup function
cleanup() {
    log_verbose "🧹 Cleaning up temporary files..."
    cd "$ROOT_DIR" 2>/dev/null || true
    rm -rf /tmp/ReleasePackageValidation/ 2>/dev/null || true
}

# Clean up any previous validation files
rm -rf /tmp/ReleasePackageValidation/ 2>/dev/null || true

# Set trap to ensure cleanup happens on exit
trap cleanup EXIT

log_info "📦 Validating iOS Release Package..."
if [[ "$VERBOSE" != "true" ]]; then
    echo -n "📦 "
fi

# Change to root directory
cd "$ROOT_DIR"

# Build the iOS release package
log_step "🏗️ Building iOS release package..."
if [[ "$VERBOSE" == "true" ]]; then
    bazel build //:ios_publish_package
else
    bazel build //:ios_publish_package > /dev/null 2>&1
fi

# Find the generated zip file
ZIP_FILE_RELATIVE=$(bazel cquery --output=files //:ios_publish_package 2>/dev/null)
ZIP_FILE="$ROOT_DIR/$ZIP_FILE_RELATIVE"
if [[ ! -f "$ZIP_FILE" ]]; then
    log_info "❌ Could not find generated iOS package zip file at: $ZIP_FILE"
    log_info "   Relative path was: $ZIP_FILE_RELATIVE"
    exit 1
fi

log_verbose "📦 Found release package: $ZIP_FILE"

# Create validation directory and extract the package
log_step "📦 Extracting release package..."
mkdir -p /tmp/ReleasePackageValidation/
cd /tmp/ReleasePackageValidation/

# Extract the zip file
if [[ "$VERBOSE" == "true" ]]; then
    unzip "$ZIP_FILE"
else
    unzip "$ZIP_FILE" > /dev/null 2>&1
fi

log_verbose "📂 Package contents:"
if [[ "$VERBOSE" == "true" ]]; then
    find . -type f -name "*.swift" | sort
fi

# Verify Package.swift exists
if [[ ! -f "Package.swift" ]]; then
    log_info "❌ Package.swift not found in release package!"
    exit 1
fi

log_step "🔍 Analyzing release Package.swift..."

# Extract product names from the Package.swift in the release package
PRODUCTS_JSON=$(swift package dump-package | jq -r '.products[] | select(.type.executable == null) | .name')
PRODUCTS_ARRAY=()
while IFS= read -r line; do
    if [[ -n "$line" ]]; then
        PRODUCTS_ARRAY+=("$line")
    fi
done <<< "$PRODUCTS_JSON"

log_verbose "📦 Available products: ${PRODUCTS_ARRAY[*]}"

# Verify Package.swift structure
log_step "📦 Validating Package.swift structure..."
if swift package dump-package > /dev/null 2>&1; then
    log_verbose "✅ Package.swift structure is valid!"
else
    log_info "❌ Package.swift has structural errors!"
    exit 1
fi

# Resolve dependencies
log_step "🔗 Resolving dependencies..."
if [[ "$VERBOSE" == "true" ]]; then
    swift package resolve
else
    swift package resolve > /dev/null 2>&1
fi

# Show dependency tree
log_step "🔗 Verifying dependency tree..."
if [[ "$VERBOSE" == "true" ]]; then
    swift package show-dependencies
else
    swift package show-dependencies > /dev/null 2>&1
fi

# Test that each product can be built independently
log_step "🏗️ Testing product builds..."
for product in "${PRODUCTS_ARRAY[@]}"; do
    log_verbose "  🏗️ Building product: $product"
    if swift build --product "$product" > /dev/null 2>&1; then
        log_verbose "  ✅ $product builds successfully"
    else
        log_info "  ❌ Product '$product' failed to build!"
        log_info "  ℹ️  This is the actual package that will be published!"
        log_info "  🔍 Detailed build error:"
        swift build --product "$product"
        log_info "  💡 Fix the issues above and try again"
        exit 1
    fi
done

# Create a test app that depends on this package (similar to how users would consume it)
log_step "📝 Creating consumer validation app..."
mkdir -p /tmp/ReleasePackageValidation/TestConsumer/Sources/TestConsumer

# Generate Swift import statements
SWIFT_IMPORTS=""
for product in "${PRODUCTS_ARRAY[@]}"; do
    SWIFT_IMPORTS="$SWIFT_IMPORTS
import $product"
done

# Create test consumer app
cat > /tmp/ReleasePackageValidation/TestConsumer/Sources/TestConsumer/main.swift << EOF
import Foundation$SWIFT_IMPORTS

func validateReleasePackage() {
    print("🧪 Testing release package imports...")
    print("🎉 All release package products imported successfully!")
    print("📦 This validates the exact package that users will consume!")
}
validateReleasePackage()
EOF

# Generate dependencies for consumer
SWIFT_DEPS=""
for product in "${PRODUCTS_ARRAY[@]}"; do
    if [[ -n "$SWIFT_DEPS" ]]; then
        SWIFT_DEPS="$SWIFT_DEPS,
                "
    fi
    SWIFT_DEPS="$SWIFT_DEPS.product(name: \"$product\", package: \"ReleasePackageValidation\")"
done

# Create Package.swift for consumer that depends on the release package
cat > /tmp/ReleasePackageValidation/TestConsumer/Package.swift << EOF
// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "TestConsumer",
    platforms: [
        .iOS(.v16),
        .macOS(.v11)
    ],
    products: [
        .executable(name: "TestConsumer", targets: ["TestConsumer"])
    ],
    dependencies: [
        // Depend on the release package as a local dependency
        .package(path: "../")
    ],
    targets: [
        .executableTarget(
            name: "TestConsumer",
            dependencies: [
                $SWIFT_DEPS
            ]
        )
    ]
)
EOF

# Test the consumer app
cd /tmp/ReleasePackageValidation/TestConsumer/

log_step "🔗 Testing consumer dependency resolution..."
if [[ "$VERBOSE" == "true" ]]; then
    swift package resolve
else
    swift package resolve > /dev/null 2>&1
fi

log_step "🏗️ Testing consumer app build..."
if [[ "$VERBOSE" == "true" ]]; then
    swift build
else
    swift build > /dev/null 2>&1
fi

if [[ "$VERBOSE" != "true" ]]; then
    echo ""  # New line after dots
fi

log_info "🎉 Release package validation completed successfully!"
log_info "   ✅ The iOS release package is valid and ready for publishing!"
log_info "   ✅ All products build correctly in the release package!"
log_info "   ✅ Consumer apps can successfully depend on the release package!"