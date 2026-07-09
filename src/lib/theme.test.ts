import { afterEach, describe, expect, test } from "bun:test";
import { applyTheme, applyThemeEnvironment, getStoredTheme, syncThemeWithAppearance, themeEnvironmentForDate, timePhaseForHour } from "./theme";

const originalDocument = globalThis.document;
const originalLocalStorage = globalThis.localStorage;

function installBrowserMocks(initialStorage: Record<string, string> = {}) {
  const storage = new Map(Object.entries(initialStorage));
  const dataset: Record<string, string> = {};

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement: { dataset } },
  });

  return { dataset, storage };
}

afterEach(() => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalLocalStorage });
});

describe("theme runtime helpers", () => {
  test("maps local hours to generic theme time phases", () => {
    expect(timePhaseForHour(0)).toBe("night");
    expect(timePhaseForHour(5)).toBe("dawn");
    expect(timePhaseForHour(8)).toBe("morning");
    expect(timePhaseForHour(12)).toBe("day");
    expect(timePhaseForHour(17)).toBe("dusk");
    expect(timePhaseForHour(20)).toBe("twilight");
    expect(timePhaseForHour(22)).toBe("night");
  });

  test("exposes generic theme environment attributes for any theme", () => {
    const { dataset } = installBrowserMocks();

    expect(themeEnvironmentForDate(new Date("2026-07-09T20:30:00"))).toEqual({
      localHour: 20,
      timePhase: "twilight",
    });

    dataset.livePhase = "day";
    applyThemeEnvironment(new Date("2026-07-09T05:30:00"));
    expect(dataset.localHour).toBe("5");
    expect(dataset.timePhase).toBe("dawn");
    expect(dataset.livePhase).toBeUndefined();

    applyTheme("apple");
    expect(dataset.theme).toBe("apple");
    expect(dataset.timePhase).toBeDefined();
  });

  test("normalizes invalid and legacy stored values", () => {
    const { storage } = installBrowserMocks({ "dashboard-theme": "claude" });
    expect(getStoredTheme()).toBe("basic");
    expect(storage.get("dashboard-theme")).toBe("basic");

    storage.set("dashboard-theme", "missing");
    expect(getStoredTheme()).toBe("basic");
    expect(storage.get("dashboard-theme")).toBe("missing");
  });

  test("waits for dashboard appearance before persisting invalid fallback choices", () => {
    const { dataset, storage } = installBrowserMocks({ "dashboard-theme": "missing" });
    applyTheme(getStoredTheme());

    expect(dataset.theme).toBe("basic");
    expect(storage.get("dashboard-theme")).toBe("missing");
    expect(syncThemeWithAppearance({ defaultTheme: "apple", themes: ["basic", "apple"] })).toBe("apple");
    expect(dataset.theme).toBe("apple");
    expect(storage.get("dashboard-theme")).toBe("apple");
  });

  test("syncs stored themes against dashboard appearance curation", () => {
    const { dataset, storage } = installBrowserMocks({ "dashboard-theme": "e-ink" });
    applyTheme("e-ink");

    expect(syncThemeWithAppearance({ defaultTheme: "live", themes: ["apple", "live"] })).toBe("live");
    expect(dataset.theme).toBe("live");
    expect(storage.get("dashboard-theme")).toBe("live");
  });

  test("uses dashboard default without persisting first-visit fallback", () => {
    const { dataset, storage } = installBrowserMocks();

    expect(syncThemeWithAppearance({ defaultTheme: "apple" })).toBe("apple");
    expect(dataset.theme).toBe("apple");
    expect(storage.has("dashboard-theme")).toBe(false);
  });
});
