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

[doc('Run a dev server of the main docs page')]
start-docs:
  bazel run //docs/site:start

[doc('Run a dev server of storybook')]
start-storybook:
  bazel run //docs/storybook:start

[doc('Install all Maven artifacts into the users .m2 repository')]
mvn install:
  #!/usr/bin/env bash
  set -u -e -o pipefail

  # Find all the maven packages in the repo
  readonly DEPLOY_LABELS=$(bazel query --output=label 'kind("maven_publish rule", //...) - attr("tags", "\[.*do-not-publish.*\]", //...)')
  for pkg in $DEPLOY_LABELS ; do
    bazel run "$pkg" --define=maven_repo="file://$HOME/.m2/repository"
  done

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