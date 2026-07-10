import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, test } from "bun:test";
import { configuredDevApiPort, findAvailablePort, proxyHostForDevHost } from "./devPorts";

const servers: Server[] = [];

async function occupyFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("could not allocate a test port"));
        return;
      }
      servers.push(server);
      resolve(address.port);
    });
  });
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );
});

describe("findAvailablePort", () => {
  test("skips an occupied port", async () => {
    const port = await occupyFreePort();
    expect(await findAvailablePort(port, "127.0.0.1")).toBeGreaterThan(port);
  });

  test("reports exhaustion instead of returning an occupied port", async () => {
    const port = await occupyFreePort();
    await expect(findAvailablePort(port, "127.0.0.1", port)).rejects.toThrow("no available ports");
  });

  test("rejects invalid ranges", async () => {
    await expect(findAvailablePort(0, "127.0.0.1")).rejects.toThrow("invalid port range");
  });
});

describe("configuredDevApiPort", () => {
  test("preserves explicit precedence", () => {
    expect(configuredDevApiPort({ FAB_DASHBOARD_PORT: "8001", PORT: "8002" })).toBe("8001");
    expect(configuredDevApiPort({ PORT: "8002" })).toBe("8002");
    expect(configuredDevApiPort({})).toBeNull();
  });

  test("rejects empty and invalid overrides", () => {
    expect(() => configuredDevApiPort({ FAB_DASHBOARD_PORT: "" })).toThrow("FAB_DASHBOARD_PORT");
    expect(() => configuredDevApiPort({ PORT: "70000" })).toThrow("PORT");
  });
});

describe("proxyHostForDevHost", () => {
  test("formats IPv6 and wildcard hosts for the local Vite proxy", () => {
    expect(proxyHostForDevHost("::1")).toBe("[::1]");
    expect(proxyHostForDevHost("::")).toBe("127.0.0.1");
    expect(proxyHostForDevHost("0.0.0.0")).toBe("127.0.0.1");
    expect(proxyHostForDevHost("localhost")).toBe("localhost");
  });
});
