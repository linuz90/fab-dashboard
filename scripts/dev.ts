import { configuredDevApiPort, DEFAULT_DEV_API_PORT, findAvailablePort } from "./devPorts";

const explicitApiPort = configuredDevApiPort(process.env);
const apiHost = process.env.FAB_DASHBOARD_HOST?.trim() || "127.0.0.1";
const apiPort = explicitApiPort ?? String(await findAvailablePort(DEFAULT_DEV_API_PORT, apiHost));

if (!explicitApiPort && apiPort !== String(DEFAULT_DEV_API_PORT)) {
  console.log(`[fab-dashboard] API port ${DEFAULT_DEV_API_PORT} is busy; using ${apiPort}`);
}

const children = [
  Bun.spawn(["bun", "run", "server.ts"], {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, FAB_DASHBOARD_PORT: apiPort },
  }),
  Bun.spawn(["bun", "x", "vite", "--host", "127.0.0.1"], {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, FAB_DASHBOARD_PORT: apiPort },
  }),
];

function stop() {
  for (const child of children) child.kill();
}

let signalExitCode: number | null = null;
process.on("SIGINT", () => {
  signalExitCode = 130;
  stop();
});
process.on("SIGTERM", () => {
  signalExitCode = 143;
  stop();
});

const exitCode = await Promise.race(children.map((child) => child.exited));
stop();
await Promise.allSettled(children.map((child) => child.exited));
process.exitCode = signalExitCode ?? exitCode;

export {};
