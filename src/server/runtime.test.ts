import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import type { ConnectorManifest } from "../shared/schemas";
import { ConnectorRuntime, redactForDisplay } from "./runtime";
import type { DashboardPaths } from "./paths";

function testPaths(root: string): DashboardPaths {
  return {
    repoRoot: root,
    configHome: root,
    stateHome: root,
    cacheHome: join(root, "cache"),
    dashboardJson: join(root, "dashboard.json"),
    localCardsDir: join(root, "cards"),
    localConnectorsDir: join(root, "connectors"),
    exampleCardsDir: join(root, "example-cards"),
    exampleConnectorsDir: join(root, "example-connectors"),
  };
}

describe("redactForDisplay", () => {
  test("redacts known secret-shaped values and secret env values", () => {
    process.env.SECRET_VALUE = "plain-secret-12345";
    const message = redactForDisplay("failed with Bearer demo-token and plain-secret-12345");
    expect(message).not.toContain("plain-secret-12345");
    expect(message).toContain("Bearer [redacted]");
  });
});

describe("ConnectorRuntime", () => {
  test("invalidates cached static data when manifest changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-runtime-"));
    const runtime = new ConnectorRuntime(testPaths(root));
    const firstManifest: ConnectorManifest = {
      schemaVersion: 1,
      id: "demo",
      kind: "static",
      ttlSeconds: 0,
      persist: false,
      data: { value: "old" },
    };
    const secondManifest: ConnectorManifest = {
      ...firstManifest,
      data: { value: "new" },
    };

    const connectors = new Map<string, ConnectorManifest>([["demo", firstManifest]]);
    expect(await runtime.get("demo", connectors)).toMatchObject({ data: { value: "old" } });
    connectors.set("demo", secondManifest);
    expect(await runtime.get("demo", connectors)).toMatchObject({ data: { value: "new" } });
  });

  test("can wait for an intentional refresh when cached data is stale", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-runtime-"));
    const dataPath = join(root, "data.json");
    await writeFile(dataPath, JSON.stringify({ value: "old" }));

    const runtime = new ConnectorRuntime(testPaths(root));
    const manifest: ConnectorManifest = {
      schemaVersion: 1,
      id: "demo",
      kind: "file",
      ttlSeconds: 1,
      persist: false,
      path: "./data.json",
      maxBytes: 1_024,
      allowSymlinks: false,
    };
    const connectors = new Map<string, ConnectorManifest>([["demo", manifest]]);

    expect(await runtime.get("demo", connectors)).toMatchObject({ data: { value: "old" } });
    await writeFile(dataPath, JSON.stringify({ value: "new" }));
    await Bun.sleep(1_100);

    expect(await runtime.get("demo", connectors, { waitForRefresh: true })).toMatchObject({
      data: { value: "new" },
      freshness: { refreshing: false },
    });
  });

  test("loads updated trusted ts connector source after ttl refresh", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-runtime-"));
    const paths = testPaths(root);
    const connectorDir = join(paths.localConnectorsDir, "live");
    const entry = join(connectorDir, "index.ts");
    await mkdir(connectorDir, { recursive: true });
    await writeFile(entry, 'export default () => ({ value: "old" });\n');

    const runtime = new ConnectorRuntime(paths);
    const manifest: ConnectorManifest = {
      schemaVersion: 1,
      id: "live",
      kind: "ts",
      ttlSeconds: 1,
      persist: false,
      entry: "./index.ts",
      timeoutMs: 1_000,
      trusted: true,
    };
    const connectors = new Map<string, ConnectorManifest>([["live", manifest]]);

    expect(await runtime.get("live", connectors)).toMatchObject({ data: { value: "old" } });
    await writeFile(entry, 'export default () => ({ value: "new" });\n');
    await Bun.sleep(1_100);

    expect(await runtime.get("live", connectors)).toMatchObject({
      data: { value: "old" },
      freshness: { refreshing: true },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await Bun.sleep(50);
      const snapshot = await runtime.get("live", connectors);
      if ((snapshot.data as { value?: string }).value === "new") {
        expect(snapshot).toMatchObject({ data: { value: "new" }, freshness: { refreshing: false } });
        return;
      }
    }

    throw new Error("trusted ts connector did not reload edited source");
  });
});
