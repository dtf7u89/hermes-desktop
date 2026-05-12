import { join, dirname, win32 } from "path";
import { existsSync, mkdirSync } from "fs";

export interface ResolveAppBaseDirOptions {
  electronRendererUrl?: string;
  dirname: string;
  resourcesPath?: string;
  cwd: string;
  envDataDir?: string;
  hasPackageJson?: (dir: string) => boolean;
}

function pathDirname(pathValue: string): string {
  return /^[A-Za-z]:\\/.test(pathValue) ? win32.dirname(pathValue) : dirname(pathValue);
}

function pathJoin(base: string, ...parts: string[]): string {
  return /^[A-Za-z]:\\/.test(base) ? win32.join(base, ...parts) : join(base, ...parts);
}

/**
 * Detect if running in a packaged Electron app.
 *
 * In dev mode with electron-vite, ELECTRON_RENDERER_URL is set.
 * In packaged mode, process.resourcesPath is set and ELECTRON_RENDERER_URL is not.
 */
function isPackagedApp(options?: {
  electronRendererUrl?: string;
  dirname: string;
  resourcesPath?: string;
}): boolean {
  const electronRendererUrl = options?.electronRendererUrl ?? process.env.ELECTRON_RENDERER_URL;
  const currentDirname = options?.dirname ?? __dirname;
  const resourcesPath = options?.resourcesPath ?? (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

  // In electron-vite dev mode, ELECTRON_RENDERER_URL is set
  if (electronRendererUrl) return false;

  // Running inside an asar archive → definitely packaged
  if (currentDirname.includes(".asar")) return true;

  // process.resourcesPath is set by Electron in packaged apps
  if (resourcesPath) return true;

  return false;
}

/**
 * Pure resolver for portable data directory placement.
 * Exported to make Windows USB/drive-letter behavior testable without a real
 * Electron runtime.
 */
export function resolveAppBaseDir(options: ResolveAppBaseDirOptions): string {
  // 1. Explicit environment variable override
  if (options.envDataDir) {
    return options.envDataDir;
  }

  // 2. Packaged app: data/ next to executable/app bundle
  if (isPackagedApp({
    electronRendererUrl: options.electronRendererUrl,
    dirname: options.dirname,
    resourcesPath: options.resourcesPath,
  })) {
    if (options.resourcesPath) {
      const resourcesDir = options.resourcesPath;
      const parent = pathDirname(resourcesDir);
      if (parent.endsWith("Contents")) {
        return pathJoin(pathDirname(parent), "data");
      }
      return pathJoin(parent, "data");
    }
    return pathJoin(options.cwd, "data");
  }

  // 3. Dev mode: data/ in project root
  const hasPackageJson = options.hasPackageJson ?? ((dir: string) => existsSync(join(dir, "package.json")));
  let dir = options.dirname;
  for (let i = 0; i < 5; i++) {
    if (hasPackageJson(dir)) {
      return pathJoin(dir, "data");
    }
    const parent = pathDirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (hasPackageJson(options.cwd)) {
    return pathJoin(options.cwd, "data");
  }

  return pathJoin(options.cwd, "data");
}

/**
 * Get the application's base directory for portable data storage.
 *
 * Priority:
 * 1. HERMES_DESKTOP_DATA_DIR environment variable (explicit override)
 * 2. Packaged app: data/ directory next to the executable
 * 3. Dev mode: data/ directory in the project root
 */
export function getAppBaseDir(): string {
  return resolveAppBaseDir({
    electronRendererUrl: process.env.ELECTRON_RENDERER_URL,
    dirname: __dirname,
    resourcesPath: (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath,
    cwd: process.cwd(),
    envDataDir: process.env.HERMES_DESKTOP_DATA_DIR,
  });
}

/**
 * Get the portable data directory (same as getAppBaseDir).
 */
export function getPortableDataDir(): string {
  return getAppBaseDir();
}

/**
 * Get the portable Hermes home directory (data/hermes/).
 * This replaces ~/.hermes in portable mode.
 */
export function getPortableHermesHome(): string {
  return join(getAppBaseDir(), "hermes");
}

/**
 * Alias for getPortableHermesHome() for naming compatibility
 * with the task spec and future license/billing integration.
 */
export function getHermesHomeDir(): string {
  return getPortableHermesHome();
}

/**
 * Get the portable workspace directory (data/workspace/).
 */
export function getWorkspaceDir(): string {
  return join(getAppBaseDir(), "workspace");
}

/**
 * Get the portable logs directory (data/logs/).
 * Prepared for future desktop app logging.
 * Note: Hermes Agent logs are written to $HERMES_HOME/logs/
 * (which resolves to data/hermes/logs/ in portable mode).
 */
export function getLogsDir(): string {
  return join(getAppBaseDir(), "logs");
}

/**
 * Get the license file path (data/license.json).
 */
export function getLicenseFilePath(): string {
  return join(getAppBaseDir(), "license.json");
}

/**
 * Get the app database path (data/app.db).
 * Prepared for future migration of SQLite data.
 */
export function getAppDbPath(): string {
  return join(getAppBaseDir(), "app.db");
}

/**
 * Ensure all portable directories exist.
 * Creates data/hermes, data/workspace, data/logs.
 * Call this once at app startup.
 */
export function ensurePortableDirs(): void {
  const dirs = [
    getPortableHermesHome(),
    getWorkspaceDir(),
    getLogsDir(),
  ];

  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`[portable-paths] Created directory: ${dir}`);
      }
    } catch (err) {
      console.error(
        `[portable-paths] Failed to create directory: ${dir}`,
        err,
      );
    }
  }
}

/**
 * Get environment variables to inject when starting the local Hermes process.
 *
 * Sets HERMES_HOME, HERMES_PROFILE, and HERMES_WORKSPACE to portable paths.
 * Only for local mode — remote/ssh mode should NOT use these.
 *
 * Merge order (highest priority last):
 *   1. process.env (system env)
 *   2. extraEnv (caller overrides, e.g. profile API keys)
 *   3. Portable paths forced on top:
 *      - HERMES_HOME = getPortableHermesHome() (unless allowExternalHermesHome=true)
 *      - HERMES_PROFILE = options.profile || "portable"
 *      - HERMES_WORKSPACE = getWorkspaceDir()
 *   4. Critical system keys (PATH, HOME, etc.) preserved if missing
 *
 * @param extraEnv  Additional caller env vars (e.g. profile-specific API keys)
 * @param options   Override control
 * @param options.profile                Explicit HERMES_PROFILE value. Defaults to "portable".
 * @param options.allowExternalHermesHome If true, allows process.env.HERMES_HOME to override the portable path.
 */
export function getPortableHermesEnv(
  extraEnv?: NodeJS.ProcessEnv,
  options?: {
    profile?: string;
    allowExternalHermesHome?: boolean;
  },
): NodeJS.ProcessEnv {
  // Start with system env + caller overrides
  const env: NodeJS.ProcessEnv = {
    ...(process.env as NodeJS.ProcessEnv),
    ...(extraEnv || {}),
  };

  // Force portable paths on top
  env.HERMES_HOME = options?.allowExternalHermesHome && env.HERMES_HOME
    ? env.HERMES_HOME
    : getPortableHermesHome();

  // Do NOT allow external HERMES_PROFILE to override; only explicit options.profile or "portable"
  env.HERMES_PROFILE = options?.profile || "portable";
  env.HERMES_WORKSPACE = getWorkspaceDir();

  // Preserve critical system environment variables from process.env
  // if they're somehow not already present after the spreads above
  const criticalKeys = [
    "PATH",
    "HOME",
    "USERPROFILE",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "USER",
    "LOGNAME",
  ];
  for (const key of criticalKeys) {
    if (!env[key] && process.env[key]) {
      env[key] = process.env[key];
    }
  }

  return env;
}
