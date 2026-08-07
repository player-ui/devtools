/**
 * Event property allowlist.
 *
 * `@posthog/mcp` captures tool arguments (`$mcp_parameters`) and tool results
 * (`$mcp_response`) unconditionally — there is no SDK option to disable it, and
 * its built-in sanitizer only matches sensitive *key names* (`token`,
 * `password`, ...), so a field named `flowContent` would be transmitted
 * verbatim. Devtools tool arguments carry player/plugin ids and `invoke_action`
 * payloads, i.e. potentially customer flow data.
 *
 * This is an allowlist rather than a denylist on purpose: the SDK is 0.x and
 * ships frequently, so a denylist naming today's two payload keys would
 * silently start leaking the moment a release adds a third. Anything not
 * explicitly listed here never reaches the wire.
 */
export const ALLOWED_EVENT_PROPERTIES: ReadonlySet<string> = new Set([
  // MCP tool call shape — names and timings only, never payloads.
  "$mcp_tool_name",
  "$mcp_duration_ms",
  "$mcp_is_error",
  "$mcp_error_type",
  "$mcp_listed_tool_names",
  "$mcp_missing_capability",
  // Which editor/agent is driving the server.
  "$mcp_client_name",
  "$mcp_client_version",
  "$mcp_server_name",
  "$mcp_server_version",
  "$mcp_protocol_version",
  // PostHog bookkeeping.
  "$session_id",
  "$process_person_profile",
  "$lib",
  "$lib_version",
  // Our own event properties.
  "mcp_version",
  "os_platform",
  "node_major",
  "transport_connected",
  "surface",
]);

export type CapturedEvent = {
  /** Event name. */
  event?: string;
  /** Event properties. */
  properties?: Record<string, unknown>;
};

/**
 * Drops every property not in {@link ALLOWED_EVENT_PROPERTIES}.
 *
 * Installed as a `posthog-node` client-level `before_send`, which runs inside
 * `capture()` — a chokepoint the MCP SDK cannot route around, since we own the
 * client instance and it does not.
 *
 * Accepts `null` because `before_send` hooks compose: an earlier hook may have
 * already dropped the event.
 */
export function allowlistEventProperties<Event extends CapturedEvent>(
  event: Event | null,
): Event | null {
  if (!event?.properties) return event;

  event.properties = Object.fromEntries(
    Object.entries(event.properties).filter(([key]) =>
      ALLOWED_EVENT_PROPERTIES.has(key),
    ),
  );

  return event;
}
