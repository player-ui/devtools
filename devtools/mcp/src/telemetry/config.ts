declare global {
  const __POSTHOG_KEY__: string;
}

/**
 * PostHog project API key, stamped at release build time from the
 * `POSTHOG_PROJECT_KEY` CI environment variable (see
 * helpers/release/workspace-status.sh and tsup.config.ts), mirroring how
 * `__VERSION__` is stamped.
 *
 * This is a *public, write-only* ingestion token — it can only send events and
 * cannot read data back, which is why it is safe to ship in an open-source
 * package.
 *
 * The `typeof` guard is required: the global is absent in local and test
 * builds, where it resolves to an empty string and disables telemetry.
 */
const POSTHOG_PROJECT_KEY =
  typeof __POSTHOG_KEY__ !== "undefined" ? __POSTHOG_KEY__ : "";

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
  // Unstamped (local/dev builds) or unset in CI — stay silent rather than
  // firing doomed requests at PostHog on every startup.
  if (!apiKey) return { enabled: false };
  // Only public write-only project keys may ship. A `phx_` (personal) or
  // `phs_` (project secret) key is a real credential and must never be baked
  // into a published artifact, so refuse to use one even if stamped.
  if (!apiKey.startsWith("phc_")) return { enabled: false };

  const host = (
    env.PLAYER_DEVTOOLS_TELEMETRY_HOST ?? DEFAULT_POSTHOG_HOST
  ).replace(/\/+$/, "");

  return { enabled: true, apiKey, host };
}
