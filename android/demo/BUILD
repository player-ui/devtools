load("@rules_android//android:rules.bzl", "android_binary")
load("@rules_jvm_external//:defs.bzl", "artifact")
load("@rules_player//kotlin:defs.bzl", "kt_android")

kt_android(
    name = "lib",
    lint_config = "//helpers:kt_lint_config",
    main_deps = [
        "//plugins/example-player/android:plugin-android",
        artifact("androidx.appcompat:appcompat"),
        artifact("androidx.navigation:navigation-fragment-ktx"),
        artifact("androidx.navigation:navigation-runtime"),
        artifact("androidx.navigation:navigation-ui-ktx"),
        artifact("com.afollestad.material-dialogs:core"),
        artifact("com.eclipsesource.j2v8:j2v8"),
        artifact("com.facebook.soloader:soloader"),
        artifact("com.google.android.material:material"),
        artifact("com.intuit.playerui:utils"),
        "//helpers/mocks:jar",
    ],
)

android_binary(
    name = "demo",
    assets = glob(
        ["src/main/assets/mocks/**"],
        allow_empty = True,
    ),
    assets_dir = "src/main/assets",
    custom_package = "com.intuit.playerui.plugins.example.demo",
    dex_shards = 4,
    manifest = ":src/main/AndroidManifest.xml",
    multidex = "native",
    resource_files = glob(
        ["src/main/res/**"],
        allow_empty = True,
    ),
    deps = [":lib"],
)

# TODO: Only necessary while bug exists in mobile-install trimming resources
sh_binary(
    name = "install",
    srcs = [":androidinstall.sh"],
    data = [":demo"],
    deps = [],
)
