import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  DashboardConfigActionError,
  parseUpdateAppearanceLayoutInput,
  reorderDashboardCards,
  updateDashboardAppearanceLayout,
} from "./configActions";
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

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

function dashboard(cards = [
  { id: "alpha", type: "demo-alpha", title: "Alpha" },
  { id: "bravo", type: "demo-bravo", title: "Bravo" },
  { id: "charlie", type: "demo-charlie", title: "Charlie", options: { mode: "raw" } },
]) {
  return {
    schemaVersion: 1,
    title: "test",
    refreshSeconds: 30,
    cards,
  };
}

async function expectActionError(promise: Promise<unknown>, status: number) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DashboardConfigActionError);
    expect((error as DashboardConfigActionError).status).toBe(status);
    return;
  }
  throw new Error(`expected DashboardConfigActionError ${status}`);
}

describe("reorderDashboardCards", () => {
  test("reorders raw dashboard card objects without serializing schema defaults", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-reorder-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, dashboard());

    await expect(reorderDashboardCards(paths, {
      baseOrder: ["alpha", "bravo", "charlie"],
      order: ["charlie", "alpha", "bravo"],
    })).resolves.toEqual({ changed: true });

    expect(await readJson(paths.dashboardJson)).toEqual(dashboard([
      { id: "charlie", type: "demo-charlie", title: "Charlie", options: { mode: "raw" } },
      { id: "alpha", type: "demo-alpha", title: "Alpha" },
      { id: "bravo", type: "demo-bravo", title: "Bravo" },
    ]));
  });

  test("treats unchanged and single-card order as no-ops", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-reorder-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, dashboard([{ id: "alpha", type: "demo-alpha", title: "Alpha" }]));

    await expect(reorderDashboardCards(paths, {
      baseOrder: ["alpha"],
      order: ["alpha"],
    })).resolves.toEqual({ changed: false });
  });

  test("rejects stale base order and invalid permutations", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-reorder-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, dashboard());

    await expectActionError(reorderDashboardCards(paths, {
      baseOrder: ["bravo", "alpha", "charlie"],
      order: ["charlie", "alpha", "bravo"],
    }), 409);

    await expectActionError(reorderDashboardCards(paths, {
      baseOrder: ["alpha", "bravo", "charlie"],
      order: ["alpha", "alpha", "charlie"],
    }), 409);

    await expectActionError(reorderDashboardCards(paths, {
      baseOrder: ["alpha", "bravo", "charlie"],
      order: ["alpha", "bravo", "delta"],
    }), 409);
  });

  test("rejects missing or invalid dashboard files without creating one", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-reorder-"));
    const paths = testPaths(root);

    await expectActionError(reorderDashboardCards(paths, {
      baseOrder: [],
      order: [],
    }), 404);

    await mkdir(dirname(paths.dashboardJson), { recursive: true });
    await writeFile(paths.dashboardJson, "{", "utf8");
    await expectActionError(reorderDashboardCards(paths, {
      baseOrder: ["bad"],
      order: ["bad"],
    }), 409);

    await writeJson(paths.dashboardJson, { schemaVersion: 1, cards: [{ id: "bad", type: "demo", title: "" }] });
    await expectActionError(reorderDashboardCards(paths, {
      baseOrder: ["bad"],
      order: ["bad"],
    }), 409);
  });
});

describe("updateDashboardAppearanceLayout", () => {
  test("updates only raw appearance layout without serializing schema defaults", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-layout-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, {
      ...dashboard(),
      appearance: { defaultTheme: "apple" },
      extensions: { "x-test": { preserved: true } },
    });

    await expect(updateDashboardAppearanceLayout(paths, {
      baseLayout: {},
      layout: { width: "extra-large", maxColumns: 4 },
    })).resolves.toEqual({ changed: true });

    expect(await readJson(paths.dashboardJson)).toEqual({
      ...dashboard(),
      appearance: {
        defaultTheme: "apple",
        layout: { width: "extra-large", maxColumns: 4 },
      },
      extensions: { "x-test": { preserved: true } },
    });
  });

  test("prunes default layout values back out of dashboard.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-layout-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, {
      ...dashboard(),
      appearance: {
        defaultTheme: "basic",
        layout: { width: "small", maxColumns: 4 },
      },
    });

    await expect(updateDashboardAppearanceLayout(paths, {
      baseLayout: { width: "small", maxColumns: 4 },
      layout: { width: "large", maxColumns: 3 },
    })).resolves.toEqual({ changed: true });

    expect(await readJson(paths.dashboardJson)).toEqual({
      ...dashboard(),
      appearance: { defaultTheme: "basic" },
    });
  });

  test("treats equivalent stored layout as a no-op", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-layout-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, {
      ...dashboard(),
      appearance: { layout: { maxColumns: 4 } },
    });

    await expect(updateDashboardAppearanceLayout(paths, {
      baseLayout: { maxColumns: 4 },
      layout: { maxColumns: 4 },
    })).resolves.toEqual({ changed: false });
  });

  test("rejects stale base layout", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-layout-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, {
      ...dashboard(),
      appearance: { layout: { width: "small", maxColumns: 4 } },
    });

    await expectActionError(updateDashboardAppearanceLayout(paths, {
      baseLayout: { width: "large", maxColumns: 3 },
      layout: { width: "medium", maxColumns: 2 },
    }), 409);
  });

  test("rejects invalid layout requests and invalid dashboard files", async () => {
    expect(() => parseUpdateAppearanceLayoutInput({ layout: { width: "small" } })).toThrow(DashboardConfigActionError);
    expect(() => parseUpdateAppearanceLayoutInput({ baseLayout: { width: "huge" }, layout: {} })).toThrow(DashboardConfigActionError);
    expect(() => parseUpdateAppearanceLayoutInput({ baseLayout: {}, layout: { maxColumns: 0 } })).toThrow(DashboardConfigActionError);

    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-layout-"));
    const paths = testPaths(root);
    await expectActionError(updateDashboardAppearanceLayout(paths, {
      baseLayout: {},
      layout: { width: "small" },
    }), 404);

    await writeJson(paths.dashboardJson, { schemaVersion: 1, cards: [{ id: "bad", type: "demo", title: "" }] });
    await expectActionError(updateDashboardAppearanceLayout(paths, {
      baseLayout: {},
      layout: { width: "small" },
    }), 409);
  });
});
