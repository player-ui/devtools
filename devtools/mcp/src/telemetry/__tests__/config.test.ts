import { describe, it, expect } from "vitest";

import { resolveTelemetryConfig } from "../config";

const KEY = "phc_test_key";

describe("resolveTelemetryConfig", () => {
  it("is disabled while the project key is an unreplaced placeholder", () => {
    expect(resolveTelemetryConfig({})).toEqual({ enabled: false });
  });

  it("is enabled with a configured key and defaults to the US host", () => {
    expect(
      resolveTelemetryConfig({ PLAYER_DEVTOOLS_TELEMETRY_KEY: KEY }),
    ).toEqual({
      enabled: true,
      apiKey: KEY,
      host: "https://us.i.posthog.com",
    });
  });

  it.each([
    ["PLAYER_DEVTOOLS_TELEMETRY_DISABLED", "1"],
    ["PLAYER_DEVTOOLS_TELEMETRY_DISABLED", "true"],
    ["DO_NOT_TRACK", "1"],
    ["DO_NOT_TRACK", "yes"],
  ])("opts out when %s=%s", (name, value) => {
    expect(
      resolveTelemetryConfig({
        PLAYER_DEVTOOLS_TELEMETRY_KEY: KEY,
        [name]: value,
      }),
    ).toEqual({ enabled: false });
  });

  it.each([
    ["0", "explicit zero"],
    ["false", "explicit false"],
    ["", "empty string"],
  ])("stays enabled for DO_NOT_TRACK=%s (%s)", (value) => {
    expect(
      resolveTelemetryConfig({
        PLAYER_DEVTOOLS_TELEMETRY_KEY: KEY,
        DO_NOT_TRACK: value,
      }),
    ).toMatchObject({ enabled: true });
  });

  it("normalizes trailing slashes on the host override", () => {
    expect(
      resolveTelemetryConfig({
        PLAYER_DEVTOOLS_TELEMETRY_KEY: KEY,
        PLAYER_DEVTOOLS_TELEMETRY_HOST: "https://eu.i.posthog.com///",
      }),
    ).toMatchObject({ host: "https://eu.i.posthog.com" });
  });
});
