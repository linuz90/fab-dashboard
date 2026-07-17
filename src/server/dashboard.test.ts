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

  test("eagerly resolves global header widgets and cards from every dashboard tab", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-tabs-response-"));
    const paths = testPaths(root);

    for (const id of ["today", "system"]) {
      await writeJson(join(paths.localConnectorsDir, `${id}-source`, "connector.json"), {
        schemaVersion: 1,
        id: `${id}-source`,
        kind: "static",
        data: { label: id },
      });
      await writeJson(join(paths.localCardsDir, `${id}-card`, "card.json"), {
        schemaVersion: 1,
        type: `${id}-card`,
        connectors: [`${id}-source`],
        blocks: [{ type: "text", path: `${id}-source.label` }],
      });
    }
    await writeJson(join(paths.localConnectorsDir, "global-source", "connector.json"), {
      schemaVersion: 1,
      id: "global-source",
      kind: "static",
      data: { label: "global" },
    });
    await writeJson(paths.dashboardJson, {
      schemaVersion: 1,
      header: {
        widgets: [{ id: "global", kind: "label", connector: "global-source", labelPath: "global-source.label" }],
      },
      tabs: [
        { id: "today", label: "Today" },
        { id: "system", label: "System" },
      ],
      cards: [
        { id: "today", type: "today-card", title: "Today", tab: "today" },
        { id: "system", type: "system-card", title: "System", tab: "system" },
      ],
    });

    const response = await buildDashboardResponse(paths, createRuntime(paths));

    expect(response.cards.map((card) => card.instance.id)).toEqual(["today", "system"]);
    expect(response.cards[0]?.data["today-source"]).toEqual({ label: "today" });
    expect(response.cards[1]?.data["system-source"]).toEqual({ label: "system" });
    expect(response.header.widgets[0]?.label).toBe("global");
    expect(Object.keys(response.sources).sort()).toEqual(["global-source", "system-source", "today-source"]);
  });

  test("keeps the last valid tabbed dashboard when new membership is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-tabs-last-good-"));
    const paths = testPaths(root);

    await writeJson(join(paths.localCardsDir, "demo-card", "card.json"), {
      schemaVersion: 1,
      type: "demo-card",
      blocks: [{ type: "text", text: "Demo" }],
    });
    const validDashboard = {
      schemaVersion: 1,
      tabs: [
        { id: "today", label: "Today" },
        { id: "system", label: "System" },
      ],
      cards: [{ id: "tasks", type: "demo-card", title: "Tasks", tab: "today" }],
    };
    await writeJson(paths.dashboardJson, validDashboard);

    const validResponse = await buildDashboardResponse(paths, createRuntime(paths));
    expect(validResponse.configError).toBeNull();
    expect(validResponse.cards[0]?.instance.tab).toBe("today");

    await writeJson(paths.dashboardJson, {
      ...validDashboard,
      cards: [{ id: "tasks", type: "demo-card", title: "Tasks" }],
    });

    const fallbackResponse = await buildDashboardResponse(paths, createRuntime(paths));
    expect(fallbackResponse.configError).toContain("must declare a tab");
    expect(fallbackResponse.config.tabs?.map((tab) => tab.id)).toEqual(["today", "system"]);
    expect(fallbackResponse.cards.map((card) => ({ id: card.instance.id, tab: card.instance.tab }))).toEqual([
      { id: "tasks", tab: "today" },
    ]);
  });
});
