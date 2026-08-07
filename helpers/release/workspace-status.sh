#!/usr/bin/env bash

set -eo pipefail # exit immediately if any command fails.

echo STABLE_GIT_COMMIT $(git rev-parse HEAD)
echo STABLE_VERSION $(cat VERSION)

commit_sha=$(git rev-parse HEAD)
echo "COMMIT_SHA $commit_sha"

git_branch=$(git rev-parse --abbrev-ref HEAD)
echo "GIT_BRANCH $git_branch"

git_tree_status=$(git diff-index --quiet HEAD -- && echo 'Clean' || echo 'Modified')
echo "GIT_TREE_STATUS $git_tree_status"

# PostHog telemetry ingestion key, supplied by the CI environment.
#
# This is a *public, write-only* project key (`phc_...`): it can only send
# events and cannot read anything back, which is why it is safe to bake into a
# published package. Do not put a personal (`phx_`) or project-secret (`phs_`)
# key here — those are real credentials and this value is stamped into build
# artifacts and the shared remote cache.
#
# Emitted unconditionally so the key is part of the cache key: a changed key
# must invalidate stamped artifacts rather than leave a stale one cached. When
# unset the build stamps an empty string and telemetry stays disabled.
echo "STABLE_POSTHOG_KEY ${POSTHOG_PROJECT_KEY:-}"