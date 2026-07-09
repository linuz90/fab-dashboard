import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  DASHBOARD_CONFIG_MUTATION_HEADER,
  REORDER_CARDS_ACTION,
  UPDATE_APPEARANCE_LAYOUT_ACTION,
} from "../shared/actions";
import { handleReorderCardsRequest, handleUpdateAppearanceLayoutRequest } from "./actionRoute";
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

function request(init: RequestInit = {}) {
  return new Request("http://127.0.0.1:7893/api/dashboard/cards/reorder", init);
}

function layoutRequest(init: RequestInit = {}) {
  return new Request("http://127.0.0.1:7893/api/dashboard/appearance/layout", init);
}

function validHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    "Content-Type": "application/json",
    [DASHBOARD_CONFIG_MUTATION_HEADER]: REORDER_CARDS_ACTION,
    ...extra,
  };
}

function validBody() {
  return JSON.stringify({
    baseOrder: ["alpha", "bravo"],
    order: ["bravo", "alpha"],
  });
}

function layoutHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    "Content-Type": "application/json",
    [DASHBOARD_CONFIG_MUTATION_HEADER]: UPDATE_APPEARANCE_LAYOUT_ACTION,
    ...extra,
  };
}

describe("handleReorderCardsRequest", () => {
  test("rejects writes when config mutations are disabled", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-route-"));
    const paths = testPaths(root);

    const response = await handleReorderCardsRequest(request({
      method: "POST",
      headers: validHeaders(),
      body: validBody(),
    }), paths);

    expect(response.status).toBe(403);
  });

  test("guards method, action header, origin, and content type", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-route-"));
    const paths = testPaths(root);

    const options = { mutationsAllowed: true };
    expect((await handleReorderCardsRequest(request({ method: "GET" }), paths, options)).status).toBe(405);
    expect((await handleReorderCardsRequest(request({ method: "POST", headers: { "Content-Type": "application/json" } }), paths, options)).status).toBe(403);
    expect((await handleReorderCardsRequest(request({
      method: "POST",
      headers: validHeaders({ Origin: "https://evil.example" }),
      body: validBody(),
    }), paths, options)).status).toBe(403);
    expect((await handleReorderCardsRequest(request({
      method: "POST",
      headers: validHeaders({ "Sec-Fetch-Site": "cross-site" }),
      body: validBody(),
    }), paths, options)).status).toBe(403);
    expect((await handleReorderCardsRequest(request({
      method: "POST",
      headers: { [DASHBOARD_CONFIG_MUTATION_HEADER]: REORDER_CARDS_ACTION },
      body: validBody(),
    }), paths, options)).status).toBe(415);
  });

  test("reorders through allowed local dev origin", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-route-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, {
      schemaVersion: 1,
      title: "test",
      refreshSeconds: 30,
      cards: [
        { id: "alpha", type: "demo-alpha", title: "Alpha" },
        { id: "bravo", type: "demo-bravo", title: "Bravo" },
      ],
    });

    const response = await handleReorderCardsRequest(request({
      method: "POST",
      headers: validHeaders({ Origin: "http://127.0.0.1:5193" }),
      body: validBody(),
    }), paths, { mutationsAllowed: true });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, changed: true });
    expect(await readJson(paths.dashboardJson)).toMatchObject({
      cards: [
        { id: "bravo" },
        { id: "alpha" },
      ],
    });
  });

  test("returns request errors without writing", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-route-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, {
      schemaVersion: 1,
      title: "test",
      refreshSeconds: 30,
      cards: [
        { id: "alpha", type: "demo-alpha", title: "Alpha" },
        { id: "bravo", type: "demo-bravo", title: "Bravo" },
      ],
    });

    const malformed = await handleReorderCardsRequest(request({
      method: "POST",
      headers: validHeaders(),
      body: "{",
    }), paths, { mutationsAllowed: true });
    expect(malformed.status).toBe(400);

    const stale = await handleReorderCardsRequest(request({
      method: "POST",
      headers: validHeaders(),
      body: JSON.stringify({
        baseOrder: ["bravo", "alpha"],
        order: ["alpha", "bravo"],
      }),
    }), paths, { mutationsAllowed: true });
    expect(stale.status).toBe(409);

    await writeFile(paths.dashboardJson, "{", "utf8");
    const invalidConfig = await handleReorderCardsRequest(request({
      method: "POST",
      headers: validHeaders(),
      body: validBody(),
    }), paths, { mutationsAllowed: true });
    expect(invalidConfig.status).toBe(409);
  });
});

describe("handleUpdateAppearanceLayoutRequest", () => {
  test("guards writes with the same local mutation protections", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-route-"));
    const paths = testPaths(root);
    const body = JSON.stringify({ baseLayout: {}, layout: { width: "small", maxColumns: 2 } });

    const disabled = await handleUpdateAppearanceLayoutRequest(layoutRequest({
      method: "POST",
      headers: layoutHeaders(),
      body,
    }), paths);
    expect(disabled.status).toBe(403);

    const options = { mutationsAllowed: true };
    expect((await handleUpdateAppearanceLayoutRequest(layoutRequest({ method: "GET" }), paths, options)).status).toBe(405);
    expect((await handleUpdateAppearanceLayoutRequest(layoutRequest({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }), paths, options)).status).toBe(403);
    expect((await handleUpdateAppearanceLayoutRequest(layoutRequest({
      method: "POST",
      headers: layoutHeaders({ Origin: "https://evil.example" }),
      body,
    }), paths, options)).status).toBe(403);
    expect((await handleUpdateAppearanceLayoutRequest(layoutRequest({
      method: "POST",
      headers: layoutHeaders({ "Sec-Fetch-Site": "cross-site" }),
      body,
    }), paths, options)).status).toBe(403);
    expect((await handleUpdateAppearanceLayoutRequest(layoutRequest({
      method: "POST",
      headers: { [DASHBOARD_CONFIG_MUTATION_HEADER]: UPDATE_APPEARANCE_LAYOUT_ACTION },
      body,
    }), paths, options)).status).toBe(415);
  });

  test("updates layout through allowed local dev origin", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-route-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, {
      schemaVersion: 1,
      title: "test",
      refreshSeconds: 30,
      cards: [
        { id: "alpha", type: "demo-alpha", title: "Alpha" },
      ],
    });

    const response = await handleUpdateAppearanceLayoutRequest(layoutRequest({
      method: "POST",
      headers: layoutHeaders({ Origin: "http://127.0.0.1:5193" }),
      body: JSON.stringify({ baseLayout: {}, layout: { width: "extra-large", maxColumns: 4 } }),
    }), paths, { mutationsAllowed: true });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, changed: true });
    expect(await readJson(paths.dashboardJson)).toMatchObject({
      appearance: {
        layout: { width: "extra-large", maxColumns: 4 },
      },
    });
  });

  test("updates layout through an explicitly trusted Tailscale Serve origin", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-route-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, {
      schemaVersion: 1,
      title: "test",
      refreshSeconds: 30,
      cards: [],
    });

    const response = await handleUpdateAppearanceLayoutRequest(new Request("http://example.tailnet.ts.net/api/dashboard/appearance/layout", {
      method: "POST",
      headers: layoutHeaders({ Origin: "https://example.tailnet.ts.net" }),
      body: JSON.stringify({ baseLayout: {}, layout: { width: "medium", maxColumns: 2 } }),
    }), paths, {
      mutationsAllowed: true,
      publicOrigin: "https://example.tailnet.ts.net",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, changed: true });
    expect(await readJson(paths.dashboardJson)).toMatchObject({
      appearance: {
        layout: { width: "medium", maxColumns: 2 },
      },
    });
  });

  test("returns layout request errors without writing", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-route-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, {
      schemaVersion: 1,
      title: "test",
      refreshSeconds: 30,
      cards: [],
    });

    const malformed = await handleUpdateAppearanceLayoutRequest(layoutRequest({
      method: "POST",
      headers: layoutHeaders(),
      body: "{",
    }), paths, { mutationsAllowed: true });
    expect(malformed.status).toBe(400);

    const invalidLayout = await handleUpdateAppearanceLayoutRequest(layoutRequest({
      method: "POST",
      headers: layoutHeaders(),
      body: JSON.stringify({ baseLayout: {}, layout: { maxColumns: 5 } }),
    }), paths, { mutationsAllowed: true });
    expect(invalidLayout.status).toBe(400);

    await writeFile(paths.dashboardJson, "{", "utf8");
    const invalidConfig = await handleUpdateAppearanceLayoutRequest(layoutRequest({
      method: "POST",
      headers: layoutHeaders(),
      body: JSON.stringify({ baseLayout: {}, layout: { width: "small" } }),
    }), paths, { mutationsAllowed: true });
    expect(invalidConfig.status).toBe(409);
  });

  test("returns conflict when base layout is stale", async () => {
    const root = await mkdtemp(join(tmpdir(), "fab-dashboard-route-"));
    const paths = testPaths(root);
    await writeJson(paths.dashboardJson, {
      schemaVersion: 1,
      title: "test",
      refreshSeconds: 30,
      appearance: { layout: { width: "small", maxColumns: 4 } },
      cards: [],
    });

    const response = await handleUpdateAppearanceLayoutRequest(layoutRequest({
      method: "POST",
      headers: layoutHeaders(),
      body: JSON.stringify({
        baseLayout: { width: "large", maxColumns: 3 },
        layout: { width: "medium", maxColumns: 2 },
      }),
    }), paths, { mutationsAllowed: true });

    expect(response.status).toBe(409);
  });
});
