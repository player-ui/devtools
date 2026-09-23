import type { ExtensionClient } from "@player-devtools/client";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@player-devtools/types";
import { FlipperServerTransport } from "@player-devtools/client-flipper";
import { z } from "zod";

import { ok, err, type ToolDef } from "./index";

const clientIdShape = {
  clientId: z
    .string()
    .optional()
    .describe(
      "Flipper client ID — a transport-level device/app connection, NOT a Player devtools playerId (see list_players/select_player). A client can be connected, and even activated, before any Player instance on it is visible to those tools. Unlike playerId, there is no 'currently selected' client: omitting this targets every connected client — for enable/disable, only clients not already in the desired state are messaged.",
    ),
};

const ClientIdInput = z.object(clientIdShape);

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

  const { connected, host, port } = flipper.getDiagnostics();
  return ok({ connected, host, port });
}

export function handleGetFlipperConsumers(
  _client: ExtensionClient,
  _args: unknown,
  transport?: Transport,
): CallToolResult {
  const flipper = asFlipperTransport(transport);
  if (!flipper) return err("not using a Flipper transport");

  const { owns, refs, activeClientIds, connectedClientIds } =
    flipper.getDiagnostics();
  return ok({ owns, refs, activeClientIds, connectedClientIds });
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
  name: "get_flipper_connection_status",
  description:
    "Get the MCP server's basic connection health to the shared flipper-server daemon: whether it's connected, and the host/port it's connected to. For ownership/refcount/client info, use get_flipper_consumers instead.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false },
  handle: handleGetFlipperStatus,
};

export const getFlipperConsumersDef: ToolDef = {
  name: "get_flipper_consumers",
  description:
    "Get who else is attached to the shared flipper-server daemon: whether this process owns it, the daemon-wide refcount (reflects all consumers, not just this process), and the connected/active devtools clients on this connection.",
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

export function handleGetFlipperPluginActivationStatus(
  _client: ExtensionClient,
  _args: unknown,
  transport?: Transport,
): CallToolResult {
  const flipper = asFlipperTransport(transport);
  if (!flipper) return err("not using a Flipper transport");

  const { connected, connectedClientIds, activeClientIds } =
    flipper.getDiagnostics();
  if (!connected) return err("flipper transport not connected");

  const active = new Set(activeClientIds);
  return ok({
    activeClientIds,
    inactiveClientIds: connectedClientIds.filter((id) => !active.has(id)),
  });
}

export async function handleEnableFlipperPlugin(
  _client: ExtensionClient,
  args: unknown,
  transport?: Transport,
): Promise<CallToolResult> {
  const flipper = asFlipperTransport(transport);
  if (!flipper) return err("not using a Flipper transport");

  const { clientId } = ClientIdInput.parse(args);
  try {
    await flipper.enablePlugin(clientId);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
  return ok({ enabled: true, clientId: clientId ?? "all" });
}

export async function handleDisableFlipperPlugin(
  _client: ExtensionClient,
  args: unknown,
  transport?: Transport,
): Promise<CallToolResult> {
  const flipper = asFlipperTransport(transport);
  if (!flipper) return err("not using a Flipper transport");

  const { clientId } = ClientIdInput.parse(args);
  try {
    await flipper.disablePlugin(clientId);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
  return ok({ disabled: true, clientId: clientId ?? "all" });
}

export const getFlipperPluginActivationStatusDef: ToolDef = {
  name: "get_flipper_plugin_activation_status",
  description:
    "Get per-client activation status of the Player UI Devtools Flipper plugin: which connected clients have completed the init handshake (active) versus which are connected but not yet activated (inactive). Distinct from get_flipper_plugin_install_status, which only reports whether the plugin is installed on the daemon, not activated for any specific client.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false },
  handle: handleGetFlipperPluginActivationStatus,
};

export const enableFlipperPluginDef: ToolDef = {
  name: "enable_flipper_plugin",
  description:
    "Activate the Player UI Devtools Flipper plugin for a client by sending the init handshake (installing the plugin on the daemon first, if needed). Pass clientId to target one client, or omit it to activate every connected client not already active. There is no direct mapping from clientId to the playerId(s) it hosts — after activating, poll list_players until the expected Player appears.",
  inputSchema: clientIdShape,
  annotations: { readOnlyHint: false, destructiveHint: false },
  handle: handleEnableFlipperPlugin,
};

export const disableFlipperPluginDef: ToolDef = {
  name: "disable_flipper_plugin",
  description:
    "Deactivate the Player UI Devtools Flipper plugin for a client by sending the deinit handshake, without disconnecting it from flipper-server. Pass clientId to target one client, or omit it to deactivate every currently active client.",
  inputSchema: clientIdShape,
  annotations: { readOnlyHint: false, destructiveHint: false },
  handle: handleDisableFlipperPlugin,
};
