load("@aspect_rules_js//js:defs.bzl", "js_run_binary")
load("@bazel_skylib//rules:expand_template.bzl", "expand_template")
load("@rules_player//player:defs.bzl", "compile", "compile_mocks")
load("@rules_player//javascript:defs.bzl", "js_pipeline")

COMMON_TEST_DEPS = [
    "//:node_modules/dlv",
    "//:vitest_config"
]

NATIVE_BUILD_DEPS = [
    "//:tsup_config",
    "//:typings",
    "//:node_modules/@swc/core",
]

def tsup_config(name):
    prefix = "../" * len(native.package_name().split("/"))

    expand_template(
        name = name,
        out = "tsup.config.ts",
        substitutions = {
            "%PREFIX%": prefix,
        },
        template = "//helpers:tsup.config.ts.tmpl",
    )

def vitest_config(name):
    prefix = "../" * len(native.package_name().split("/"))

    expand_template(
        name = name,
        out = "vitest.config.mts",
        substitutions = {
            "%PREFIX%": prefix,
        },
        template = "//helpers:vitest.config.mts.tmpl",
    )

def as_target(name): 
    """Helper function to convert a name to a target name."""
    return ":" + name

def dsl_pipeline(package_name, deps, dsl_input_dir, dsl_output_dir, config_file = None):
    """
    A macro that encapsulates the DSL compilation and js_pipeline rules.

    Args:
        package_name: The name of the package including the scope (@test/bar).
        deps: The dependencies for the package.
        dsl_input_dir: A string representing the input directory for the DSL compilation.
        dsl_output_dir: A string representing the output directory for the DSL compilation.
        config_file: Optional config file for DSL compilation.
    """
    name = native.package_name().split("/")[-1]
    binary_name = name + "_compile_dsl"
    binary_target = ":" + binary_name

    # Default config file if none provided
    if not config_file:
        config_file = dsl_input_dir + "/config.json"

    # Use the regular compile function but only compile the main content file
    # Get only the main DSL file in the content directory
    main_dsl_file = dsl_input_dir + "/index.tsx"
    
    # Include only the source files that are imported by the DSL files
    # Don't include test files or other non-DSL files
    dsl_related_sources = native.glob([
        "src/constants/**/*.ts*",
        "src/content/**/*.ts*"
    ], exclude = [main_dsl_file])
    
    compile(
        name = binary_name,
        srcs = [main_dsl_file],
        input_dir = dsl_input_dir,  # Use content dir so output goes directly to _generated
        output_dir = dsl_output_dir,
        config = config_file,
        data = deps + ["package.json"] + dsl_related_sources,
        skip_test = True,
    )

    js_pipeline(
        package_name = package_name,
        srcs = [binary_target] + native.glob(["src/**/*"]),
        deps = deps,
        test_deps = COMMON_TEST_DEPS
    )
