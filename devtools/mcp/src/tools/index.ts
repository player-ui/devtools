import type { ExtensionClient } from "@player-devtools/client";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";

/**
 * A tool definition consumed by the MCP server. `inputSchema` is a Zod raw
 * shape — the SDK derives the JSON Schema, validates input, and types the
 * handler's `args`. The handler receives the running devtools client plus the
 * validated args.
 */
export type ToolDef<Shape extends ZodRawShape = ZodRawShape> = {
  name: string;
  description: string;
  inputSchema: Shape;
  handle: (client: ExtensionClient, args: unknown) => CallToolResult;
};

export * from "./flow";
export * from "./players";
export * from "./plugins";
export * from "./select";

import { listPlayersDef, getPlayerStatusDef } from "./players";
import { getFlowDef, getDataDef, getLogsDef, getPluginDataDef } from "./flow";
import { describePluginDef } from "./plugins";
import { selectPlayerDef, invokeActionDef } from "./select";

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
];
