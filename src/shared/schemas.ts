import { z } from "zod";
import {
  DASHBOARD_LAYOUT_MAX_COLUMNS,
  DASHBOARD_LAYOUT_MIN_COLUMNS,
  DASHBOARD_LAYOUT_WIDTHS,
} from "./layout";
import { isLucideIconName } from "./lucideIcons";
import { ALL_THEMES, type ThemeId } from "./themes";

export const SCHEMA_VERSION = 1;

const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*$/, "use a lowercase slug: letters, numbers, and dashes");

const extensionMetadataSchema = z.record(z.string().regex(/^x-/), z.unknown()).optional();

export const cardSizeSchema = z.enum(["half", "full"]);

export const cardInstanceSchema = z.object({
  id: slugSchema,
  type: slugSchema,
  title: z.string().min(1).max(96),
  size: cardSizeSchema.default("half"),
  keywords: z.array(z.string().trim().min(1).max(48)).max(24).default([]),
  options: z.record(z.string(), z.unknown()).default({}),
  tab: slugSchema.optional(),
}).strict();

export const dashboardTabSchema = z.object({
  id: slugSchema,
  label: z.string().trim().min(1).max(40),
}).strict();

const dataPathSchema = z.string().min(1).max(240);
const toneSchema = z.enum(["ok", "info", "success", "warning", "danger", "muted"]);
const iconNameSchema = z.string().min(1).max(64).refine(isLucideIconName, {
  message: "use a valid lucide icon slug, e.g. activity, calendar-days, message-square",
});
const accentSchema = z.enum(["blue", "green", "yellow", "red", "purple", "pink", "teal", "muted"]);
const listVariantSchema = z.enum(["plain", "check", "timeline", "feed", "media"]);
const densitySchema = z.enum(["normal", "compact"]);
const valueVariantSchema = z.enum(["text", "badge"]);
const themeIdSchema = z.enum(ALL_THEMES);
export const dashboardLayoutConfigSchema = z.object({
  width: z.enum(DASHBOARD_LAYOUT_WIDTHS).optional(),
  maxColumns: z.number().int().min(DASHBOARD_LAYOUT_MIN_COLUMNS).max(DASHBOARD_LAYOUT_MAX_COLUMNS).optional(),
}).strict();

export const headerWidgetSchema = z.discriminatedUnion("kind", [
  z.object({
    id: slugSchema,
    kind: z.literal("label"),
    connector: slugSchema,
    icon: iconNameSchema.optional(),
    label: z.string().max(48).optional(),
    labelPath: dataPathSchema.optional(),
    tooltip: z.string().max(180).optional(),
    tooltipPath: dataPathSchema.optional(),
    tone: toneSchema.optional(),
    tonePath: dataPathSchema.optional(),
    hrefPath: dataPathSchema.optional(),
    staleAfterSeconds: z.number().int().min(1).optional(),
  }).strict(),
  z.object({
    id: slugSchema,
    kind: z.literal("weather"),
    connector: slugSchema,
    path: dataPathSchema,
    staleAfterSeconds: z.number().int().min(1).optional(),
  }).strict(),
]).superRefine((widget, ctx) => {
  if (widget.kind !== "label") return;
  if (widget.label || widget.labelPath) return;
  ctx.addIssue({
    code: "custom",
    message: "label widgets require label or labelPath",
    path: ["label"],
  });
});

const dashboardHeaderSchema = z.object({
  widgets: z.array(headerWidgetSchema).max(8).default([]),
}).strict().default({ widgets: [] });

export const dashboardAppearanceSchema = z.object({
  defaultTheme: themeIdSchema.optional(),
  themes: z.array(themeIdSchema).min(1).max(ALL_THEMES.length).optional(),
  layout: dashboardLayoutConfigSchema.optional(),
}).strict().default({}).superRefine((appearance, ctx) => {
  const themes = appearance.themes;
  if (!themes) return;

  const seen = new Set<ThemeId>();
  themes.forEach((theme, index) => {
    if (!seen.has(theme)) {
      seen.add(theme);
      return;
    }
    ctx.addIssue({
      code: "custom",
      path: ["themes", index],
      message: `duplicate theme id "${theme}"`,
    });
  });

  if (appearance.defaultTheme && !seen.has(appearance.defaultTheme)) {
    ctx.addIssue({
      code: "custom",
      path: ["defaultTheme"],
      message: `defaultTheme "${appearance.defaultTheme}" must be included in appearance.themes`,
    });
  }
});

export const dashboardConfigSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  title: z.string().min(1).max(64).default("fab-dashboard"),
  refreshSeconds: z.number().int().min(5).max(3600).default(30),
  header: dashboardHeaderSchema,
  appearance: dashboardAppearanceSchema,
  tabs: z.array(dashboardTabSchema).min(2).max(8).optional(),
  cards: z.array(cardInstanceSchema).default([]),
  extensions: extensionMetadataSchema,
}).strict().superRefine((config, ctx) => {
  const seen = new Set<string>();
  config.cards.forEach((card, index) => {
    if (!seen.has(card.id)) {
      seen.add(card.id);
      return;
    }
    ctx.addIssue({
      code: "custom",
      path: ["cards", index, "id"],
      message: `duplicate card id "${card.id}"`,
    });
  });

  const tabIds = new Set<string>();
  config.tabs?.forEach((tab, index) => {
    if (!tabIds.has(tab.id)) {
      tabIds.add(tab.id);
      return;
    }
    ctx.addIssue({
      code: "custom",
      path: ["tabs", index, "id"],
      message: `duplicate tab id "${tab.id}"`,
    });
  });

  config.cards.forEach((card, index) => {
    if (!config.tabs) {
      if (card.tab) {
        ctx.addIssue({
          code: "custom",
          path: ["cards", index, "tab"],
          message: `card tab "${card.tab}" requires top-level tabs`,
        });
      }
      return;
    }

    if (!card.tab) {
      ctx.addIssue({
        code: "custom",
        path: ["cards", index, "tab"],
        message: "cards in a tabbed dashboard must declare a tab",
      });
      return;
    }
    if (!tabIds.has(card.tab)) {
      ctx.addIssue({
        code: "custom",
        path: ["cards", index, "tab"],
        message: `unknown dashboard tab "${card.tab}"`,
      });
    }
  });

  const headerWidgetIds = new Set<string>();
  config.header.widgets.forEach((widget, index) => {
    if (!headerWidgetIds.has(widget.id)) {
      headerWidgetIds.add(widget.id);
      return;
    }
    ctx.addIssue({
      code: "custom",
      path: ["header", "widgets", index, "id"],
      message: `duplicate header widget id "${widget.id}"`,
    });
  });
});

export type CardInstance = z.infer<typeof cardInstanceSchema>;
export type DashboardTab = z.infer<typeof dashboardTabSchema>;
export type DashboardAppearance = z.infer<typeof dashboardAppearanceSchema>;
export type HeaderWidgetDefinition = z.infer<typeof headerWidgetSchema>;
export type DashboardConfig = z.infer<typeof dashboardConfigSchema>;

const conditionSchema = z.object({
  path: dataPathSchema,
  equals: z.unknown().optional(),
  exists: z.boolean().optional(),
}).strict();

const baseBlockSchema = z.object({
  id: slugSchema.optional(),
  visibleWhen: conditionSchema.optional(),
}).strict();

export const blockSchema: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion("type", [
    baseBlockSchema.extend({
      type: z.literal("text"),
      text: z.string().max(480).optional(),
      path: dataPathSchema.optional(),
      variant: z.enum(["title", "body", "muted", "mono", "caption"]).default("body"),
      empty: z.string().max(160).optional(),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("metric"),
      label: z.string().min(1).max(80),
      value: z.string().max(80).optional(),
      valuePath: dataPathSchema.optional(),
      unit: z.string().max(16).optional(),
      pill: z.string().max(40).optional(),
      pillPath: dataPathSchema.optional(),
      deltaPath: dataPathSchema.optional(),
      sparklinePath: dataPathSchema.optional(),
      tonePath: dataPathSchema.optional(),
      tone: toneSchema.default("info"),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("rows"),
      rows: z.array(z.object({
        label: z.string().min(1).max(80),
        visibleWhen: conditionSchema.optional(),
        value: z.string().max(120).optional(),
        valuePath: dataPathSchema.optional(),
        tonePath: dataPathSchema.optional(),
        valueTonePath: dataPathSchema.optional(),
        icon: iconNameSchema.optional(),
        hint: z.string().max(80).optional(),
        hintPath: dataPathSchema.optional(),
        valueVariant: valueVariantSchema.default("text"),
        progressPath: dataPathSchema.optional(),
        progressMax: z.number().positive().max(1_000_000).default(100),
        sparklinePath: dataPathSchema.optional(),
        sparklineVariant: z.enum(["line", "bars"]).default("line"),
      }).strict()).min(1).max(16),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("allocation"),
      path: dataPathSchema,
      limit: z.number().int().min(1).max(12).default(8),
      keyPath: dataPathSchema.optional(),
      labelPath: dataPathSchema,
      valuePath: dataPathSchema,
      valueLabelPath: dataPathSchema.optional(),
      metaPath: dataPathSchema.optional(),
      tonePath: dataPathSchema.optional(),
      empty: z.string().max(160).default("Nothing to show."),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("leaderboard"),
      path: dataPathSchema,
      limit: z.number().int().min(1).max(20).default(10),
      rankPath: dataPathSchema.optional(),
      titlePath: dataPathSchema,
      subtitlePath: dataPathSchema.optional(),
      valuePath: dataPathSchema.optional(),
      deltaPath: dataPathSchema.optional(),
      colorKeyPath: dataPathSchema.optional(),
      progressPath: dataPathSchema.optional(),
      empty: z.string().max(160).default("Nothing to show."),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("list"),
      path: dataPathSchema,
      variant: listVariantSchema.default("plain"),
      density: densitySchema.default("normal"),
      limit: z.number().int().min(1).max(20).default(5),
      titlePath: dataPathSchema,
      metaPath: dataPathSchema.optional(),
      textPath: dataPathSchema.optional(),
      hrefPath: dataPathSchema.optional(),
      sectionPath: dataPathSchema.optional(),
      icon: iconNameSchema.optional(),
      iconPath: dataPathSchema.optional(),
      fallbackIcon: iconNameSchema.optional(),
      tonePath: dataPathSchema.optional(),
      checkedPath: dataPathSchema.optional(),
      mutedPath: dataPathSchema.optional(),
      imagePath: dataPathSchema.optional(),
      chipsPath: dataPathSchema.optional(),
      countPath: dataPathSchema.optional(),
      countIcon: iconNameSchema.optional(),
      progressPath: dataPathSchema.optional(),
      progressMax: z.number().positive().max(1_000_000).default(100),
      empty: z.string().max(160).default("Nothing to show."),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("status"),
      label: z.string().min(1).max(80),
      tonePath: dataPathSchema.optional(),
      messagePath: dataPathSchema.optional(),
      valuePath: dataPathSchema.optional(),
      valueTonePath: dataPathSchema.optional(),
      valueVariant: valueVariantSchema.default("text"),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("sparkline"),
      path: dataPathSchema,
      label: z.string().min(1).max(80).optional(),
      variant: z.enum(["line", "bars"]).default("line"),
      min: z.number().optional(),
      max: z.number().optional(),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("group"),
      title: z.string().min(1).max(80).optional(),
      blocks: z.array(blockSchema).min(1).max(20),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("tabs"),
      defaultTab: slugSchema,
      persist: z.boolean().default(true),
      tabs: z.array(z.object({
        id: slugSchema,
        label: z.string().min(1).max(40),
        blocks: z.array(blockSchema).min(1).max(20),
      }).strict()).min(1).max(8),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("divider"),
    }).strict(),
    baseBlockSchema.extend({
      type: z.literal("action-row"),
      actions: z.array(z.object({
        id: slugSchema,
        label: z.string().min(1).max(48),
        icon: iconNameSchema.optional(),
        display: z.enum(["text", "icon"]).default("text"),
        capability: z.enum(["readOnly", "mutating", "destructive"]).default("readOnly"),
        disabled: z.boolean().default(false),
      }).strict()).min(1).max(4),
    }).strict(),
  ])
);

function walkBlocks(blocks: unknown[], visit: (block: Record<string, unknown>, parents: string[]) => void, parents: string[] = []) {
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const typed = block as Record<string, unknown>;
    visit(typed, parents);
    if (typed.type === "group" && Array.isArray(typed.blocks)) {
      walkBlocks(typed.blocks, visit, [...parents, "group"]);
    }
    if (typed.type === "tabs" && Array.isArray(typed.tabs)) {
      for (const tab of typed.tabs) {
        if (tab && typeof tab === "object" && Array.isArray((tab as { blocks?: unknown }).blocks)) {
          walkBlocks((tab as { blocks: unknown[] }).blocks, visit, [...parents, "tabs"]);
        }
      }
    }
  }
}

export const cardDefinitionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  type: slugSchema,
  title: z.string().min(1).max(96).optional(),
  connectors: z.array(slugSchema).max(12).default([]),
  keywords: z.array(z.string().trim().min(1).max(48)).max(24).default([]),
  options: z.object({
    defaults: z.record(z.string(), z.unknown()).default({}),
  }).strict().default({ defaults: {} }),
  freshness: z.object({
    connector: slugSchema.optional(),
    label: z.string().max(40).optional(),
    staleAfterSeconds: z.number().int().min(1).optional(),
    timestampPath: dataPathSchema.optional(),
  }).strict().optional(),
  visual: z.object({
    icon: iconNameSchema.optional(),
    accent: accentSchema.optional(),
  }).strict().default({}),
  errorHint: z.string().max(240).optional(),
  blocks: z.array(blockSchema).min(1).max(40),
  extensions: extensionMetadataSchema,
}).strict().superRefine((card, ctx) => {
  walkBlocks(card.blocks, (block, parents) => {
    if (block.type !== "tabs") return;
    if (parents.includes("tabs")) {
      ctx.addIssue({
        code: "custom",
        message: "nested tabs are not supported in v0",
        path: ["blocks"],
      });
    }

    const tabs = Array.isArray(block.tabs) ? block.tabs : [];
    const ids = new Set<string>();
    for (const [index, tab] of tabs.entries()) {
      if (!tab || typeof tab !== "object") continue;
      const id = (tab as { id?: unknown }).id;
      if (typeof id !== "string") continue;
      if (ids.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate tab id "${id}"`,
          path: ["blocks", "tabs", index, "id"],
        });
      }
      ids.add(id);
    }
    if (typeof block.defaultTab === "string" && !ids.has(block.defaultTab)) {
      ctx.addIssue({
        code: "custom",
        message: `defaultTab "${block.defaultTab}" does not match a tab id`,
        path: ["blocks", "defaultTab"],
      });
    }
  });
});

export type CardDefinition = z.infer<typeof cardDefinitionSchema>;

const secretRefSchema = z.string().regex(/^(env:[A-Z_][A-Z0-9_]*|file:\/.+)$/);

export const connectorManifestSchema = z.discriminatedUnion("kind", [
  z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: slugSchema,
    kind: z.literal("static"),
    ttlSeconds: z.number().int().min(0).max(86400).default(0),
    persist: z.boolean().default(false),
    data: z.unknown(),
  }).strict(),
  z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: slugSchema,
    kind: z.literal("file"),
    ttlSeconds: z.number().int().min(1).max(86400).default(60),
    persist: z.boolean().default(true),
    path: z.string().min(1),
    maxBytes: z.number().int().min(1_024).max(10_000_000).default(1_000_000),
    allowSymlinks: z.boolean().default(false),
  }).strict(),
  z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: slugSchema,
    kind: z.literal("http"),
    ttlSeconds: z.number().int().min(1).max(86400).default(60),
    persist: z.boolean().default(true),
    url: z.string().url(),
    method: z.literal("GET").default("GET"),
    timeoutMs: z.number().int().min(500).max(60_000).default(8_000),
    maxBytes: z.number().int().min(1_024).max(10_000_000).default(1_000_000),
    headers: z.record(z.string(), z.string()).default({}),
    auth: z.object({
      type: z.enum(["none", "bearer", "header", "local-only"]).default("none"),
      token: secretRefSchema.optional(),
      header: z.string().min(1).max(80).optional(),
      value: secretRefSchema.optional(),
    }).strict().default({ type: "none" }),
  }).strict(),
  z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: slugSchema,
    kind: z.literal("command"),
    ttlSeconds: z.number().int().min(1).max(86400).default(60),
    persist: z.boolean().default(true),
    command: z.string().min(1),
    args: z.array(z.string()).max(24).default([]),
    cwd: z.string().min(1).optional(),
    envAllowlist: z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/)).max(24).default([]),
    timeoutMs: z.number().int().min(500).max(60_000).default(8_000),
    maxStdoutBytes: z.number().int().min(1_024).max(10_000_000).default(1_000_000),
  }).strict(),
  z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: slugSchema,
    kind: z.literal("ts"),
    ttlSeconds: z.number().int().min(1).max(86400).default(60),
    persist: z.boolean().default(true),
    entry: z.string().min(1),
    timeoutMs: z.number().int().min(500).max(60_000).default(8_000),
    trusted: z.literal(true),
  }).strict(),
]);

export type ConnectorManifest = z.infer<typeof connectorManifestSchema>;

export type SourceStatus = "fresh" | "stale" | "error";

export interface SourceFreshness {
  status: SourceStatus;
  fetchedAt: string | null;
  ttlMs: number;
  error: string | null;
  refreshing: boolean;
}

export interface ResolvedCard {
  instance: CardInstance;
  definition: CardDefinition | null;
  data: Record<string, unknown>;
  freshness: Record<string, SourceFreshness>;
  error: string | null;
}

export interface ResolvedHeaderWidget {
  definition: HeaderWidgetDefinition;
  value: unknown;
  label: string | null;
  tooltip: string | null;
  tone: string | null;
  href: string | null;
  freshness: SourceFreshness | null;
  error: string | null;
}

export interface DashboardResponse {
  schemaVersion: 1;
  generatedAt: string;
  configError: string | null;
  config: DashboardConfig;
  capabilities: {
    canMutateConfig: boolean;
    /** @deprecated Use canMutateConfig. Kept for older cached clients. */
    canReorderCards?: boolean;
  };
  header: {
    widgets: ResolvedHeaderWidget[];
  };
  cards: ResolvedCard[];
  sources: Record<string, SourceFreshness>;
}

export function prettyZodError(error: unknown): string {
  if (error instanceof z.ZodError) return z.prettifyError(error);
  return error instanceof Error ? error.message : String(error);
}
