import { describe, expect, test } from "bun:test";
import type { ResolvedCard } from "../shared/schemas";
import { freshnessFor } from "./DashboardCard";

function cardWithFreshness(fetchedAt: string, data: Record<string, unknown> = {}): ResolvedCard {
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
    data,
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

  test("uses a payload timestamp for precomputed snapshot freshness", () => {
    const card = cardWithFreshness("2026-07-08T09:59:55.000Z", {
      demo: { generatedAt: "2026-07-08T07:30:00.000Z" },
    });
    if (!card.definition?.freshness) throw new Error("missing fixture freshness");
    card.definition.freshness.timestampPath = "demo.generatedAt";

    expect(freshnessFor(card, Date.parse("2026-07-08T10:00:00.000Z"))).toEqual({
      label: "source · 3h ago",
      tone: "stale",
    });
  });

  test("falls back to connector freshness when the payload timestamp is invalid", () => {
    const card = cardWithFreshness("2026-07-08T09:59:30.000Z", {
      demo: { generatedAt: "not-a-date" },
    });
    if (!card.definition?.freshness) throw new Error("missing fixture freshness");
    card.definition.freshness.timestampPath = "demo.generatedAt";

    expect(freshnessFor(card, Date.parse("2026-07-08T10:00:00.000Z"))).toEqual({
      label: "source · 30s ago",
      tone: "ok",
    });
  });
});
