import { describe, expect, test } from "bun:test";
import type { ResolvedCard } from "../shared/schemas";
import { freshnessFor } from "./DashboardCard";

function cardWithFreshness(fetchedAt: string): ResolvedCard {
  return {
    instance: {
      id: "demo",
      type: "demo",
      title: "Demo",
      size: "half",
      keywords: [],
      options: {},
    },
    definition: {
      schemaVersion: 1,
      type: "demo",
      connectors: ["demo-source"],
      keywords: [],
      options: { defaults: {} },
      freshness: { connector: "demo-source", label: "source", staleAfterSeconds: 60 },
      visual: {},
      blocks: [{ type: "text", text: "Demo", variant: "body" }],
    },
    data: {},
    freshness: {
      "demo-source": {
        status: "fresh",
        fetchedAt,
        ttlMs: 0,
        error: null,
        refreshing: false,
      },
    },
    error: null,
  };
}

describe("freshnessFor", () => {
  test("marks fresh connector data stale when card staleAfterSeconds has elapsed", () => {
    const now = Date.parse("2026-07-08T10:00:00.000Z");
    expect(freshnessFor(cardWithFreshness("2026-07-08T09:58:30.000Z"), now)).toEqual({
      label: "source · 2 min ago",
      tone: "stale",
    });
  });

  test("keeps fresh connector data ok before staleAfterSeconds elapses", () => {
    const now = Date.parse("2026-07-08T10:00:00.000Z");
    expect(freshnessFor(cardWithFreshness("2026-07-08T09:59:30.000Z"), now)).toEqual({
      label: "source · 30s ago",
      tone: "ok",
    });
  });
});
