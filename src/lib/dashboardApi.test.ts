import { afterEach, describe, expect, test } from "bun:test";
import {
  DASHBOARD_CONFIG_MUTATION_HEADER,
  REORDER_CARDS_ACTION,
  UPDATE_APPEARANCE_LAYOUT_ACTION,
} from "../shared/actions";
import {
  DashboardApiError,
  dashboardRefetchInterval,
  hasRefreshingSources,
  normalizeDashboardResponse,
  reorderDashboardCardsAction,
  updateDashboardLayoutAction,
} from "./dashboardApi";
import type { DashboardResponse } from "../shared/schemas";

function minimalResponse(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-08T10:00:00.000Z",
    configError: null,
    config: {
      schemaVersion: 1,
      title: "Demo",
      refreshSeconds: 30,
      header: { widgets: [] },
      appearance: { defaultTheme: "basic" },
      cards: [],
    },
    capabilities: { canMutateConfig: true },
    header: { widgets: [] },
    cards: [],
    sources: {},
    ...overrides,
  };
}

describe("dashboard API helpers", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("normalizes older dashboard responses without header, sources, or refreshSeconds", () => {
    const legacy = {
      schemaVersion: 1,
      generatedAt: "2026-07-08T10:00:00.000Z",
      configError: null,
      header: undefined,
      cards: [],
      sources: undefined,
      config: {
        ...minimalResponse().config,
        appearance: undefined,
        header: undefined,
        refreshSeconds: undefined,
      },
    } as Parameters<typeof normalizeDashboardResponse>[0];
    const normalized = normalizeDashboardResponse(legacy);

    expect(normalized.header.widgets).toEqual([]);
    expect(normalized.config.header.widgets).toEqual([]);
    expect(normalized.sources).toEqual({});
    expect(normalized.config.refreshSeconds).toBe(30);
    expect(normalized.config.appearance).toEqual({ defaultTheme: "basic" });
    expect(normalized.capabilities.canMutateConfig).toBe(false);
  });

  test("normalizes legacy reorder capability as config mutation capability", () => {
    const legacy = {
      ...minimalResponse(),
      capabilities: { canReorderCards: true },
    } as Parameters<typeof normalizeDashboardResponse>[0];

    expect(normalizeDashboardResponse(legacy).capabilities.canMutateConfig).toBe(true);
  });

  test("uses defaults when refetch interval data is missing", () => {
    expect(hasRefreshingSources(undefined)).toBe(false);
    expect(dashboardRefetchInterval(undefined)).toBe(5_000);
    expect(dashboardRefetchInterval(normalizeDashboardResponse({
      ...minimalResponse(),
      sources: undefined,
      config: {
        ...minimalResponse().config,
        header: undefined,
        refreshSeconds: undefined,
      },
    }))).toBe(30_000);
  });

  test("polls faster while any connector is refreshing", () => {
    const resp = minimalResponse({
      sources: {
        demo: {
          status: "stale",
          fetchedAt: "2026-07-08T09:59:00.000Z",
          ttlMs: 30_000,
          error: null,
          refreshing: true,
        },
      },
    });

    expect(hasRefreshingSources(resp)).toBe(true);
    expect(dashboardRefetchInterval(resp)).toBe(3_000);
  });

  test("posts guarded card reorder mutations", async () => {
    const captured: Array<{ url: string | URL | Request; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      captured.push({ url, init });
      return Promise.resolve(Response.json({ ok: true, changed: true }));
    }) as unknown as typeof fetch;

    await expect(reorderDashboardCardsAction({
      baseOrder: ["one", "two"],
      order: ["two", "one"],
    })).resolves.toEqual({ ok: true, changed: true });

    const request = captured[0]!;
    expect(request.url).toBe("/api/dashboard/cards/reorder");
    expect(request.init?.method).toBe("POST");
    expect(request.init?.headers).toMatchObject({
      "Content-Type": "application/json",
      [DASHBOARD_CONFIG_MUTATION_HEADER]: REORDER_CARDS_ACTION,
    });
    expect(JSON.parse(String(request.init?.body))).toEqual({
      baseOrder: ["one", "two"],
      order: ["two", "one"],
    });
  });

  test("posts guarded layout mutations", async () => {
    const captured: Array<{ url: string | URL | Request; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      captured.push({ url, init });
      return Promise.resolve(Response.json({ ok: true, changed: true }));
    }) as unknown as typeof fetch;

    await expect(updateDashboardLayoutAction({
      baseLayout: { width: "large", maxColumns: 3 },
      layout: { width: "extra-large", maxColumns: 4 },
    })).resolves.toEqual({ ok: true, changed: true });

    const request = captured[0]!;
    expect(request.url).toBe("/api/dashboard/appearance/layout");
    expect(request.init?.method).toBe("POST");
    expect(request.init?.headers).toMatchObject({
      "Content-Type": "application/json",
      [DASHBOARD_CONFIG_MUTATION_HEADER]: UPDATE_APPEARANCE_LAYOUT_ACTION,
    });
    expect(JSON.parse(String(request.init?.body))).toEqual({
      baseLayout: { width: "large", maxColumns: 3 },
      layout: { width: "extra-large", maxColumns: 4 },
    });
  });

  test("preserves action response status on errors", async () => {
    globalThis.fetch = (() => Promise.resolve(Response.json({ error: "conflict" }, { status: 409 }))) as unknown as typeof fetch;

    try {
      await reorderDashboardCardsAction({ baseOrder: ["one"], order: ["one"] });
    } catch (error) {
      expect(error).toBeInstanceOf(DashboardApiError);
      expect((error as DashboardApiError).status).toBe(409);
      expect((error as Error).message).toBe("conflict");
      return;
    }

    throw new Error("expected reorderDashboardCardsAction to throw");
  });
});
