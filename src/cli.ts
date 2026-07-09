import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dashboardConfigSchema, SCHEMA_VERSION } from "./shared/schemas";
import { DEFAULT_THEME } from "./shared/themes";
import { createRuntime, summarizeDashboardUsage, validateAll } from "./server/dashboard";
import { resolveDashboardPaths } from "./server/paths";
import { ensureDir, pathExists, readJsonFile, writeJsonAtomic } from "./server/storage";

const paths = resolveDashboardPaths();
const setupReadmePath = join(paths.configHome, "README.md");

function usage(): never {
  console.log(`fab-dashboard

Usage:
  fab-dashboard init [--demo] [--force]
  fab-dashboard validate
  fab-dashboard doctor [--json] [--fetch]
  fab-dashboard migrate [--dry-run]
  fab-dashboard service print <macos|systemd>
`);
  process.exit(1);
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function defaultSetupReadme(): string {
  return `# fab-dashboard local setup

This file is private operating context for agents and humans working on this dashboard.
Keep it in this config home, outside the public engine repo.

## Dashboard home

- Config home: ${paths.configHome}
- State/cache home: ${paths.stateHome}
- Dashboard config: ${paths.dashboardJson}

## Running the dashboard

Document how this dashboard is served here:

- Service manager:
- Service file:
- Local URL:
- Private/Tailscale URL:
- Environment variables:
- Restart command:

## Data refresh jobs

List any launchd/systemd timers, cron jobs, snapshot scripts, or local services that feed connectors.

## Notes for agents

- Run \`bun run cli doctor --json\` from the repo before changing cards or service setup.
- Read this file before editing service, Tailscale, connector refresh, or local path settings.
- Update this file whenever the running setup changes.
`;
}

async function ensureSetupReadme() {
  if (await pathExists(setupReadmePath)) return false;
  await writeFile(setupReadmePath, defaultSetupReadme(), "utf8");
  return true;
}

async function init() {
  const demo = hasFlag("--demo");
  const force = hasFlag("--force");
  await Promise.all([
    ensureDir(paths.configHome),
    ensureDir(paths.localCardsDir),
    ensureDir(paths.localConnectorsDir),
    ensureDir(paths.stateHome),
    ensureDir(paths.cacheHome),
  ]);

  if ((await pathExists(paths.dashboardJson)) && !force) {
    console.error(`${paths.dashboardJson} already exists. Use --force to replace it.`);
    process.exit(2);
  }

  const dashboard = demo
    ? await readJsonFile(join(paths.repoRoot, "examples", "dashboard.demo.json"))
    : {
        schemaVersion: SCHEMA_VERSION,
        title: "fab-dashboard",
        refreshSeconds: 30,
        appearance: { defaultTheme: DEFAULT_THEME },
        cards: [],
      };

  const parsed = dashboardConfigSchema.parse(dashboard);
  const backup = await writeJsonAtomic(paths.dashboardJson, parsed, { backup: true });
  const wroteSetupReadme = await ensureSetupReadme();
  console.log(`wrote ${paths.dashboardJson}`);
  if (wroteSetupReadme) console.log(`wrote ${setupReadmePath}`);
  if (backup) console.log(`backup ${backup}`);
  if (!demo) console.log("dashboard is empty; add cards/connectors or run `fab-dashboard init --demo --force`.");
}

async function validate() {
  const result = await validateAll(paths);
  if (result.ok) {
    const usage = summarizeDashboardUsage(result.config, result.catalog);
    console.log("fab-dashboard config OK");
    console.log(`dashboard cards: ${usage.dashboardCards}`);
    console.log(`dashboard connectors: ${usage.dashboardConnectors}`);
    console.log(`catalog cards: ${result.catalog.cards.size}`);
    console.log(`catalog connectors: ${result.catalog.connectors.size}`);
    return;
  }
  console.error("fab-dashboard config has errors:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

async function doctor() {
  const result = await validateAll(paths);
  const usage = summarizeDashboardUsage(result.config, result.catalog);
  const setupReadmeExists = await pathExists(setupReadmePath);
  const payload = {
    ok: result.ok,
    configHome: paths.configHome,
    stateHome: paths.stateHome,
    cacheHome: paths.cacheHome,
    setupReadme: setupReadmePath,
    setupReadmeExists,
    dashboardJson: paths.dashboardJson,
    dashboardExists: result.dashboardExists,
    dashboardCards: usage.dashboardCards,
    dashboardConnectors: usage.dashboardConnectors,
    activeConnectors: usage.connectorIds,
    catalogCards: result.catalog.cards.size,
    catalogConnectors: result.catalog.connectors.size,
    localCards: result.catalog.counts.localCards,
    localConnectors: result.catalog.counts.localConnectors,
    exampleCards: result.catalog.counts.exampleCards,
    exampleConnectors: result.catalog.counts.exampleConnectors,
    cards: result.catalog.cards.size,
    connectors: result.catalog.connectors.size,
    errors: result.errors,
    connectorDiagnostics: hasFlag("--fetch") ? await fetchConnectorDiagnostics(result.catalog.connectors, usage.connectorIds) : undefined,
  };
  if (hasFlag("--json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`config: ${payload.configHome}`);
  console.log(`state:  ${payload.stateHome}`);
  console.log(`setup: ${payload.setupReadmeExists ? "present" : "missing"} (${payload.setupReadme})`);
  console.log(`dashboard: ${payload.dashboardExists ? "present" : "missing"}`);
  console.log(`dashboard cards: ${payload.dashboardCards}`);
  console.log(`dashboard connectors: ${payload.dashboardConnectors}`);
  console.log(`catalog cards: ${payload.catalogCards} (${payload.localCards} local, ${payload.exampleCards} examples)`);
  console.log(`catalog connectors: ${payload.catalogConnectors} (${payload.localConnectors} local, ${payload.exampleConnectors} examples)`);
  if (payload.connectorDiagnostics) {
    console.log("connector diagnostics:");
    for (const diagnostic of payload.connectorDiagnostics) {
      const suffix = diagnostic.error ? ` (${diagnostic.error})` : "";
      console.log(`- ${diagnostic.id}: ${diagnostic.status}${suffix}`);
    }
  }
  console.log(payload.ok ? "status: OK" : "status: errors");
  for (const error of payload.errors) console.log(`- ${error}`);
}

async function fetchConnectorDiagnostics(
  connectors: Awaited<ReturnType<typeof validateAll>>["catalog"]["connectors"],
  connectorIds: string[],
) {
  const runtime = createRuntime(paths);
  return Promise.all(connectorIds.map(async (id) => {
    const manifest = connectors.get(id) ?? null;
    const startedAt = Date.now();
    const snapshot = await runtime.get(id, connectors, { waitForRefresh: true });
    return {
      id,
      kind: manifest?.kind ?? "missing",
      ttlSeconds: manifest?.ttlSeconds ?? null,
      ttlMs: snapshot.freshness.ttlMs,
      status: snapshot.freshness.status,
      fetchedAt: snapshot.freshness.fetchedAt,
      refreshing: snapshot.freshness.refreshing,
      error: snapshot.freshness.error,
      durationMs: Date.now() - startedAt,
    };
  }));
}

async function migrate() {
  const dryRun = hasFlag("--dry-run");
  if (!dryRun) {
    console.log("No migrations are currently registered.");
    return;
  }
  console.log("dry-run: no migrations are currently registered.");
}

function macosServiceTemplate(): string {
  const bunPath = process.execPath;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>dev.fab-dashboard.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>${bunPath}</string>
    <string>run</string>
    <string>${join(paths.repoRoot, "server.ts")}</string>
  </array>
  <key>WorkingDirectory</key><string>${paths.repoRoot}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>FAB_DASHBOARD_HOME</key><string>${paths.configHome}</string>
    <key>FAB_DASHBOARD_STATE_HOME</key><string>${paths.stateHome}</string>
  </dict>
  <key>StandardOutPath</key><string>/tmp/fab-dashboard.log</string>
  <key>StandardErrorPath</key><string>/tmp/fab-dashboard.err</string>
</dict>
</plist>`;
}

function systemdServiceTemplate(): string {
  return `[Unit]
Description=fab-dashboard
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${paths.repoRoot}
Environment=FAB_DASHBOARD_HOME=${paths.configHome}
Environment=FAB_DASHBOARD_STATE_HOME=${paths.stateHome}
ExecStart=${process.execPath} run ${join(paths.repoRoot, "server.ts")}
Restart=on-failure

[Install]
WantedBy=default.target`;
}

function service() {
  const [, , , action, kind] = process.argv;
  if (action !== "print") usage();
  if (kind === "macos") {
    console.log(macosServiceTemplate());
    return;
  }
  if (kind === "systemd") {
    console.log(systemdServiceTemplate());
    return;
  }
  usage();
}

async function main() {
  await mkdir(paths.repoRoot, { recursive: true });
  const command = process.argv[2];
  if (command === "init") return init();
  if (command === "validate") return validate();
  if (command === "doctor") return doctor();
  if (command === "migrate") return migrate();
  if (command === "service") return service();
  usage();
}

await main();
