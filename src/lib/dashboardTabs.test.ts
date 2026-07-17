import { describe, expect, test } from "bun:test";
import { dashboardTabUrl, mergeWithinTabCardOrder, resolveDashboardTabUrl } from "./dashboardTabs";

const tabs = [
  { id: "today" },
  { id: "system" },
  { id: "later" },
] as const;

describe("dashboard tab URL helpers", () => {
  test("uses the first tab at the parameter-free canonical URL", () => {
    const selection = resolveDashboardTabUrl("https://dashboard.test/?mode=compact#cards", tabs);

    expect(selection.activeTabId).toBe("today");
    expect(selection.shouldReplace).toBe(false);
    expect(selection.canonicalUrl.href).toBe("https://dashboard.test/?mode=compact#cards");
  });

  test("resolves non-default tabs while preserving unrelated URL state", () => {
    const selection = resolveDashboardTabUrl("https://dashboard.test/?mode=compact&tab=system#cards", tabs);

    expect(selection.activeTabId).toBe("system");
    expect(selection.shouldReplace).toBe(false);
    expect(selection.canonicalUrl.href).toBe("https://dashboard.test/?mode=compact&tab=system#cards");
  });

  test("canonicalizes explicit default, invalid, empty, and duplicate parameters", () => {
    for (const query of [
      "mode=compact&tab=today",
      "mode=compact&tab=missing",
      "mode=compact&tab=",
      "mode=compact&tab=system&tab=later",
    ]) {
      const selection = resolveDashboardTabUrl(`https://dashboard.test/?${query}#cards`, tabs);
      const expectedTab = query.includes("tab=system") ? "system" : "today";

      expect(selection.activeTabId).toBe(expectedTab);
      expect(selection.shouldReplace).toBe(true);
      expect(selection.canonicalUrl.searchParams.getAll("tab")).toEqual(expectedTab === "today" ? [] : ["system"]);
      expect(selection.canonicalUrl.searchParams.get("mode")).toBe("compact");
      expect(selection.canonicalUrl.hash).toBe("#cards");
    }
  });

  test("removes stale tab state when dashboard tabs are disabled", () => {
    const selection = resolveDashboardTabUrl("https://dashboard.test/?tab=system&mode=compact", undefined);

    expect(selection.activeTabId).toBeNull();
    expect(selection.shouldReplace).toBe(true);
    expect(selection.canonicalUrl.href).toBe("https://dashboard.test/?mode=compact");
  });

  test("builds tab links without mutating the source URL", () => {
    const source = new URL("https://dashboard.test/?mode=compact#cards");

    expect(dashboardTabUrl(source, tabs, "system").href).toBe("https://dashboard.test/?mode=compact&tab=system#cards");
    expect(dashboardTabUrl(source, tabs, "today").href).toBe("https://dashboard.test/?mode=compact#cards");
    expect(dashboardTabUrl(source, tabs, "missing").href).toBe("https://dashboard.test/?mode=compact#cards");
    expect(source.href).toBe("https://dashboard.test/?mode=compact#cards");
  });
});

describe("within-tab dashboard ordering", () => {
  test("replaces only the selected tab's slots in an interleaved flat order", () => {
    expect(mergeWithinTabCardOrder(
      ["today-a", "system-a", "today-b", "system-b", "today-c"],
      ["today-a", "today-b", "today-c"],
      ["today-c", "today-a", "today-b"],
    )).toEqual(["today-c", "system-a", "today-a", "system-b", "today-b"]);
  });

  test("keeps empty, single-card, and unchanged groups stable", () => {
    const order = ["today-a", "system-a", "system-b"];

    expect(mergeWithinTabCardOrder(order, [], [])).toEqual(order);
    expect(mergeWithinTabCardOrder(order, ["today-a"], ["today-a"])).toEqual(order);
    expect(mergeWithinTabCardOrder(order, ["system-a", "system-b"], ["system-a", "system-b"])).toEqual(order);
  });

  test("rejects unknown, duplicate, missing, and extra card ids", () => {
    expect(() => mergeWithinTabCardOrder(["a", "b"], ["missing"], ["missing"])).toThrow("unknown card id");
    expect(() => mergeWithinTabCardOrder(["a", "a"], ["a"], ["a"])).toThrow("dashboardOrder must contain unique");
    expect(() => mergeWithinTabCardOrder(["a", "b"], ["a", "b"], ["a", "a"])).toThrow("nextTabOrder must contain unique");
    expect(() => mergeWithinTabCardOrder(["a", "b", "c"], ["a", "b"], ["a"])).toThrow("exact permutation");
    expect(() => mergeWithinTabCardOrder(["a", "b", "c"], ["a", "b"], ["a", "c"])).toThrow("exact permutation");
  });
});
