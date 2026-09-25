# 0.16.0 (Thu Sep 24 2026)

### Release Notes

#### Add Flipper diagnostic and plugin-activation MCP tools ([#29](https://github.com/player-ui/devtools/pull/29))

Added seven new MCP tools for the shared `flipper-server` daemon and the devtools Flipper plugin:
- `get_flipper_connection_status` and `get_flipper_consumers` report connection health (host, port) and consumer info (ownership, refcount, active/connected clients).
- `restart_flipper_server` restarts the daemon when safe to do so, failing soft with a clear reason otherwise.
- `get_flipper_plugin_install_status` checks whether the Player UI Devtools Flipper plugin is installed on the daemon.
- `get_flipper_plugin_activation_status`, `enable_flipper_plugin`, and `disable_flipper_plugin` report and control per-client plugin activation, so an agent can activate the plugin for a connected client without a human driving the Flipper desktop UI.

All tools fail soft rather than throwing, consistent with the rest of the MCP tool surface. No breaking changes.

---

#### 🚀 Enhancement

- Add Flipper diagnostic and plugin-activation MCP tools [#29](https://github.com/player-ui/devtools/pull/29) ([@sugarmanz](https://github.com/sugarmanz))

#### Authors: 1

- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.15.1 (Thu Sep 24 2026)

### Release Notes

#### Fix Flipper connection race when multiple devtools plugins are registered ([#28](https://github.com/player-ui/devtools/pull/28))

Fixed a bug where mounting multiple Player instances with the devtools plugin at the same time could break the Flipper connection - including when those instances come from different bundled versions of the plugin in the same app. The connection now also recovers automatically if Flipper disconnects or fails to start on first try, and listeners are properly cleaned up when a Player instance unmounts.

#### Update Flipper connection docs and iOS SwiftFlipper dependency ([#31](https://github.com/player-ui/devtools/pull/31))

- iOS demo app now depends on the published `player-ui/SwiftFlipper` (`0.3.0`) and `player-ui/FlipperPluginUtils` (`0.1.0`) releases instead of unpublished dev forks/branches
- Docs-only changes to `CONNECTING_TO_FLIPPER.md` and `flipper-plugin/README.md` — no consumer-facing API or behavioral changes

---

#### 🐛 Bug Fix

- Fix Flipper connection race when multiple devtools plugins are registered [#28](https://github.com/player-ui/devtools/pull/28) ([@sugarmanz](https://github.com/sugarmanz))
- Update Flipper connection docs and iOS SwiftFlipper dependency [#31](https://github.com/player-ui/devtools/pull/31) ([@sugarmanz](https://github.com/sugarmanz))
- Release main [#30](https://github.com/player-ui/devtools/pull/30) ([@intuit-svc](https://github.com/intuit-svc))

#### Authors: 2

- [@intuit-svc](https://github.com/intuit-svc)
- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.15.2-next.0 (Tue Sep 22 2026)

### Release Notes

#### Update Flipper connection docs and iOS SwiftFlipper dependency ([#31](https://github.com/player-ui/devtools/pull/31))

- iOS demo app now depends on the published `player-ui/SwiftFlipper` (`0.3.0`) and `player-ui/FlipperPluginUtils` (`0.1.0`) releases instead of unpublished dev forks/branches
- Docs-only changes to `CONNECTING_TO_FLIPPER.md` and `flipper-plugin/README.md` — no consumer-facing API or behavioral changes

---

#### 🐛 Bug Fix

- Update Flipper connection docs and iOS SwiftFlipper dependency [#31](https://github.com/player-ui/devtools/pull/31) ([@sugarmanz](https://github.com/sugarmanz))

#### Authors: 1

- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.15.1 (Fri Sep 18 2026)

#### 🐛 Bug Fix

- Release main [#30](https://github.com/player-ui/devtools/pull/30) ([@intuit-svc](https://github.com/intuit-svc))

#### Authors: 1

- [@intuit-svc](https://github.com/intuit-svc)

---

# 0.15.0 (Wed Sep 16 2026)

### Release Notes

#### Configure Flipper server open URL, plugin install, and activation ([#24](https://github.com/player-ui/devtools/pull/24))

`@player-devtools/mcp` no longer requires any manual Flipper desktop app interaction to install or activate the Player UI Devtools plugin — the MCP server now installs the plugin (via Flipper's own plugin-management API) and activates it automatically for each connecting device. `FlipperServerTransport` gains `open`/`url` options for controlling whether/where a browser UI opens (env vars `PLAYER_DEVTOOLS_FLIPPER_OPEN`/`PLAYER_DEVTOOLS_FLIPPER_URL` for the CLI), and new `ensurePluginInstalled()`/`enablePlugin()`/`disablePlugin()` methods for consumers embedding the transport directly.

---

#### 🚀 Enhancement

- Configure Flipper server open URL, plugin install, and activation [#24](https://github.com/player-ui/devtools/pull/24) ([@sugarmanz](https://github.com/sugarmanz))

#### 🐛 Bug Fix

- Adds more detailed implementation documentation for connecting mobile player apps to flipper. [#27](https://github.com/player-ui/devtools/pull/27) (angela_villadiego@intuit.com)

#### Authors: 2

- Angela Villadiego ([@AngelaVilladiego](https://github.com/AngelaVilladiego))
- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.14.3-next.0 (Tue Sep 15 2026)

#### 🐛 Bug Fix

- Adds more detailed implementation documentation for connecting mobile player apps to flipper. [#27](https://github.com/player-ui/devtools/pull/27) (angela_villadiego@intuit.com)

#### Authors: 1

- Angela Villadiego ([@AngelaVilladiego](https://github.com/AngelaVilladiego))

---

# 0.14.2 (Thu Aug 06 2026)

### Release Notes

#### Add anonymous usage telemetry to the MCP server ([#22](https://github.com/player-ui/devtools/pull/22))

The MCP server now reports anonymous usage analytics — server starts, tool names, latency, and errors — so we can see how widely devtools is used and whether it works in the field.

**Tool arguments and tool responses are never transmitted.** Outgoing events are filtered through an allowlist of known-safe properties, so flow content cannot leave your machine.

Identity is a random UUID stored at `~/.player-ui-devtools/install.json`; delete the file to reset it. Opt out with `PLAYER_DEVTOOLS_TELEMETRY_DISABLED=1` or the cross-vendor `DO_NOT_TRACK=1`.

**Breaking:** `@player-devtools/mcp` now requires Node `^20.20.0 || >=22.22.0`.

#### Keep flipper diagnostics off the MCP stdout channel ([#21](https://github.com/player-ui/devtools/pull/21))

Fixes MCP protocol stream corruption. The Flipper transport wrote diagnostics to stdout — which the MCP stdio transport reserves for JSON-RPC — and let the spawned `flipper-server` daemon inherit that same stream. Both now write to stderr. MCP clients could previously see dropped or duplicated tool results, most often under heavy device-message traffic.

---

#### 🐛 Bug Fix

- Release main [#23](https://github.com/player-ui/devtools/pull/23) ([@intuit-svc](https://github.com/intuit-svc))
- Add anonymous usage telemetry to the MCP server [#22](https://github.com/player-ui/devtools/pull/22) ([@sugarmanz](https://github.com/sugarmanz))
- Keep flipper diagnostics off the MCP stdout channel [#21](https://github.com/player-ui/devtools/pull/21) ([@sugarmanz](https://github.com/sugarmanz))

#### Authors: 2

- [@intuit-svc](https://github.com/intuit-svc)
- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.14.2-next.1 (Thu Aug 06 2026)

### Release Notes

#### Add anonymous usage telemetry to the MCP server ([#22](https://github.com/player-ui/devtools/pull/22))

The MCP server now reports anonymous usage analytics — server starts, tool names, latency, and errors — so we can see how widely devtools is used and whether it works in the field.

**Tool arguments and tool responses are never transmitted.** Outgoing events are filtered through an allowlist of known-safe properties, so flow content cannot leave your machine.

Identity is a random UUID stored at `~/.player-ui-devtools/install.json`; delete the file to reset it. Opt out with `PLAYER_DEVTOOLS_TELEMETRY_DISABLED=1` or the cross-vendor `DO_NOT_TRACK=1`.

**Breaking:** `@player-devtools/mcp` now requires Node `^20.20.0 || >=22.22.0`.

---

#### 🐛 Bug Fix

- Add anonymous usage telemetry to the MCP server [#22](https://github.com/player-ui/devtools/pull/22) ([@sugarmanz](https://github.com/sugarmanz))

#### Authors: 1

- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.14.2-next.0 (Thu Aug 06 2026)

### Release Notes

#### Keep flipper diagnostics off the MCP stdout channel ([#21](https://github.com/player-ui/devtools/pull/21))

Fixes MCP protocol stream corruption. The Flipper transport wrote diagnostics to stdout — which the MCP stdio transport reserves for JSON-RPC — and let the spawned `flipper-server` daemon inherit that same stream. Both now write to stderr. MCP clients could previously see dropped or duplicated tool results, most often under heavy device-message traffic.

---

#### 🐛 Bug Fix

- Keep flipper diagnostics off the MCP stdout channel [#21](https://github.com/player-ui/devtools/pull/21) ([@sugarmanz](https://github.com/sugarmanz))

#### Authors: 1

- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.14.1 (Mon Jul 27 2026)

### Release Notes

#### Declare Player as a peer dependency and adopt Player 1.0 tooling scopes ([#19](https://github.com/player-ui/devtools/pull/19))

- The devtools plugins now declare `@player-ui/*` as **peer dependencies** (`>=0.15.4`). Consumers must provide a compatible `@player-ui/player` (plus `react`/`types`) — any version from `0.15.4` onward, including `1.x`, satisfies it.
- Build tooling migrated off the deprecated `@player-tools/*` scope to `@player-cli`, `@player-lang`, and `@xlr-lib`.

---

#### 🐛 Bug Fix

- Release main [#20](https://github.com/player-ui/devtools/pull/20) ([@intuit-svc](https://github.com/intuit-svc))
- Declare Player as a peer dependency and adopt Player 1.0 tooling scopes [#19](https://github.com/player-ui/devtools/pull/19) ([@sugarmanz](https://github.com/sugarmanz))

#### Authors: 2

- [@intuit-svc](https://github.com/intuit-svc)
- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.14.1-next.0 (Mon Jul 27 2026)

### Release Notes

#### Declare Player as a peer dependency and adopt Player 1.0 tooling scopes ([#19](https://github.com/player-ui/devtools/pull/19))

- The devtools plugins now declare `@player-ui/*` as **peer dependencies** (`>=0.15.4`). Consumers must provide a compatible `@player-ui/player` (plus `react`/`types`) — any version from `0.15.4` onward, including `1.x`, satisfies it.
- Build tooling migrated off the deprecated `@player-tools/*` scope to `@player-cli`, `@player-lang`, and `@xlr-lib`.

---

#### 🐛 Bug Fix

- Declare Player as a peer dependency and adopt Player 1.0 tooling scopes [#19](https://github.com/player-ui/devtools/pull/19) ([@sugarmanz](https://github.com/sugarmanz))

#### Authors: 1

- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.14.0 (Tue Jul 21 2026)

### Release Notes

#### Modularize the devtools client packages ([#17](https://github.com/player-ui/devtools/pull/17))

The devtools client is now split into focused packages so you only install what you use:

- **`@player-devtools/client`** — headless client (`createExtensionClient`, state reducer). No React dependency.
- **`@player-devtools/client-react`** — the React `Panel` and hooks. If you were importing `Panel` from `@player-devtools/client`, import it from `@player-devtools/client-react` instead:
  ```typescript
  import { Panel } from "@player-devtools/client-react";
  ```
- **`@player-devtools/client-flipper`** — the headless `FlipperServerTransport`, for connecting to a Player over a running `flipper-server` from any Node client.
- Node < 22 support for the MCP server

#### Player Devtools MCP ([#12](https://github.com/player-ui/devtools/pull/12))

Added `@player-devtools/mcp`, an MCP server that exposes the Player UI Devtools to AI agents. Point an MCP client at it over stdio:

```bash
claude mcp add player-devtools -- npx -y @player-devtools/mcp@latest
```

It connects to live Players through a shared `flipper-server` and exposes tools to list players, read flow/data/logs/plugin state, and invoke plugin actions. Also includes messenger routing fixes for reliable targeted message delivery and README documentation across the devtools workspace.

---

#### 🚀 Enhancement

- Player Devtools MCP [#12](https://github.com/player-ui/devtools/pull/12) ([@sugarmanz](https://github.com/sugarmanz))

#### 🐛 Bug Fix

- Release main [#18](https://github.com/player-ui/devtools/pull/18) ([@intuit-svc](https://github.com/intuit-svc))
- Modularize the devtools client packages [#17](https://github.com/player-ui/devtools/pull/17) ([@sugarmanz](https://github.com/sugarmanz))
- Fix profiler-plugin-react entry point [#16](https://github.com/player-ui/devtools/pull/16) ([@sugarmanz](https://github.com/sugarmanz))
- Add profiler plugin for each platform [#15](https://github.com/player-ui/devtools/pull/15) ([@tmarmer](https://github.com/tmarmer) [@sugarmanz](https://github.com/sugarmanz))
- Exclude fbjni transitive deps [#13](https://github.com/player-ui/devtools/pull/13) ([@sugarmanz](https://github.com/sugarmanz))
- Add ios-review skill stub referencing the main player-ui/player skill [#14](https://github.com/player-ui/devtools/pull/14) ([@KVSRoyal](https://github.com/KVSRoyal))

#### Authors: 4

- [@intuit-svc](https://github.com/intuit-svc)
- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))
- Koriann South ([@KVSRoyal](https://github.com/KVSRoyal))
- Thomas Marmer ([@tmarmer](https://github.com/tmarmer))

---

# 0.14.0-next.1 (Tue Jul 07 2026)

#### 🐛 Bug Fix

- Fix profiler-plugin-react entry point [#16](https://github.com/player-ui/devtools/pull/16) ([@sugarmanz](https://github.com/sugarmanz))

#### Authors: 1

- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.14.0-next.0 (Mon Jun 29 2026)

### Release Notes

#### Player Devtools MCP ([#12](https://github.com/player-ui/devtools/pull/12))

Added `@player-devtools/mcp`, an MCP server that exposes the Player UI Devtools to AI agents. Point an MCP client at it over stdio:

```bash
claude mcp add player-devtools -- npx -y @player-devtools/mcp@latest
```

It connects to live Players through a shared `flipper-server` and exposes tools to list players, read flow/data/logs/plugin state, and invoke plugin actions. Also includes messenger routing fixes for reliable targeted message delivery and README documentation across the devtools workspace.

---

#### 🚀 Enhancement

- Player Devtools MCP [#12](https://github.com/player-ui/devtools/pull/12) ([@sugarmanz](https://github.com/sugarmanz))

#### 🐛 Bug Fix

- Add profiler plugin for each platform [#15](https://github.com/player-ui/devtools/pull/15) ([@tmarmer](https://github.com/tmarmer) [@sugarmanz](https://github.com/sugarmanz))
- Exclude fbjni transitive deps [#13](https://github.com/player-ui/devtools/pull/13) ([@sugarmanz](https://github.com/sugarmanz))
- Add ios-review skill stub referencing the main player-ui/player skill [#14](https://github.com/player-ui/devtools/pull/14) ([@KVSRoyal](https://github.com/KVSRoyal))

#### Authors: 3

- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))
- Koriann South ([@KVSRoyal](https://github.com/KVSRoyal))
- Thomas Marmer ([@tmarmer](https://github.com/tmarmer))

---

# 0.13.0 (Tue Apr 07 2026)

#### 🚀 Enhancement

- Client implementation + Flipper fixes [#7](https://github.com/player-ui/devtools/pull/7) ([@sugarmanz](https://github.com/sugarmanz))

#### 🐛 Bug Fix

- Release main [#11](https://github.com/player-ui/devtools/pull/11) ([@intuit-svc](https://github.com/intuit-svc))
- Add `pom.xml` details [#9](https://github.com/player-ui/devtools/pull/9) ([@sugarmanz](https://github.com/sugarmanz))
- fix release script [#8](https://github.com/player-ui/devtools/pull/8) ([@sugarmanz](https://github.com/sugarmanz))

#### ⚠️ Pushed to `main`

- module lock ([@sugarmanz](https://github.com/sugarmanz))
- update auto plugins and fix next ([@sugarmanz](https://github.com/sugarmanz))

#### Authors: 2

- [@intuit-svc](https://github.com/intuit-svc)
- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))

---

# 0.13.0-next.0 (Tue Apr 07 2026)

#### 🚀 Enhancement

- Client implementation + Flipper fixes [#7](https://github.com/player-ui/devtools/pull/7) ([@sugarmanz](https://github.com/sugarmanz))

#### 🐛 Bug Fix

- Add `pom.xml` details [#9](https://github.com/player-ui/devtools/pull/9) ([@sugarmanz](https://github.com/sugarmanz))
- fix release script [#8](https://github.com/player-ui/devtools/pull/8) ([@sugarmanz](https://github.com/sugarmanz))

#### ⚠️ Pushed to `main`

- module lock ([@sugarmanz](https://github.com/sugarmanz))
- update auto plugins and fix next ([@sugarmanz](https://github.com/sugarmanz))

#### Authors: 1

- Jeremiah Zucker ([@sugarmanz](https://github.com/sugarmanz))
