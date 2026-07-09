import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { buildDashboardResponse, createRuntime, summarizeDashboardUsage, validateAll } from "./dashboard";
import type { DashboardPaths } from "./paths";

function testPaths(root: string): DashboardPaths {
  return {
    repoRoot: root,
    configHome: join(root, "config"),
    stateHome: join(root, "state"),
    cacheHome: join(root, "state", "cache"),
    dashboardJson: join(root, "config", "dashboard.json"),
    localCardsDir: join(root, "config", "cards"),
    localConnectorsDir: join(root, "config", "connectors"),
    exampleCardsDir: join(root, "examples", "cards"),
    exampleConnectorsDir: join(root, "examples", "connectors"),
  };
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("dashboard validation", () => {
  test("separates active dashboard usage from catalog inventory", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-usage-"));
    const paths = testPaths(root);

    await writeJson(join(paths.exampleConnectorsDir, "example-source", "connector.json"), {
      schemaVersion: 1,
      id: "example-source",
      kind: "static",
      data: { label: "example" },
    });
    await writeJson(join(paths.exampleCardsDir, "example-card", "card.json"), {
      schemaVersion: 1,
      type: "example-card",
      connectors: ["example-source"],
      blocks: [{ type: "text", text: "Example" }],
    });
    await writeJson(join(paths.localConnectorsDir, "local-source", "connector.json"), {
      schemaVersion: 1,
      id: "local-source",
      kind: "static",
      data: { label: "local" },
    });
    await writeJson(join(paths.localCardsDir, "local-card", "card.json"), {
      schemaVersion: 1,
      type: "local-card",
      connectors: ["local-source"],
      blocks: [{ type: "text", path: "local-source.label" }],
    });
    await writeJson(paths.dashboardJson, {
      schemaVersion: 1,
      title: "test",
      refreshSeconds: 30,
      header: {
        widgets: [{ id: "status", kind: "label", connector: "local-source", labelPath: "local-source.label" }],
      },
      cards: [{ id: "status", type: "local-card", title: "Status" }],
    });

    const result = await validateAll(paths);
    const usage = summarizeDashboardUsage(result.config, result.catalog);

    expect(result.ok).toBe(true);
    expect(result.dashboardExists).toBe(true);
    expect(result.catalog.cards.size).toBe(2);
    expect(result.catalog.connectors.size).toBe(2);
    expect(result.catalog.counts).toEqual({
      exampleCards: 1,
      localCards: 1,
      exampleConnectors: 1,
      localConnectors: 1,
    });
    expect(usage).toEqual({
      dashboardCards: 1,
      dashboardConnectors: 1,
      connectorIds: ["local-source"],
    });
  });

  test("surfaces local config mutation capability in the dashboard response", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-response-"));
    const paths = testPaths(root);

    const response = await buildDashboardResponse(paths, createRuntime(paths), { canMutateConfig: true });

    expect(response.capabilities).toEqual({ canMutateConfig: true, canReorderCards: true });
  });
});
