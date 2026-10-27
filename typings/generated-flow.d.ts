// Fallback typing for the `dsl_compile` output (`_generated/flow.json`), which
// only exists in the Bazel output tree. A module that resolves to a real file
// always wins over a wildcard declaration, so Bazel builds still type-check the
// compiled JSON itself; this only lets a plain `tsc` over the source tree
// resolve the import.
declare module "*/_generated/flow.json" {
  const flow: import("@player-ui/types").Flow;
  export default flow;
}
