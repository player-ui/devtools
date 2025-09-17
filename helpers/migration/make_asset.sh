#!/bin/zsh
# Usage: ./helpers/make_asset.sh asset-folder-name
# Creates a new asset in the assets folder by copying and updating the example asset.
# Made with Copilot.

set -e

# Check for parameter
if [ -z "$1" ]; then
  echo "Usage: $0 asset-folder-name (kebab-case)"
  exit 1
fi

ASSET_FOLDER_NAME="$1"
# Convert kebab-case to PascalCase and append 'Asset' for iOS class names
ASSET_NAME_PASCAL=$(echo "$ASSET_FOLDER_NAME" | awk -F'-' '{for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) substr($i,2) }}1' OFS='')
ASSET_NAME_CAMEL="${ASSET_NAME_PASCAL}Asset"
ASSET_NAME_SNAKE=$(echo $ASSET_FOLDER_NAME | sed 's/-/_/g')_asset
# camelCase for transform function/variable: e.g. koriTest
ASSET_NAME_CAMELCASE=$(echo "$ASSET_FOLDER_NAME" | awk -F'-' '{for(i=1;i<=NF;i++){ $i=(i==1?tolower(substr($i,1,1)):toupper(substr($i,1,1))) substr($i,2) }}1' OFS='')
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE_ASSET_DIR="$REPO_ROOT/assets/example"
NEW_ASSET_DIR="$REPO_ROOT/assets/$ASSET_FOLDER_NAME"

# 1. Copy core and swiftui folders
mkdir -p "$NEW_ASSET_DIR"
cp -R "$EXAMPLE_ASSET_DIR/core" "$NEW_ASSET_DIR/"
cp -R "$EXAMPLE_ASSET_DIR/swiftui" "$NEW_ASSET_DIR/"

# 2. Replace names in all files in the new asset directory
find "$NEW_ASSET_DIR" -type f | while read file; do
  sed -i '' "s/ExampleAsset/$ASSET_NAME_CAMEL/g" "$file"
  sed -i '' "s/example-asset/$ASSET_FOLDER_NAME/g" "$file"
  sed -i '' "s/example_asset/$ASSET_NAME_SNAKE/g" "$file"
  sed -i '' "s/exampleTransformFunction/${ASSET_NAME_CAMELCASE}TransformFunction/g" "$file"
  sed -i '' "s/exampleTransform/${ASSET_NAME_CAMELCASE}Transform/g" "$file"
  sed -i '' "s/example/$ASSET_FOLDER_NAME/g" "$file"
  # Only replace 'Example' with the PascalCase asset name (without 'Asset') if not part of 'ExampleAsset'
  sed -i '' "s/Example/$ASSET_NAME_PASCAL/g" "$file"
done

# 3. Rename test files and Swift files
find "$NEW_ASSET_DIR" -type f -name 'ExampleAsset*' | while read file; do
  newfile=$(echo "$file" | sed "s/ExampleAsset/$ASSET_NAME_CAMEL/g")
  mv "$file" "$newfile"
done

cat <<EOM
✅ Asset "$ASSET_FOLDER_NAME" created in assets/$ASSET_FOLDER_NAME.

Next steps:
- Fix package name in core/package.json and core/BUILD
- Run "pnpm install" to register the new package (if pnpm-workspace.yaml exists)
- Add your new asset's UI and ViewInspector tests to ios/BUILD.bazel
- Verification Step ✅: Verify everything is working.
  - Generate the xcodeproj with "bazel run //ios:xcodeproj" and open it.
  - Switch to the ViewInspector test scheme for your new asset in Xcode.
  - Run the ViewInspector tests in Xcode.
  - If they do not pass, something is wrong with your asset setup that must be fixed before continuing.
- Update the new files to customize your asset logic and types.
<<EOM