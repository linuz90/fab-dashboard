import { describe, expect, test } from "bun:test";
import type { ResolvedCard } from "../shared/schemas";
import { commandSelectionAction, createCommandResults, isTypeToSearchKey, shouldPreviewCommandResult } from "./CommandSearch";

function keyEvent(key: string, overrides: Partial<Parameters<typeof isTypeToSearchKey>[0]> = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    isComposing: false,
    key,
    metaKey: false,
    ...overrides,
  };
}

describe("type-to-search keyboard handling", () => {
  test("accepts unmodified letters and numbers in any script", () => {
    expect(isTypeToSearchKey(keyEvent("f"))).toBe(true);
    expect(isTypeToSearchKey(keyEvent("F"))).toBe(true);
    expect(isTypeToSearchKey(keyEvent("7"))).toBe(true);
    expect(isTypeToSearchKey(keyEvent("è"))).toBe(true);
    expect(isTypeToSearchKey(keyEvent("日"))).toBe(true);
  });

  test("ignores shortcuts, composition, and handled events", () => {
    expect(isTypeToSearchKey(keyEvent("f", { metaKey: true }))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("f", { ctrlKey: true }))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("f", { altKey: true }))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("f", { isComposing: true }))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("f", { defaultPrevented: true }))).toBe(false);
  });

  test("ignores navigation, whitespace, and punctuation", () => {
    expect(isTypeToSearchKey(keyEvent("Enter"))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("ArrowDown"))).toBe(false);
    expect(isTypeToSearchKey(keyEvent(" "))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("/"))).toBe(false);
  });
});

describe("command result selection", () => {
  test("confirms a card while multiple results remain", () => {
    expect(commandSelectionAction("card", 3)).toBe("confirm-card");
    expect(shouldPreviewCommandResult("card", 3)).toBe(false);
  });

  test("selects and previews the sole card result", () => {
    expect(commandSelectionAction("card", 1)).toBe("select-card");
    expect(shouldPreviewCommandResult("card", 1)).toBe(true);
  });

  test("applies themes immediately without previewing them", () => {
    expect(commandSelectionAction("theme", 4)).toBe("apply-theme");
    expect(shouldPreviewCommandResult("theme", 1)).toBe(false);
  });

  test("switches tabs immediately without previewing them", () => {
    expect(commandSelectionAction("tab", 4)).toBe("select-tab");
    expect(shouldPreviewCommandResult("tab", 1)).toBe(false);
  });
});

function card(id: string, title: string, tab?: string): ResolvedCard {
  return {
    instance: {
      id,
      type: "demo-card",
      title,
      size: "half",
      keywords: [],
      options: {},
      tab,
    },
    definition: null,
    data: {},
    freshness: {},
    error: null,
  };
}

describe("command results", () => {
  const cards = [card("tasks", "Tasks", "today"), card("usage", "Usage", "ops")];
  const tabs = [
    { id: "today", label: "Today" },
    { id: "ops", label: "System" },
  ];

  test("finds dashboard tabs by label and id", () => {
    const byLabel = createCommandResults({ cards, tabs, themes: [], query: "system" });
    const byId = createCommandResults({ cards, tabs, themes: [], query: "ops" });

    expect(byLabel.map((result) => result.value)).toEqual(["tab-ops"]);
    expect(byId.map((result) => result.value)).toEqual(["tab-ops"]);
  });

  test("uses the owning tab label as card detail", () => {
    const results = createCommandResults({ cards, tabs, themes: [], query: "usage" });

    expect(results).toHaveLength(1);
    expect(results[0]?.kind).toBe("card");
    expect(results[0]?.detail).toBe("System");
  });

  test("keeps the flat dashboard card detail unchanged", () => {
    const results = createCommandResults({ cards: [card("tasks", "Tasks")], tabs: [], themes: [], query: "tasks" });

    expect(results).toHaveLength(1);
    expect(results[0]?.detail).toBe("card");
  });
});
