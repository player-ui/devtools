import * as os from "os";
import { instrument } from "@posthog/mcp";
import { PostHog } from "posthog-node";

import { resolveTelemetryConfig } from "./config";
import { getInstallId } from "./installId";
import { allowlistEventProperties } from "./redaction";

export {
  ALLOWED_EVENT_PROPERTIES,
  allowlistEventProperties,
} from "./redaction";
export { resolveTelemetryConfig, type TelemetryConfig } from "./config";
export { getInstallId, type InstallIdDeps } from "./installId";

declare global {
  const __VERSION__: string;
}

/**
 * Stamped at release build time by tsup (see devtools/tsup.config.ts). The
 * guard is required — the global is absent in local and test builds.
 */
export const MCP_VERSION: string =
  typeof __VERSION__ !== "undefined" ? __VERSION__ : "unstamped";

export type AnalyticsDeps = {
  /** Reports whether the devtools transport is currently connected. */
  isTransportConnected: () => boolean;
};

/**
 * Instruments `server` with anonymous usage analytics.
 *
 * Returns the PostHog client so the caller can flush it on shutdown, or `null`
 * when telemetry is disabled or no durable identity is available. Never throws:
 * telemetry must not be able to prevent the server from starting.
 */
export function createAnalytics(
  server: object,
  deps: AnalyticsDeps,
): PostHog | null {
  try {
    const config = resolveTelemetryConfig();
    if (!config.enabled) return null;

    const installId = getInstallId();
    if (installId === null) return null;

    const posthog = new PostHog(config.apiKey, {
      host: config.host,
      // The load-bearing privacy control. Runs inside posthog-node's capture(),
      // so it applies to everything the MCP SDK emits regardless of the SDK's
      // own hooks. See redaction.ts for why this is an allowlist.
      before_send: [allowlistEventProperties],
    });

    instrument(server, posthog, {
      // Defaults to ON, and would inject a *required* `context` parameter into
      // every tool schema asking the agent to narrate user intent — mutating
      // our public tool API and adding per-call token cost.
      context: false,
      identify: { distinctId: installId },
      eventProperties: () => ({
        mcp_version: MCP_VERSION,
        os_platform: os.platform(),
        node_major: Number.parseInt(
          process.versions.node.split(".")[0] ?? "",
          10,
        ),
        transport_connected: deps.isTransportConnected(),
        surface: "mcp-server",
      }),
      // Redundant with `before_send` above, kept as a second independent layer.
      // This hook fails closed: the SDK drops the event if it throws.
      beforeSend: allowlistEventProperties,
    });

    return posthog;
  } catch {
    // Telemetry is strictly best-effort — a misconfiguration must never take
    // down the server.
    return null;
  }
}
