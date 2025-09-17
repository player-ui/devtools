# #!/usr/bin/env bash
# # See https://github.com/bazelbuild/rules_nodejs/blob/stable/scripts/publish_release.sh 

# set -e -u -o pipefail

# readonly PKG_NPM_LABELS=`bazel query --output=label 'kind("npm_package rule", //...) - attr("tags", "\[.*do-not-publish.*\]", //...)'`
# NPM_TAG=canary

# # Called by auto -- `release` for normal releases or `snapshot` for canary/next.
# readonly RELEASE_TYPE=${1:-snapshot}
# readonly CURRENT_BRANCH=`git symbolic-ref --short HEAD`

# if [ "$RELEASE_TYPE" == "snapshot" ] && [ "$CURRENT_BRANCH" == "main" ]; then
#   NPM_TAG=next
# elif [ "$RELEASE_TYPE" == "release" ] && [ "$CURRENT_BRANCH" == "main" ]; then
#   # Releases off the main branch are for older majors. 
#   # Don't want to bump the latest tag for those
#   NPM_TAG=latest
# fi

# # TODO: Replace w/ Artifactory Maven release repo
# MAVEN_REPO="maven.dynexpdev-dynexpren.playerplatform-releases"
# if [ "$RELEASE_TYPE" == "snapshot" ]; then
#   # Need to add snapshot identifier for snapshot releases
#   cp VERSION VERSION.bak
#   echo -n -SNAPSHOT >> VERSION
#   # TODO: Replace w/ Artifactory Maven snapshot repo
#   MAVEN_REPO="maven.dynexpdev-dynexpren.playerplatform-snapshots"
# fi

# readonly DEPLOY_LABELS=`bazel query --output=label "kind('maven_publish rule', ${2:-//...})"`
# # publish one package at a time to make it easier to spot any errors or warnings
# for pkg in $DEPLOY_LABELS ; do
#   bazel run --define "maven_repo=TODO" $pkg
# done

# # Cleanup
# if [ -f VERSION.bak ]; then
#   rm VERSION
#   mv VERSION.bak VERSION
# fi
# # JS Publish prebuild
# bazel build --config=release $PKG_NPM_LABELS

# # JS Publish execute
# for pkg in $PKG_NPM_LABELS ; do
#   bazel run --config=release -- ${pkg}.npm-publish --access public --tag ${NPM_TAG}
# done

# # iOS Release
# # Ensure Git credentials are available for Bazel iOS publishing
# if [[ -n "${GITHUB_USER:-}" ]] && [[ -n "${GITHUB_TOKEN:-}" ]]; then
#   echo "Setting up Git credentials for iOS publishing..."
#   echo "https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com" >> /tmp/gitcredfile
#   git config --global credential.helper "store --file=/tmp/gitcredfile"
#   git config --global user.name "${GITHUB_USER}"
#   # TODO: Change this to your team's email
#   git config --global user.email "player-team@intuit.com"
# fi
# echo "Publishing iOS Swift Package to GitHub"
# bazel run --config=release //:ios_publish