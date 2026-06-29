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
