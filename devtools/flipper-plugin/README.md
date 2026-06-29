# Flipper Devtools Plugin

The **Flipper Devtools Plugin** (`flipper-plugin-player-ui-devtools`) brings the
Player UI Devtools into [Flipper](https://fbflipper.com), Meta's mobile
debugging desktop app. It is the desktop counterpart for inspecting Players
running in a **mobile** app (iOS / Android) — the same role the browser
extension plays for web.

It is a thin shell: it wraps the shared [`@player-devtools/client`](../client)
`Panel` in a Flipper UI surface and supplies the `Panel` with a
`CommunicationLayerMethods` transport backed by Flipper's client messaging. All
the actual devtools UI and behavior live in the client; this package only
adapts Flipper's plumbing to the [transport contract](../types).

| Field | Value |
| --- | --- |
| Package | `flipper-plugin-player-ui-devtools` |
| Flipper `id` | `player-ui-devtools` |
| `pluginType` | `client` (a per-app-connection plugin) |
| Title | Player UI Devtools |

```
Mobile app (Player + native devtools plugin)
        │   Flipper client connection
        ▼
Flipper desktop  ──"message::plugin" (inbound)──▶  plugin()  ──▶  Panel (@player-devtools/client)
        ▲                                                              │
        └────────────  "message::flipper" (outbound)  ◀────────────────┘
```

## Installation & usage

> This is a **Flipper desktop plugin**, not an npm dependency you add to app
> code. You don't `npm install` it into a project — you install it into your
> local Flipper.

> **PREFERRED: let the MCP server do it for you.**
> The [MCP server](../mcp) starts and manages a `flipper-server` automatically —
> the first MCP process spawns it, the rest attach, and the last one out shuts it
> down (see the [shared daemon](../mcp#shared-flipper-server-daemon) section).
> If you're driving devtools through an agent, you don't need to install or run
> Flipper by hand at all; just run the MCP server. The manual Flipper steps below
> are for interactive, human-driven debugging in the Flipper desktop UI.

### Flipper desktop UI

1. Install **Flipper**:
   [fbflipper.com/docs/getting-started](https://fbflipper.com/docs/getting-started/#installation)
2. Install the `flipper-plugin-player-ui-devtools` plugin (see [Building &
   installing the plugin](#building--installing-the-plugin) to build it from this
   repo).
3. Enable the plugin.
4. Connect to your app, open the plugin, and start debugging.

### Building & installing the plugin

Flipper loads desktop plugins from `~/.flipper/installed-plugins`. This repo
provides a recipe that builds the plugin with Bazel and syncs it into that
directory:

```bash
just install-flipper-client
```

Under the hood that recipe:

1. bazel-builds `//devtools/flipper-plugin:flipper-plugin-player-ui-devtools`
   (stamped, so the version is real), then
2. `rsync`s `bazel-bin/devtools/flipper-plugin/flipper-plugin-player-ui-devtools/`
   into `~/.flipper/installed-plugins/flipper-plugin-player-ui-devtools/<VERSION>`.

Restart Flipper, run a mobile app that has a Player UI devtools plugin installed,
and the **Player UI Devtools** plugin appears for that app's connection.

> **NOTE**
> Re-run `just install-flipper-client` after changing this package (or the
> client) so Flipper picks up the rebuilt bundle.

### Troubleshooting

If the plugin doesn't appear, it's usually one of:

- `~/.flipper/installed-plugins` doesn't contain the plugin — re-run
  `just install-flipper-client`.
- Flipper isn't loading installed plugins — when running Flipper **from source**,
  start it with `--plugin-marketplace`; as an installed app this is on by default
  (verify in settings).
- When running Flipper from source, the plugin isn't listed in the
  `FLIPPER_ENABLED_PLUGINS` `.env` var.

When loaded correctly the plugin shows as **Unavailable** until an app requiring
it connects, then **Disabled** / **Enabled**.

## Public surface

`src/index.tsx` exports two things, which is the standard Flipper desktop-plugin
shape:

- **`plugin(client)`** — the plugin factory. Flipper calls it once per
  connection with a typed `PluginClient`, and it returns a
  **`CommunicationLayerMethods`** object (`sendMessage` / `addListener` /
  `removeListener`). That return value is what the rendered `Panel` consumes via
  `usePlugin`.
- **`Component`** — the React UI. It calls `usePlugin(plugin)` to get the
  communication layer and renders the client's `Panel` inside a Flipper
  `Layout.Container` (with a small scoped style fix).

### Message flow

The transport bridges Flipper's typed messaging to the devtools event stream
(both directions carry `MessengerEvent<ExtensionSupportedEvents>` from
[`@player-devtools/types`](../types)):

- **Inbound** — on connect, `plugin()` subscribes to Flipper's
  **`"message::plugin"`** event and fans each message out to the listeners the
  `Panel` registered through `addListener`.
- **Outbound** — `sendMessage` forwards to Flipper via the
  **`"message::flipper"`** method, which delivers it down to the connected
  mobile app's messenger.

## Related

- [`../client`](../client) — the `Panel` and devtools UI this plugin hosts; the
  same component the browser extension renders.
- [`../mcp`](../mcp) — the agent-facing devtools surface; an alternative consumer
  of the same Player devtools instrumentation.
- [`../README.md`](../../README.md) — the overall Player UI Devtools architecture.
