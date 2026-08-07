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
