import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface DashboardPaths {
  repoRoot: string;
  configHome: string;
  stateHome: string;
  cacheHome: string;
  dashboardJson: string;
  localCardsDir: string;
  localConnectorsDir: string;
  exampleCardsDir: string;
  exampleConnectorsDir: string;
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function envPath(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? resolve(expandHome(value)) : null;
}

function parseEnvValue(raw: string): string {
  const value = raw.trim();
  const quote = value[0];
  if ((quote === `"` || quote === `'`) && value.endsWith(quote)) {
    const unquoted = value.slice(1, -1);
    return quote === `"` ? unquoted.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, `"`) : unquoted;
  }
  return value.replace(/\s+#.*$/, "").trim();
}

export function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const source = readFileSync(path, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = parseEnvValue(rawValue);
  }
}

export function repoRootFromImportMeta(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

export function resolveDashboardPaths(): DashboardPaths {
  const repoRoot = repoRootFromImportMeta();
  const configHome =
    envPath("FAB_DASHBOARD_HOME") ??
    (process.env.XDG_CONFIG_HOME ? resolve(expandHome(process.env.XDG_CONFIG_HOME), "fab-dashboard") : null) ??
    join(homedir(), ".config", "fab-dashboard");

  // Load secrets from the selected config home so local connector manifests can
  // use env: refs without requiring shell-specific service configuration.
  loadEnvFile(join(configHome, ".env"));

  const stateHome =
    envPath("FAB_DASHBOARD_STATE_HOME") ??
    (process.env.XDG_STATE_HOME ? resolve(expandHome(process.env.XDG_STATE_HOME), "fab-dashboard") : null) ??
    join(homedir(), ".local", "state", "fab-dashboard");

  return {
    repoRoot,
    configHome,
    stateHome,
    cacheHome: join(stateHome, "cache"),
    dashboardJson: join(configHome, "dashboard.json"),
    localCardsDir: join(configHome, "cards"),
    localConnectorsDir: join(configHome, "connectors"),
    exampleCardsDir: join(repoRoot, "examples", "cards"),
    exampleConnectorsDir: join(repoRoot, "examples", "connectors"),
  };
}

export function resolveUserPath(path: string, baseDir?: string): string {
  const expanded = expandHome(path);
  return resolve(baseDir ?? process.cwd(), expanded);
}
