# @player-devtools/mcp

An [MCP](https://modelcontextprotocol.io) server that exposes the Player UI
Devtools to AI agents. It lets a model — e.g. Claude — inspect and drive a live
Player instance: list running Players, read their flow / data / logs / config,
inspect plugin state, select a Player, and invoke plugin actions.

It is the agent-facing sibling of the [browser extension] and the
[Flipper plugin](../flipper-plugin): all three are Devtools *clients* that speak
to the same Player Devtools plugins over the [messenger](../messenger) protocol.
The MCP server connects to those plugins through a running
[`flipper-server`](https://github.com/facebook/flipper) and re-exposes them as
MCP tools over stdio.

```
agent (Claude) ──stdio/MCP──▶ MCPServer ──▶ ExtensionClient ──▶ FlipperServerTransport
                                                                       │
                                                          flipper-server (localhost:52342)
                                                                       │
                                                            Player Devtools plugins
```

## Installation

The package ships a CLI, `player-devtools-mcp`, which is what an MCP client runs.

### Register with Claude Code

Add it as an MCP server with `claude mcp add` — no env vars or tokens are
required:

```bash
claude mcp add player-devtools -- npx -y @player-devtools/mcp@latest
```

That runs the server over stdio via `npx` (no global install needed). To pin a
version, replace `@latest`. To point at a non-default Flipper server, pass the
host/port through the CLI after `--` (see [Transport](#transport)).

> **NOTE**
> You do **not** need to install or start Flipper first — the server starts and
> manages a shared `flipper-server` for you (see
> [Shared `flipper-server` daemon](#shared-flipper-server-daemon)).

### Other MCP clients

Any MCP client that launches a stdio command works — point it at
`npx -y @player-devtools/mcp@latest` (or the `player-devtools-mcp` bin if you've
installed the package). To install the package directly:

```bash
npm install @player-devtools/mcp
```

See [Running](#running) for the bin and the in-repo `just` recipes.

## Tools

The server registers the following tools (defined as `ToolDef`s in
[`src/tools`](./src/tools) and registered in one loop in `MCPServer`). Every
player-scoped tool takes an optional `playerId` and falls back to the currently
selected Player when it's omitted.

| Tool | Args | Returns |
| --- | --- | --- |
| `list_players` | — | All known Player instances and which one is selected. |
| `get_player_status` | `playerId?` | Active status + registered plugin IDs. |
| `get_flow` | `playerId?` | The current flow (from the basic plugin). |
| `get_data` | `playerId?` | The current flow data model. |
| `get_logs` | `playerId?` | Accumulated runtime logs. |
| `get_plugin_data` | `playerId?`, `pluginId`, `dataKey` | A specific data key from any plugin. |
| `describe_plugin` | `playerId?`, `pluginId` | The plugin's capability descriptor — the data keys and actions it exposes. **Call this first** to discover what a plugin supports. |
| `select_player` | `playerId` | Selects a Player as the default target for later calls. |
| `invoke_action` | `playerId?`, `pluginId`, `action`, `payload?` | Invokes a named action (validated against the plugin's declared capabilities). |

A typical agent flow: `list_players` → `select_player` → `describe_plugin` →
`get_*` / `invoke_action`.

> **NOTE**
> Tool handlers return *soft errors* (e.g. `{ "error": "player not found" }`) as
> normal results rather than throwing, so a failed call still returns a
> structured payload the agent can read.

## Transport

The server is decoupled from how it reaches the Player via the `Transport`
interface. The shipped implementation is `FlipperServerTransport`.

```ts
import { MCPServer, FlipperServerTransport } from "@player-devtools/mcp";

const server = new MCPServer(new FlipperServerTransport({ host, port }));
await server.start();
```

`FlipperServerTransport` options:

| Option | Default | Description |
| --- | --- | --- |
| `host` | `"localhost"` | Flipper server host. |
| `port` | `52342` | Flipper server WebSocket port. |

### Shared `flipper-server` daemon

Multiple MCP processes (one per editor/agent registration) attach to a **single**
`flipper-server` on the fixed port. Because no in-process state can coordinate
separate processes, the transport tracks the daemon with a cross-process
**refcount** — a small file under the OS temp dir guarded by an atomic lock
directory:

- The first process to attach starts the daemon (detached + `unref`'d so it
  outlives that process) and records its PID with `refs: 1`.
- Each subsequent attach increments `refs`.
- Each `close()` decrements `refs`; the **last** one out shuts the daemon down.

This means you can run several agents against the same devices without each
spawning (or prematurely killing) its own Flipper server.

## Running

Via the CLI (wraps `FlipperServerTransport` + `MCPServer` and wires `SIGINT` /
`SIGTERM` to a graceful shutdown):

```bash
player-devtools-mcp
```

From the repo, two `just` recipes are provided:

```bash
just mcp          # bazel run //devtools/mcp:mcp_server
just mcp-inspect  # open the MCP inspector against the server
```

Register it with an MCP client (e.g. Claude) by pointing the client at the
`player-devtools-mcp` command over stdio.

[browser extension]: https://github.com/player-ui/browser-devtools
