import type { ExtensionClient } from "@player-devtools/client";
import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@player-devtools/types";
import type { ZodRawShape } from "zod";

/**
 * A tool definition consumed by the MCP server. `inputSchema` is a Zod raw
 * shape — the SDK derives the JSON Schema, validates input, and types the
 * handler's `args`. The handler receives the running devtools client, the
 * validated args, and the raw `Transport` for tools that need connection-level
 * diagnostics `ExtensionClient` doesn't expose.
 */
export type ToolDef<Shape extends ZodRawShape = ZodRawShape> = {
  name: string;
  description: string;
  inputSchema: Shape;
  annotations?: ToolAnnotations;
  handle: (
    client: ExtensionClient,
    args: unknown,
    transport?: Transport,
  ) => CallToolResult | Promise<CallToolResult>;
};

export * from "./flow";
export * from "./players";
export * from "./plugins";
export * from "./select";
export * from "./flipper";

import { listPlayersDef, getPlayerStatusDef } from "./players";
import { getFlowDef, getDataDef, getLogsDef, getPluginDataDef } from "./flow";
import { describePluginDef } from "./plugins";
import { selectPlayerDef, invokeActionDef } from "./select";
import {
  getFlipperStatusDef,
  getFlipperConsumersDef,
  restartFlipperServerDef,
  getFlipperPluginInstallStatusDef,
} from "./flipper";

/** Every tool the MCP server exposes. */
export const TOOL_DEFS: ToolDef[] = [
  listPlayersDef,
  getPlayerStatusDef,
  getFlowDef,
  getDataDef,
  getLogsDef,
  getPluginDataDef,
  describePluginDef,
  selectPlayerDef,
  invokeActionDef,
  getFlipperStatusDef,
  getFlipperConsumersDef,
  restartFlipperServerDef,
  getFlipperPluginInstallStatusDef,
];
