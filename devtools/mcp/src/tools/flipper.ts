import type { ExtensionClient } from "@player-devtools/client";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@player-devtools/types";
import { FlipperServerTransport } from "@player-devtools/client-flipper";

import { ok, err, type ToolDef } from "./index";

/** Narrow the generic `Transport` to the concrete Flipper implementation. */
function asFlipperTransport(
  transport: Transport | undefined,
): FlipperServerTransport | null {
  return transport instanceof FlipperServerTransport ? transport : null;
}

export function handleGetFlipperStatus(
  _client: ExtensionClient,
  _args: unknown,
  transport?: Transport,
): CallToolResult {
  const flipper = asFlipperTransport(transport);
  if (!flipper) return err("not using a Flipper transport");

  const { connected, host, port, owns, refs } = flipper.getDiagnostics();
  return ok({ connected, host, port, owns, refs });
}

export function handleGetFlipperConsumers(
  _client: ExtensionClient,
  _args: unknown,
  transport?: Transport,
): CallToolResult {
  const flipper = asFlipperTransport(transport);
  if (!flipper) return err("not using a Flipper transport");

  const { owns, refs, activeClientIds } = flipper.getDiagnostics();
  return ok({ owns, refs, activeClientIds });
}

export async function handleRestartFlipperServer(
  _client: ExtensionClient,
  _args: unknown,
  transport?: Transport,
): Promise<CallToolResult> {
  const flipper = asFlipperTransport(transport);
  if (!flipper) return err("not using a Flipper transport");

  const result = await flipper.restart();
  if (!result.ok) return err(result.reason);
  return ok({ restarted: true, host: result.host, port: result.port });
}

export async function handleGetFlipperPluginInstallStatus(
  _client: ExtensionClient,
  _args: unknown,
  transport?: Transport,
): Promise<CallToolResult> {
  const flipper = asFlipperTransport(transport);
  if (!flipper) return err("not using a Flipper transport");

  if (!flipper.getDiagnostics().connected) {
    return err("flipper transport not connected");
  }

  const status = await flipper.getPluginInstallStatus();
  if (!status.installed && status.reason) return err(status.reason);
  return ok(status);
}

export const getFlipperStatusDef: ToolDef = {
  name: "get_flipper_status",
  description:
    "Get the MCP server's connection status to the shared flipper-server daemon (host, port, ownership, refcount).",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false },
  handle: handleGetFlipperStatus,
};

export const getFlipperConsumersDef: ToolDef = {
  name: "get_flipper_consumers",
  description:
    "Get the active devtools clients attached through this Flipper connection, plus the daemon-wide refcount (reflects all consumers of the shared daemon, not just this process).",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false },
  handle: handleGetFlipperConsumers,
};

export const restartFlipperServerDef: ToolDef = {
  name: "restart_flipper_server",
  description:
    "Restart the shared flipper-server daemon. Only succeeds when this MCP server owns the daemon and is its sole consumer; otherwise returns a soft error rather than disrupting other consumers.",
  inputSchema: {},
  annotations: { readOnlyHint: false, destructiveHint: true },
  handle: handleRestartFlipperServer,
};

export const getFlipperPluginInstallStatusDef: ToolDef = {
  name: "get_flipper_plugin_install_status",
  description:
    "Check whether the Player UI Devtools Flipper plugin is installed on the connected daemon.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false },
  handle: handleGetFlipperPluginInstallStatus,
};
