import { createServer } from "node:net";

export const DEFAULT_DEV_API_PORT = 7893;

type DevPortEnvironment = Record<string, string | undefined>;

export function configuredDevApiPort(env: DevPortEnvironment): string | null {
  const key = env.FAB_DASHBOARD_PORT !== undefined ? "FAB_DASHBOARD_PORT" : env.PORT !== undefined ? "PORT" : null;
  if (!key) return null;

  const raw = env[key]?.trim() ?? "";
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`${key} must be an integer from 1 through 65535`);
  }
  return String(port);
}

export function proxyHostForDevHost(host: string): string {
  if (host === "0.0.0.0" || host === "::") return "127.0.0.1";
  return host.includes(":") ? `[${host}]` : host;
}

async function portIsAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.listen({ host, port, exclusive: true }, () => {
      server.close((error) => {
        if (error) reject(error);
        else resolve(true);
      });
    });
  });
}

export async function findAvailablePort(startPort: number, host: string, endPort = 65_535): Promise<number> {
  if (!Number.isInteger(startPort) || startPort <= 0 || startPort > endPort || endPort > 65_535) {
    throw new RangeError(`invalid port range ${startPort}-${endPort}`);
  }

  for (let port = startPort; port <= endPort; port += 1) {
    if (await portIsAvailable(port, host)) return port;
  }
  throw new Error(`no available ports from ${startPort} through ${endPort} on ${host}`);
}
