import { randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export type InstallIdDeps = {
  /** Resolves the user's home directory. */
  homedir: () => string;
  /** Reads the install file. */
  readFileSync: typeof fs.readFileSync;
  /** Writes the install file. */
  writeFileSync: typeof fs.writeFileSync;
  /** Creates the install directory. */
  mkdirSync: typeof fs.mkdirSync;
  /** Mints a new identifier. */
  randomUUID: () => string;
};

const defaultDeps: InstallIdDeps = {
  homedir: os.homedir,
  readFileSync: fs.readFileSync,
  writeFileSync: fs.writeFileSync,
  mkdirSync: fs.mkdirSync,
  randomUUID,
};

type InstallFile = { installId: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const INSTALL_DIR_NAME = ".player-ui-devtools";
export const INSTALL_FILE_NAME = "install.json";

/**
 * A stable, anonymous per-machine identifier.
 *
 * Stored under the user's home directory rather than the OS temp dir the
 * flipper refcount uses: temp is periodically reaped, which would regenerate
 * the id on every reboot and turn "unique installs" into "unique boots".
 *
 * Returns `null` when the id can neither be read nor persisted (read-only FS,
 * sandbox, absent HOME). Callers treat that as "telemetry off" — returning an
 * in-memory id instead would register a brand-new install on every run and
 * systematically inflate counts for exactly the sandboxed population least
 * likely to be real users.
 */
export function getInstallId(deps: InstallIdDeps = defaultDeps): string | null {
  const dir = path.join(deps.homedir(), INSTALL_DIR_NAME);
  const file = path.join(dir, INSTALL_FILE_NAME);

  try {
    const parsed = JSON.parse(
      deps.readFileSync(file, "utf8") as string,
    ) as Partial<InstallFile>;
    // Validate the shape, not just the parse: `{"installId": 42}` parses fine
    // but is not a usable identity.
    if (
      typeof parsed.installId === "string" &&
      UUID_PATTERN.test(parsed.installId)
    ) {
      return parsed.installId;
    }
  } catch {
    /* missing or corrupt — fall through and regenerate */
  }

  const installId = deps.randomUUID();
  try {
    deps.mkdirSync(dir, { recursive: true });
    const contents: InstallFile = { installId };
    // 0600: a stable per-user identifier should not be world-readable.
    deps.writeFileSync(file, JSON.stringify(contents), { mode: 0o600 });
  } catch {
    return null;
  }

  return installId;
}
