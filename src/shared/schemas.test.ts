import { describe, expect, test } from "bun:test";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { LUCIDE_ICON_NAMES } from "./lucideIcons";
import { cardDefinitionSchema, dashboardConfigSchema } from "./schemas";

describe("dashboardConfigSchema", () => {
  test("accepts connector-backed header widgets", () => {
    const result = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      header: {
        widgets: [
          { id: "weather", kind: "weather", connector: "demo", path: "demo.weather", staleAfterSeconds: 1800 },
          { id: "focus", kind: "label", connector: "demo", icon: "moon", labelPath: "demo.focus", tonePath: "demo.tone" },
        ],
      },
      cards: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.header.widgets).toHaveLength(2);
      expect(result.data.appearance).toEqual({});
    }
  });

  test("accepts dashboard theme appearance curation", () => {
    const result = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      appearance: {
        defaultTheme: "live",
        themes: ["basic", "apple", "live"],
        layout: { width: "extra-large", maxColumns: 4 },
      },
      cards: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.appearance).toEqual({
        defaultTheme: "live",
        themes: ["basic", "apple", "live"],
        layout: { width: "extra-large", maxColumns: 4 },
      });
    }
  });

  test("rejects invalid dashboard appearance curation", () => {
    const unknownTheme = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      appearance: { themes: ["basic", "not-a-theme"] },
      cards: [],
    });
    const emptyThemes = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      appearance: { themes: [] },
      cards: [],
    });
    const duplicateThemes = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      appearance: { themes: ["basic", "basic"] },
      cards: [],
    });
    const disabledDefault = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      appearance: { defaultTheme: "basic", themes: ["apple", "live"] },
      cards: [],
    });
    const unknownWidth = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      appearance: { layout: { width: "huge" } },
      cards: [],
    });
    const tooManyColumns = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      appearance: { layout: { maxColumns: 5 } },
      cards: [],
    });

    expect(unknownTheme.success).toBe(false);
    expect(emptyThemes.success).toBe(false);
    expect(duplicateThemes.success).toBe(false);
    expect(disabledDefault.success).toBe(false);
    expect(unknownWidth.success).toBe(false);
    expect(tooManyColumns.success).toBe(false);
  });

  test("rejects duplicate card ids", () => {
    const result = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      cards: [
        { id: "one", type: "demo", title: "One" },
        { id: "one", type: "demo", title: "Again" },
      ],
    });
    expect(result.success).toBe(false);
  });

  test("accepts ordered dashboard tabs with explicit card membership and empty tabs", () => {
    const result = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      tabs: [
        { id: "today", label: "  Today  " },
        { id: "system", label: "System" },
        { id: "later", label: "Later" },
      ],
      cards: [
        { id: "tasks", type: "demo", title: "Tasks", tab: "today" },
        { id: "usage", type: "demo", title: "Usage", tab: "system" },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tabs?.map((tab) => tab.id)).toEqual(["today", "system", "later"]);
      expect(result.data.tabs?.[0]?.label).toBe("Today");
      expect(result.data.cards.map((card) => card.tab)).toEqual(["today", "system"]);
    }
  });

  test("rejects invalid dashboard tab definitions", () => {
    const oneTab = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      tabs: [{ id: "today", label: "Today" }],
      cards: [],
    });
    const tooManyTabs = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      tabs: Array.from({ length: 9 }, (_, index) => ({ id: `tab-${index}`, label: `Tab ${index}` })),
      cards: [],
    });
    const duplicateTabs = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      tabs: [
        { id: "today", label: "Today" },
        { id: "today", label: "Again" },
      ],
      cards: [],
    });
    const blankLabel = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      tabs: [
        { id: "today", label: "   " },
        { id: "system", label: "System" },
      ],
      cards: [],
    });

    expect(oneTab.success).toBe(false);
    expect(tooManyTabs.success).toBe(false);
    expect(duplicateTabs.success).toBe(false);
    expect(blankLabel.success).toBe(false);
  });

  test("requires complete and valid tab membership only when dashboard tabs exist", () => {
    const tabWithoutDefinitions = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      cards: [{ id: "tasks", type: "demo", title: "Tasks", tab: "today" }],
    });
    const missingMembership = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      tabs: [
        { id: "today", label: "Today" },
        { id: "system", label: "System" },
      ],
      cards: [{ id: "tasks", type: "demo", title: "Tasks" }],
    });
    const unknownMembership = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      tabs: [
        { id: "today", label: "Today" },
        { id: "system", label: "System" },
      ],
      cards: [{ id: "tasks", type: "demo", title: "Tasks", tab: "later" }],
    });
    const flatDashboard = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      cards: [{ id: "tasks", type: "demo", title: "Tasks" }],
    });

    expect(tabWithoutDefinitions.success).toBe(false);
    expect(missingMembership.success).toBe(false);
    expect(unknownMembership.success).toBe(false);
    expect(flatDashboard.success).toBe(true);
  });

  test("keeps card ids globally unique across dashboard tabs", () => {
    const result = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      tabs: [
        { id: "today", label: "Today" },
        { id: "system", label: "System" },
      ],
      cards: [
        { id: "status", type: "demo", title: "Today status", tab: "today" },
        { id: "status", type: "demo", title: "System status", tab: "system" },
      ],
    });

    expect(result.success).toBe(false);
  });

  test("rejects duplicate header widget ids and unknown widget icons", () => {
    const duplicates = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      header: {
        widgets: [
          { id: "weather", kind: "weather", connector: "demo", path: "demo.weather" },
          { id: "weather", kind: "label", connector: "demo", label: "Again" },
        ],
      },
      cards: [],
    });
    const unknownIcon = dashboardConfigSchema.safeParse({
      schemaVersion: 1,
      header: {
        widgets: [{ id: "focus", kind: "label", connector: "demo", icon: "not-a-lucide-icon", label: "Focus" }],
      },
      cards: [],
    });

    expect(duplicates.success).toBe(false);
    expect(unknownIcon.success).toBe(false);
  });
});

describe("cardDefinitionSchema", () => {
  test("accepts Lucide visual metadata and dense dashboard primitives", () => {
    const result = cardDefinitionSchema.safeParse({
      schemaVersion: 1,
      type: "visual-card",
      connectors: ["demo"],
      freshness: { connector: "demo", label: "demo", staleAfterSeconds: 90, timestampPath: "demo.generatedAt" },
      visual: { icon: "calendar-days", accent: "purple" },
      blocks: [
        {
          type: "metric",
          label: "Recovery",
          valuePath: "demo.score",
          pillPath: "demo.status",
          deltaPath: "demo.delta",
          sparklinePath: "demo.history",
          tonePath: "demo.tone",
        },
        {
          type: "rows",
          rows: [
            {
              label: "Sleep",
              visibleWhen: { path: "demo.showSleep", equals: true },
              valuePath: "demo.sleep",
              valueTonePath: "demo.sleepTone",
              valueVariant: "badge",
              icon: "moon",
              hintPath: "demo.sleepHint",
              progressPath: "demo.sleepPct",
              sparklinePath: "demo.sleepTrend",
              sparklineVariant: "bars",
            },
          ],
        },
        {
          type: "status",
          label: "Focus",
          tonePath: "demo.tone",
          messagePath: "demo.summary",
          valuePath: "demo.focus",
          valueTonePath: "demo.focusTone",
          valueVariant: "badge",
        },
        {
          type: "allocation",
          path: "demo.slices",
          keyPath: "key",
          labelPath: "label",
          valuePath: "pct",
          valueLabelPath: "pctLabel",
          metaPath: "move",
          tonePath: "tone",
        },
        {
          type: "leaderboard",
          path: "demo.standings",
          rankPath: "rank",
          titlePath: "name",
          subtitlePath: "team",
          valuePath: "points",
          deltaPath: "delta",
          colorKeyPath: "teamId",
          progressPath: "progress",
        },
        {
          type: "list",
          path: "demo.items",
          variant: "feed",
          density: "compact",
          titlePath: "title",
          metaPath: "meta",
          textPath: "text",
          iconPath: "icon",
          fallbackIcon: "message-square",
          tonePath: "tone",
          chipsPath: "chips",
          countPath: "likes",
          countIcon: "heart",
          progressPath: "progressPct",
        },
        {
          type: "action-row",
          actions: [{ id: "refresh", label: "Refresh", icon: "refresh-cw", display: "icon" }],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visual).toEqual({ icon: "calendar-days", accent: "purple" });
    }
  });

  test("defaults visual metadata when omitted", () => {
    const result = cardDefinitionSchema.safeParse({
      schemaVersion: 1,
      type: "plain-card",
      blocks: [{ type: "text", text: "Hello" }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visual).toEqual({});
    }
  });

  test("rejects unknown Lucide icons and accent tokens", () => {
    const unknownIcon = cardDefinitionSchema.safeParse({
      schemaVersion: 1,
      type: "bad-icon",
      visual: { icon: "not-a-lucide-icon" },
      blocks: [{ type: "text", text: "Nope" }],
    });
    const unknownAccent = cardDefinitionSchema.safeParse({
      schemaVersion: 1,
      type: "bad-accent",
      visual: { accent: "orange" },
      blocks: [{ type: "text", text: "Nope" }],
    });

    expect(unknownIcon.success).toBe(false);
    expect(unknownAccent.success).toBe(false);
  });

  test("Lucide schema metadata follows the installed package", () => {
    expect(LUCIDE_ICON_NAMES).toEqual(Object.keys(dynamicIconImports).sort());
    expect(LUCIDE_ICON_NAMES).toContain("activity");
    expect(LUCIDE_ICON_NAMES).toContain("calendar-days");
    expect(LUCIDE_ICON_NAMES).toContain("refresh-cw");
  });

  test("rejects nested tabs", () => {
    const result = cardDefinitionSchema.safeParse({
      schemaVersion: 1,
      type: "nested-tabs",
      connectors: [],
      blocks: [
        {
          type: "tabs",
          id: "outer",
          defaultTab: "a",
          tabs: [
            {
              id: "a",
              label: "A",
              blocks: [
                {
                  type: "tabs",
                  id: "inner",
                  defaultTab: "b",
                  tabs: [{ id: "b", label: "B", blocks: [{ type: "text", text: "Nope" }] }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
