import { describe, it, expect } from "vitest";

import {
  ALLOWED_EVENT_PROPERTIES,
  allowlistEventProperties,
} from "../redaction";

const SECRET = "ZZZ-CANARY-ZZZ";

describe("allowlistEventProperties", () => {
  it("strips captured tool parameters and responses", () => {
    const result = allowlistEventProperties({
      event: "$mcp_tool_call",
      properties: {
        $mcp_tool_name: "invoke_action",
        $mcp_duration_ms: 12,
        $mcp_parameters: {
          pluginId: "basic",
          payload: { flowContent: SECRET },
        },
        $mcp_response: { data: SECRET },
      },
    });

    // Assert on the serialized payload, not key presence — a nested leak would
    // pass a shallow key check.
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(result.properties).toEqual({
      $mcp_tool_name: "invoke_action",
      $mcp_duration_ms: 12,
    });
  });

  it("drops unknown properties a future SDK version might add", () => {
    const result = allowlistEventProperties({
      event: "$mcp_tool_call",
      properties: {
        $mcp_tool_name: "get_flow",
        $mcp_raw_request: { body: SECRET },
        $mcp_arguments_v2: SECRET,
      },
    });

    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(Object.keys(result.properties ?? {})).toEqual(["$mcp_tool_name"]);
  });

  it("preserves every allowlisted property", () => {
    const properties = Object.fromEntries(
      [...ALLOWED_EVENT_PROPERTIES].map((key) => [key, "kept"]),
    );

    const result = allowlistEventProperties({
      event: "$mcp_tool_call",
      properties,
    });

    expect(Object.keys(result.properties ?? {}).sort()).toEqual(
      [...ALLOWED_EVENT_PROPERTIES].sort(),
    );
  });

  it("yields empty properties rather than leaking when nothing is allowed", () => {
    const result = allowlistEventProperties({
      event: "$mcp_tool_call",
      properties: { $mcp_parameters: SECRET, $mcp_response: SECRET },
    });

    expect(result.properties).toEqual({});
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("tolerates events without properties", () => {
    expect(() =>
      allowlistEventProperties({ event: "$mcp_initialize" }),
    ).not.toThrow();
  });

  it("passes through a null event dropped by an earlier hook", () => {
    expect(allowlistEventProperties(null)).toBeNull();
  });

  it("never allows the two payload keys, whatever else changes", () => {
    expect(ALLOWED_EVENT_PROPERTIES.has("$mcp_parameters")).toBe(false);
    expect(ALLOWED_EVENT_PROPERTIES.has("$mcp_response")).toBe(false);
  });
});
