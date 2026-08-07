/**
 * PostHog project API key. This is a *public, write-only* ingestion token — it
 * cannot read any data back out, which is why it is safe to ship in an
 * open-source package. Replace the placeholder to enable telemetry.
 */
const POSTHOG_PROJECT_KEY = "phc_REPLACE_ME_WITH_REAL_PROJECT_KEY";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

export type TelemetryConfig =
  | { readonly enabled: false }
  | { readonly enabled: true; readonly apiKey: string; readonly host: string };

/**
 * Presence of the variable opts out, *except* for explicit negatives —
 * `DO_NOT_TRACK=0` means "tracking is fine", not "opted out".
 */
function isTruthy(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "" || normalized === "0" || normalized === "false") {
    return false;
  }
  return true;
}

function isOptedOut(env: NodeJS.ProcessEnv): boolean {
  return (
    isTruthy(env.PLAYER_DEVTOOLS_TELEMETRY_DISABLED) ||
    // Cross-vendor convention (consoledonottrack.com) — honored so a user who
    // sets it once is covered everywhere.
    isTruthy(env.DO_NOT_TRACK)
  );
}

export function resolveTelemetryConfig(
  env: NodeJS.ProcessEnv = process.env,
): TelemetryConfig {
  if (isOptedOut(env)) return { enabled: false };

  const apiKey = env.PLAYER_DEVTOOLS_TELEMETRY_KEY ?? POSTHOG_PROJECT_KEY;
  // An unreplaced placeholder would fire doomed requests on every startup;
  // treat it as "not configured" so the package is safe to ship unprovisioned.
  if (!apiKey || apiKey.includes("REPLACE_ME")) return { enabled: false };

  const host = (
    env.PLAYER_DEVTOOLS_TELEMETRY_HOST ?? DEFAULT_POSTHOG_HOST
  ).replace(/\/+$/, "");

  return { enabled: true, apiKey, host };
}
