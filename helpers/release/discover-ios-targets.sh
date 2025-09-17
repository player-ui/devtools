#!/bin/bash

# Script to help discover targets that should be included in ios_spm_package
# This analyzes your codebase and suggests what to include
#
# Usage:
#   bazel run //:discover-ios-targets
#   OR
#   ./helpers/scripts/discover-ios-targets.sh
#
# Manual Discovery Commands:
#   # Find all Swift source targets:
#   bazel query "//plugins/... + //assets/..." | grep "_Sources$" | grep -E "(swiftui|ios)"
#
#   # Find all JS native bundles:
#   bazel query "//plugins/... + //assets/..." | grep ":core_native_bundle$"
#
#   # Find targets in a specific plugin:
#   bazel query "//plugins/YOUR_PLUGIN/..."

set -euo pipefail

echo "🔍 Discovering iOS targets for ios_spm_package..."
echo ""

# Find Swift source targets for plugins and assets
echo "📱 Swift Source Targets (for plugins/assets lists):"
echo "=================================================="
if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
    # Running through bazel run - change to workspace directory
    cd "$BUILD_WORKSPACE_DIRECTORY"
fi
SWIFT_SOURCES=$(bazel query "//plugins/... + //assets/..." 2>/dev/null | grep "_Sources$" | grep -E "(swiftui|ios)" | sort)

if [[ -n "$SWIFT_SOURCES" ]]; then
    echo "$SWIFT_SOURCES"
else
    echo "No Swift source targets found."
fi

echo ""

# Find JS native bundles that could be used as resourceTargets  
echo "📦 JS Native Bundles (for resourceTarget field):"
echo "================================================"
JS_BUNDLES=$(bazel query "//plugins/... + //assets/..." 2>/dev/null | grep ":core_native_bundle$" | sort)

if [[ -n "$JS_BUNDLES" ]]; then
    echo "$JS_BUNDLES"
else
    echo "No JS native bundles found."
fi

echo ""

# Try to suggest pairings
echo "💡 Suggested ios_spm_package Configuration:"
echo "==========================================="

# Process plugins
PLUGIN_SOURCES=$(echo "$SWIFT_SOURCES" | grep "//plugins/" || true)
if [[ -n "$PLUGIN_SOURCES" ]]; then
    echo "plugins = ["
    
    while IFS= read -r source_target; do
        if [[ -n "$source_target" ]]; then
            # Try to find corresponding JS bundle
            plugin_path=$(echo "$source_target" | sed 's|//plugins/\([^/]*\)/.*|\1|')
            js_bundle="//plugins/$plugin_path/core:core_native_bundle"
            
            # Check if JS bundle exists
            if echo "$JS_BUNDLES" | grep -q "^$js_bundle$"; then
                echo "    {"
                echo "        \"target\": \"$source_target\","
                echo "        \"resourceTarget\": \"$js_bundle\","
                echo "    },"
            else
                echo "    \"$source_target\",  # No JS bundle found"
            fi
        fi
    done <<< "$PLUGIN_SOURCES"
    
    echo "],"
fi

# Process assets
ASSET_SOURCES=$(echo "$SWIFT_SOURCES" | grep "//assets/" || true)
if [[ -n "$ASSET_SOURCES" ]]; then
    echo "assets = ["
    
    while IFS= read -r source_target; do
        if [[ -n "$source_target" ]]; then
            # Try to find corresponding JS bundle
            asset_path=$(echo "$source_target" | sed 's|//assets/\([^/]*\)/.*|\1|')
            js_bundle="//assets/$asset_path/core:core_native_bundle"
            
            # Check if JS bundle exists
            if echo "$JS_BUNDLES" | grep -q "^$js_bundle$"; then
                echo "    {"
                echo "        \"target\": \"$source_target\","
                echo "        \"resourceTarget\": \"$js_bundle\","
                echo "    },"
            else
                echo "    \"$source_target\",  # No JS bundle found"
            fi
        fi
    done <<< "$ASSET_SOURCES"
    
    echo "],"
fi

echo ""

echo ""
echo "📋 Usage Instructions:"
echo "====================="
echo "1. Copy the suggested configuration above to the BUILD file"
echo "2. Review each target and remove any you don't want to publish"
echo "3. Test with: bazel run //:ios-validate-release-package"