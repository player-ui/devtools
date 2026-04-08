# ios/justfile contains the iOS-specific helpers
mod ios

[doc('Test targets in the project')]
test-all:
  bazel test -- $(bazel query "//... except filter('ios|swiftui', //...)" --output label 2>/dev/null | tr '\n' ' ')
  bazel test -- $(bazel query "kind('ios_unit_test|ios_ui_test', //...)" --output label 2>/dev/null | tr '\n' ' ')

[doc('Build all core files required for native development')]
build-cores:
  bazel build -- $(bazel query "attr(name, 'native_bundle', //...)" --output label 2>/dev/null | tr '\n' ' ')

[doc('Build all JS/TS files')]
build-js:
  bazel build -- $(bazel query "kind(npm_package, //...)" --output label 2>/dev/null | tr '\n' ' ')

[doc('Test all JS/TS files')]
test-js:
  bazel test -- $(bazel query "kind(js_test, //...)" --output label 2>/dev/null | tr '\n' ' ')

[doc('Lint all JS/TS files')]
lint-js:
  bazel test -- $(bazel query "kind(js_test, //...) intersect attr(name, 'eslint$', //...)" --output label 2>/dev/null | tr '\n' ' ')

[doc('Test all Kotlin unit tests (kt_jvm_test)')]
test-kt:
  bazel test $(bazel query --noshow_progress --output=label "kind('kt_jvm_test rule', //...)" | tr '\n' ' ')

[doc('Test KT for lint errors')]
lint-kt:
  bazel test $(bazel query --noshow_progress --output=label "kind('ktlint_test rule', //...)" | tr '\n' ' ')

[doc('Fix all auto-fixable KT lint errors')]
format-kt:
  #!/usr/bin/env bash
  set -u +e -o pipefail

  for target in $(bazel query --noshow_progress --output=label "kind('ktlint_fix rule', //...)"); do
    bazel run "$target"
  done

[doc('Resolve Maven lockfile after modifying @maven dependencies')]
mvn-pin-lockfile:
  REPIN=1 bazel run @maven//:pin

[doc('Install all Maven artifacts into the users .m2 repository')]
mvn install:
  #!/usr/bin/env bash
  set -u -e -o pipefail

  # Find all the maven packages in the repo
  readonly DEPLOY_LABELS=$(bazel query --output=label 'kind("maven_publish rule", //...) - attr("tags", "\[.*do-not-publish.*\]", //...)')
  for pkg in $DEPLOY_LABELS ; do
    bazel run "$pkg" --define=maven_repo="file://$HOME/.m2/repository"
  done

[doc('Installs Flipper plugin (flipper-plugin-player-ui-devtools) locally to ~/.flipper/install-plugins')]
install-flipper-client:
    #!/usr/bin/env bash
    set -e

    VERSION=$(cat VERSION)
    FLIPPER_INSTALL_LOCATION="$HOME/.flipper/installed-plugins"
    PLUGIN_NAME="flipper-plugin-player-ui-devtools"
    PREFIX="devtools/flipper-plugin"

    INSTALL_LOCATION=$FLIPPER_INSTALL_LOCATION/$PLUGIN_NAME/$VERSION

    bazel build --stamp --workspace_status_command=./helpers/release/workspace-status.sh //$PREFIX:$PLUGIN_NAME

    echo "Installing $PLUGIN_NAME@$VERSION to $INSTALL_LOCATION"

    mkdir -p $INSTALL_LOCATION
    rsync -a --delete bazel-bin/$PREFIX/$PLUGIN_NAME/. $INSTALL_LOCATION/
    chown -R $(whoami) $INSTALL_LOCATION


[doc('Run the MCP server (requires a running Flipper server on localhost:52342)')]
mcp:
  bazel run //devtools/mcp:mcp_server

[doc('Open MCP inspector against the MCP server')]
mcp-inspect:
  bazel run //devtools/mcp:inspect

clean: # Force delete all the cached bazel stuff. Be careful!
    # Delete all the bazel build artifacts
    rm -rf .build
    rm -rf .bazel-*

    # Delete iOS stuff
    rm -rf ios/demo/.build
    rm -rf ios/demo/.swiftpm
    rm -rf ios/DemoProject.xcodeproj

    # Delete all node_modules folders
    npx npkill -D -y

    # Then expunge for good measure
    bazel clean --expunge --async