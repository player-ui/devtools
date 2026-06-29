# Devtools Utils

The **Devtools Utils** family holds the small, dependency-free building blocks
the rest of the Player UI Devtools lean on: a minimal observable store and a
reference-preserving deep-assign on the TypeScript side, and the JavaScriptCore
bridging + polyfills the native runtimes need to host the JS core.

Nothing here is Player- or devtools-specific in its types — these are
general-purpose primitives — but they exist to serve the devtools, most notably
the immutable data-model updates the [plugins](../plugins) apply and the JS
runtime the [iOS plugins](../plugins) load.

This directory contains **three** published packages (plus one private,
test-only package):

| Package | Name / Product | Platform | Role |
| --- | --- | --- | --- |
| [`core`](#core--player-devtoolsutils) | `@player-devtools/utils` | TypeScript | `dsetAssign` (reference-preserving deep set) + a tiny `useStateReducer` store. |
| [`ios`](#ios--playeruidevtoolsutils) | `PlayerUIDevtoolsUtils` | Swift | JavaScriptCore bridging — construct/invoke JS classes safely from Swift. |
| [`swiftui`](#swiftui--playeruidevtoolsutilsswiftui) | `PlayerUIDevtoolsUtilsSwiftUI` | Swift | `setInterval` / `clearInterval` / `console` polyfills for the JS core. |

```
@player-devtools/utils  (TS: dsetAssign, useStateReducer)
        │  used by plugins/core for immutable data updates
        ▼
   plugins / client / ...

PlayerUIDevtoolsUtils (Swift: JSContext.construct, invokeMethodSafely)
PlayerUIDevtoolsUtilsSwiftUI (Swift: PolyfillPlugin)
        │  used by the native devtools plugins to host the JS core
        ▼
   plugins/ios, plugins/swiftui
```

## Installation

**Web / TypeScript** (npm):

```bash
npm install @player-devtools/utils
```

**iOS / SwiftUI** (Swift Package Manager — products of the `PlayerUIDevtools`
package at https://github.com/player-ui/player):

```swift
.product(name: "PlayerUIDevtoolsUtils", package: "PlayerUIDevtools")          // JSCore bridging
.product(name: "PlayerUIDevtoolsUtilsSwiftUI", package: "PlayerUIDevtools")   // polyfills
```

> Published versions are stamped at release time (sources here read
> `0.0.0-PLACEHOLDER`); pin the current release version when you add the
> dependency.

## `core` — `@player-devtools/utils`

A handful of zero-dependency TypeScript primitives.

### `dsetAssign`

A deep-set that **preserves references** for branches it doesn't change. This is
the key utility behind the devtools' incremental data-model updates: when a
plugin re-publishes a Player's data, only the touched branches get new object
identities, so subscribers (and React) don't see spurious changes across the
whole tree.

```ts
function dsetAssign<V>(
  obj: Record<string | number, unknown>,
  keys: Array<string | number>,   // path to the target location
  value: V,
  merge?: boolean,                 // default false
): void;
```

It walks `keys`, auto-vivifying intermediate objects, then deep-assigns `value`
into the existing slot in place rather than replacing it wholesale. The
deep-assign semantics (applied recursively) are:

- **Objects** — recurse into each source key, reusing the existing nested object
  so its reference and key insertion order survive. With `merge: false`
  (default), keys present in the target but **absent** from the source are
  **deleted**; with `merge: true` those stale keys are **kept**.
- **Arrays** — the target array is truncated/extended to the source length
  (unless `merge: true`, which only adds), then each element is recursed into.
- **Primitives / type mismatch** — there's no identity to retain, so the source
  value is assigned directly.

> **NOTE**
> The API is inspired by [`dset`](https://github.com/lukeed/dset); the difference
> is that `dsetAssign` mutates the existing value in place to retain references,
> rather than spreading new objects along the path. The `merge` flag is the
> dial between "make the target exactly match the source" (delete) and "layer
> the source on top" (merge). The [basic plugin](../plugins/basic) pairs this
> with `immer` to apply data updates immutably.

### `useStateReducer`

A minimal, framework-agnostic observable store — `getState` / `subscribe` /
`dispatch` over a reducer, with `subscribe` firing immediately with the current
state and returning an unsubscribe. Dispatches that don't change the state
(reference-equal result) skip notifying subscribers.

```ts
const store: Store<State, Action> = useStateReducer(reducer, initialState);
```

Also exported: the supporting types `Store`, `Reducer`, `Dispatch`,
`Subscriber`, `Subscribe`, and `Unsubscribe`.

## `ios` — `PlayerUIDevtoolsUtils`

Built with the [`ios_library`](../../README.md) macro (`PlayerUIDevtoolsUtils`),
this is the JavaScriptCore bridging layer the native devtools plugins use to
host the JS core. Its `JSContext` / `JSValue` extensions let Swift load and drive
a JS module:

- **`JSContext.construct(className:inModule:fromFile:inBundle:withArguments:)`** —
  evaluates a bundled `*.native.js` module, finds the exported class, constructs
  it with the given args, and throws a descriptive `JSBaseError` if the file,
  module, class, or construction fails (including surfacing JS exceptions).
- **`JSValue.invokeMethodSafely(_:withArguments:)`** — a guarded `invokeMethod`
  that turns missing methods, `undefined`/`null` results, and thrown JS
  exceptions into a `nil` return with a diagnostic log instead of a crash.

> **NOTE**
> These extensions are public but intended for **use within Devtools only** — the
> source carries an explicit warning to that effect. They are the seam that lets
> the Swift devtools plugins reuse the shared JS instrumentation rather than
> re-implementing it natively.

### `utils/ios/Resources/core` — internal/test-only

`utils/ios/Resources/core` builds a private JS bundle (package name
`@player-devtools/utils-test-do-not-export`, declared `private = True`) that
`PlayerUIDevtoolsUtils` loads in its tests. It is **internal/test-only** and is
intentionally excluded from the released package — there is no consumer install
path for it, so it has no installation instructions.

## `swiftui` — `PlayerUIDevtoolsUtilsSwiftUI`

Built with the [`swiftui_plugin`](../../README.md) macro
(`PlayerUIDevtoolsUtilsSwiftUI`). It provides the browser APIs the JS core
expects but that a `JSBasePlugin` runtime does not have:

- **`PolyfillPlugin`** — a `NativePlugin` that, on `apply`, installs polyfills
  onto the Player's `JSContext`: `setInterval` / `clearInterval` (backed by a
  shared timer manager) so the messenger's beacon scheduling works, and a
  `console.log` / `console.error` shim that prints. Add it **before** any plugin
  that depends on those APIs.

> **NOTE**
> `PolyfillPlugin` is currently gated behind upstream Player fixes
> ([player-ui/player#772](https://github.com/player-ui/player/issues/772),
> [#773](https://github.com/player-ui/player/issues/773)) — see the `TODO`s in
> the source. The `JSContext.polyfill()` extension it wraps is the part in active
> use.

## Related

- [`../plugins`](../plugins) — primary consumer of `dsetAssign` (data updates)
  and the native bridging/polyfills.
- [`../types`](../types) — `PlayerUIDevtoolsTypes` depends on
  `PlayerUIDevtoolsUtils`.
- [`../README.md`](../../README.md) — the overall Devtools architecture.
