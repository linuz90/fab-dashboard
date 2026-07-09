const apiPort = process.env.FAB_DASHBOARD_PORT ?? process.env.PORT ?? "7893";

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

process.on("SIGINT", () => {
  stop();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(143);
});

await Promise.race(children.map((child) => child.exited));
stop();

export {};
