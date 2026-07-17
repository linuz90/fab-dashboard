import type { ReactNode } from "react";
import { Row, SectionLabel, SourceError } from "../components/CardShell";
import { ProgressBar } from "../components/ProgressBar";
import { Sparkline } from "../components/Sparkline";
import { TabPills, useStoredTab } from "../components/TabPills";
import { cn } from "../lib/cn";
import { isLucideIconName } from "../shared/lucideIcons";
import { asNumberArray, asRecord, asString, resolvePath, safeHref, safeSrc } from "./dataPath";
import { DashboardIcon } from "./icons";

interface VisibilityCondition {
  path: string;
  equals?: unknown;
  exists?: boolean;
}

interface BaseBlock {
  id?: string;
  visibleWhen?: VisibilityCondition;
}

type TextBlockDef = BaseBlock & {
  type: "text";
  text?: string;
  path?: string;
  variant?: "title" | "body" | "muted" | "mono" | "caption";
  empty?: string;
};

type MetricBlockDef = BaseBlock & {
  type: "metric";
  label: string;
  value?: string;
  valuePath?: string;
  unit?: string;
  pill?: string;
  pillPath?: string;
  deltaPath?: string;
  sparklinePath?: string;
  tonePath?: string;
  tone?: "ok" | "info" | "success" | "warning" | "danger" | "muted";
};

type RowsBlockDef = BaseBlock & {
  type: "rows";
  rows: Array<{
    label: string;
    visibleWhen?: VisibilityCondition;
    value?: string;
    valuePath?: string;
    tonePath?: string;
    valueTonePath?: string;
    icon?: string;
    hint?: string;
    hintPath?: string;
    valueVariant?: "text" | "badge";
    progressPath?: string;
    progressMax?: number;
    sparklinePath?: string;
    sparklineVariant?: "line" | "bars";
  }>;
};

type ListBlockDef = BaseBlock & {
  type: "list";
  path: string;
  variant?: "plain" | "check" | "timeline" | "feed" | "media";
  density?: "normal" | "compact";
  limit: number;
  titlePath: string;
  metaPath?: string;
  textPath?: string;
  hrefPath?: string;
  sectionPath?: string;
  icon?: string;
  iconPath?: string;
  fallbackIcon?: string;
  tonePath?: string;
  checkedPath?: string;
  mutedPath?: string;
  imagePath?: string;
  chipsPath?: string;
  countPath?: string;
  countIcon?: string;
  progressPath?: string;
  progressMax?: number;
  empty: string;
};

type AllocationBlockDef = BaseBlock & {
  type: "allocation";
  path: string;
  limit: number;
  keyPath?: string;
  labelPath: string;
  valuePath: string;
  valueLabelPath?: string;
  metaPath?: string;
  tonePath?: string;
  empty: string;
};

type LeaderboardBlockDef = BaseBlock & {
  type: "leaderboard";
  path: string;
  limit: number;
  rankPath?: string;
  titlePath: string;
  subtitlePath?: string;
  valuePath?: string;
  deltaPath?: string;
  colorKeyPath?: string;
  progressPath?: string;
  empty: string;
};

type StatusBlockDef = BaseBlock & {
  type: "status";
  label: string;
  tonePath?: string;
  messagePath?: string;
  valuePath?: string;
  valueTonePath?: string;
  valueVariant?: "text" | "badge";
};

type SparklineBlockDef = BaseBlock & {
  type: "sparkline";
  path: string;
  label?: string;
  variant?: "line" | "bars";
  min?: number;
  max?: number;
};

type GroupBlockDef = BaseBlock & {
  type: "group";
  title?: string;
  blocks: Block[];
};

type TabsBlockDef = BaseBlock & {
  type: "tabs";
  defaultTab: string;
  persist: boolean;
  tabs: Array<{ id: string; label: string; blocks: Block[] }>;
};

type DividerBlockDef = BaseBlock & { type: "divider" };

type ActionRowBlockDef = BaseBlock & {
  type: "action-row";
  actions: Array<{
    id: string;
    label: string;
    icon?: string;
    display?: "text" | "icon";
    capability: "readOnly" | "mutating" | "destructive";
    disabled: boolean;
  }>;
};

type Block =
  | TextBlockDef
  | MetricBlockDef
  | RowsBlockDef
  | AllocationBlockDef
  | LeaderboardBlockDef
  | ListBlockDef
  | StatusBlockDef
  | SparklineBlockDef
  | GroupBlockDef
  | TabsBlockDef
  | DividerBlockDef
  | ActionRowBlockDef;

function conditionMatches(condition: VisibilityCondition | undefined, data: Record<string, unknown>): boolean {
  if (!condition) return true;
  const value = resolvePath(data, condition.path);
  const exists = value !== undefined && value !== null;
  if (typeof condition.exists === "boolean") {
    if (condition.exists !== exists) return false;
    if (!("equals" in condition)) return true;
  }
  if ("equals" in condition) return value === condition.equals;
  return Boolean(value);
}

function visible(block: Block, data: Record<string, unknown>): boolean {
  return conditionMatches(block.visibleWhen, data);
}

function valueFrom(data: Record<string, unknown>, block: { value?: string; valuePath?: string }): string {
  if (block.value !== undefined) return block.value;
  if (!block.valuePath) return "";
  return asString(resolvePath(data, block.valuePath));
}

function toneClass(tone: unknown): string {
  switch (tone) {
    case "success":
    case "ok":
      return "text-success";
    case "warning":
      return "text-warning";
    case "danger":
    case "error":
      return "text-danger";
    case "muted":
      return "text-muted";
    default:
      return "text-accent";
  }
}

function toneSoftClass(tone: unknown): string {
  switch (tone) {
    case "success":
    case "ok":
      return "bg-success-soft text-success";
    case "warning":
      return "bg-warning-soft text-warning";
    case "danger":
    case "error":
      return "bg-danger-soft text-danger";
    case "muted":
      return "bg-fg/[0.04] text-faint";
    default:
      return "bg-accent/10 text-accent";
  }
}

function toneDotClass(tone: unknown): string {
  switch (tone) {
    case "success":
    case "ok":
      return "bg-success/70";
    case "warning":
      return "bg-warning/80";
    case "danger":
    case "error":
      return "bg-danger/80";
    case "muted":
      return "bg-faint/50";
    default:
      return "bg-accent/70";
  }
}

function ValueText({ value, tone, variant = "text" }: { value: string; tone: unknown; variant?: "text" | "badge" }) {
  if (variant === "badge") {
    return <span className={cn("min-w-0 truncate rounded-full px-1.5 py-px type-ui-2xs font-medium", toneSoftClass(tone))}>{value}</span>;
  }
  return <span className={cn("min-w-0 truncate", toneClass(tone))}>{value}</span>;
}

function numericPathValue(data: Record<string, unknown>, path?: string): number | null {
  if (!path) return null;
  const value = resolvePath(data, path);
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function chipsFrom(value: unknown): Array<{ label: string; tone?: unknown }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" || typeof item === "number") return [{ label: String(item) }];
    const record = asRecord(item);
    const label = asString(record.label);
    return label ? [{ label, tone: record.tone }] : [];
  });
}

function isExternalHref(href: string): boolean {
  try {
    const parsed = new URL(href, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin !== window.location.origin : false;
  } catch {
    return false;
  }
}

function iconNameOrNull(value: unknown): string | null {
  return isLucideIconName(value) ? value : null;
}

function groupedItems<T>(items: T[], sectionFor: (item: T) => string): Array<{ section: string; items: T[] }> {
  const groups: Array<{ section: string; items: T[] }> = [];
  const bySection = new Map<string, { section: string; items: T[] }>();
  for (const item of items) {
    const section = sectionFor(item);
    let group = bySection.get(section);
    if (!group) {
      group = { section, items: [] };
      bySection.set(section, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

const paletteClasses = ["bg-cal-1", "bg-cal-2", "bg-cal-3", "bg-cal-4", "bg-cal-5", "bg-cal-6"] as const;
const allocationPaletteClasses = ["bg-cal-1", "bg-cal-4", "bg-cal-2", "bg-cal-5", "bg-cal-3", "bg-cal-6"] as const;

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function paletteClass(key: string, fallbackIndex: number): string {
  let hash = 0;
  const seed = key || String(fallbackIndex);
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return paletteClasses[hash % paletteClasses.length];
}

function allocationPaletteClass(index: number): string {
  // Adjacent allocation slices need visual separation even when e-ink collapses
  // the palette to a gray ramp, so this alternates dark and light tokens.
  return allocationPaletteClasses[index % allocationPaletteClasses.length];
}

function TextBlock({ block, data }: { block: Extract<Block, { type: "text" }>; data: Record<string, unknown> }) {
  const variant = block.variant ?? "body";
  const text = (block.text ?? (block.path ? asString(resolvePath(data, block.path)) : "")) || block.empty || "";
  const className = cn(
    variant === "title" && "type-ui-md font-medium text-fg",
    variant === "body" && "type-ui-sm leading-relaxed text-muted",
    variant === "muted" && "type-ui-xs leading-relaxed text-faint",
    variant === "mono" && "font-mono type-ui-sm text-muted",
    variant === "caption" && "font-mono type-ui-2xs uppercase tracking-ui-caps text-faint"
  );
  return <p className={className}>{text}</p>;
}

function MetricBlock({ block, data }: { block: Extract<Block, { type: "metric" }>; data: Record<string, unknown> }) {
  const value = valueFrom(data, block);
  const delta = block.deltaPath ? asString(resolvePath(data, block.deltaPath)) : "";
  const pill = (block.pill ?? (block.pillPath ? asString(resolvePath(data, block.pillPath)) : "")).trim();
  const sparkline = block.sparklinePath ? asNumberArray(resolvePath(data, block.sparklinePath)) : [];
  const tone = block.tonePath ? resolvePath(data, block.tonePath) : block.tone;
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="type-ui-2xs font-medium uppercase tracking-ui-caps text-faint">{block.label}</p>
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-display text-[2rem] leading-none tracking-normal tabular-nums text-fg">
              {value}
              {block.unit && <span className="ml-1 font-mono text-base text-muted">{block.unit}</span>}
            </p>
            {pill && <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-mono type-ui-xs", toneSoftClass(tone))}>{pill}</span>}
          </div>
        </div>
        {delta && <span className={cn("shrink-0 font-mono type-ui-xs", toneClass(tone))}>{delta}</span>}
      </div>
      {sparkline.length > 1 && <Sparkline values={sparkline} className={cn("h-10 w-full", toneClass(tone))} />}
    </div>
  );
}

function RowsBlock({ block, data }: { block: Extract<Block, { type: "rows" }>; data: Record<string, unknown> }) {
  const rows = block.rows.filter((row) => conditionMatches(row.visibleWhen, data));
  if (rows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {rows.map((row) => {
        const tone = row.valueTonePath ? resolvePath(data, row.valueTonePath) : row.tonePath ? resolvePath(data, row.tonePath) : null;
        const progress = numericPathValue(data, row.progressPath);
        const progressPct = progress === null ? null : (progress / (row.progressMax ?? 100)) * 100;
        const sparkline = row.sparklinePath ? asNumberArray(resolvePath(data, row.sparklinePath)) : [];
        const value = row.value ?? (row.valuePath ? asString(resolvePath(data, row.valuePath)) : "");
        const hint = row.hint ?? (row.hintPath ? asString(resolvePath(data, row.hintPath)) : "");
        const valueNode = (
          <span className="flex min-w-0 max-w-full items-center justify-end gap-2">
            {sparkline.length > 1 && (
              <span className={cn("w-10 shrink-0 sm:w-14", toneClass(tone))}>
                <Sparkline values={sparkline} variant={row.sparklineVariant ?? "line"} className="h-3 w-full" />
              </span>
            )}
            {progressPct !== null && (
              <span className="w-10 shrink-0 sm:w-16">
                <ProgressBar pct={progressPct} fillClass={progressPct > 85 ? "bg-warning/90" : "bg-accent/80"} />
              </span>
            )}
            {value && <ValueText value={value} tone={tone} variant={row.valueVariant} />}
            {hint && <span className="min-w-0 truncate font-mono type-ui-2xs text-faint">{hint}</span>}
          </span>
        );
        return <Row key={row.label} icon={row.icon ? <DashboardIcon name={row.icon} /> : undefined} label={row.label} value={valueNode} />;
      })}
    </div>
  );
}

function AllocationBlock({ block, data }: { block: Extract<Block, { type: "allocation" }>; data: Record<string, unknown> }) {
  const items = resolvePath(data, block.path);
  if (!Array.isArray(items) || items.length === 0) return <p className="type-ui-sm text-faint">{block.empty}</p>;
  const records = items.slice(0, block.limit).map(asRecord);
  const slices = records.map((record, index) => {
    const label = asString(resolvePath(record, block.labelPath));
    const value = numericValue(resolvePath(record, block.valuePath)) ?? 0;
    const key = block.keyPath ? asString(resolvePath(record, block.keyPath)) : label;
    return {
      key: key || `${label}-${index}`,
      label,
      value,
      valueLabel: block.valueLabelPath ? asString(resolvePath(record, block.valueLabelPath)) : value ? `${value.toFixed(1)}%` : "0.0%",
      meta: block.metaPath ? asString(resolvePath(record, block.metaPath)) : "",
      tone: block.tonePath ? resolvePath(record, block.tonePath) : null,
      className: allocationPaletteClass(index),
    };
  });
  const total = slices.reduce((sum, item) => sum + Math.max(0, item.value), 0);

  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-border/60">
        {slices.map((item, index) => (
          <span
            key={item.key}
            className={cn("h-full", item.className, index > 0 && "border-l border-card")}
            style={{ width: `${total > 0 ? clampPercent((item.value / total) * 100) : 0}%` }}
            title={`${item.label} ${item.valueLabel}`}
          />
        ))}
      </div>
      <div className="space-y-1">
        {slices.map((item) => (
          <div key={item.key} className="flex min-w-0 items-center gap-2 py-px">
            <span className={cn("size-1.5 shrink-0 rounded-full", item.className)} />
            <span className="min-w-0 truncate type-ui-sm text-muted">{item.label}</span>
            <span className="ml-auto flex shrink-0 items-baseline gap-2">
              {item.meta && <span className={cn("font-mono type-ui-xs", toneClass(item.tone))}>{item.meta}</span>}
              <span className="min-w-12 text-right font-mono type-ui-md text-fg">{item.valueLabel}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardBlock({ block, data }: { block: Extract<Block, { type: "leaderboard" }>; data: Record<string, unknown> }) {
  const items = resolvePath(data, block.path);
  if (!Array.isArray(items) || items.length === 0) return <p className="type-ui-sm text-faint">{block.empty}</p>;
  const records = items.slice(0, block.limit).map(asRecord);

  return (
    <ul className="space-y-1.5">
      {records.map((record, index) => {
        const title = asString(resolvePath(record, block.titlePath));
        const subtitle = block.subtitlePath ? asString(resolvePath(record, block.subtitlePath)) : "";
        const value = block.valuePath ? asString(resolvePath(record, block.valuePath)) : "";
        const delta = block.deltaPath ? asString(resolvePath(record, block.deltaPath)) : "";
        const colorKey = block.colorKeyPath ? asString(resolvePath(record, block.colorKeyPath)) : title;
        const progress = numericValue(block.progressPath ? resolvePath(record, block.progressPath) : null);
        const rank = block.rankPath ? asString(resolvePath(record, block.rankPath)) : String(index + 1);
        return (
          <li key={`${title}-${index}`} className="flex min-w-0 items-baseline gap-1.5">
            <span className="w-[2ch] shrink-0 text-left font-mono type-ui-xs text-faint">{rank}</span>
            <span className={cn("h-3 w-0.5 shrink-0 self-center rounded-full", paletteClass(colorKey, index))} />
            <span className="min-w-0 truncate type-ui-md text-fg">{title}</span>
            {subtitle && <span className="min-w-0 truncate type-ui-xs text-faint">{subtitle}</span>}
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {progress !== null && (
                <span className="hidden w-12 sm:block">
                  <ProgressBar pct={progress} />
                </span>
              )}
              {value && <span className="whitespace-nowrap font-mono type-ui-md text-fg">{value}</span>}
              {delta && <span className="min-w-[4.25rem] whitespace-nowrap text-right font-mono type-ui-xs text-faint">{delta}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ListBlock({ block, data }: { block: Extract<Block, { type: "list" }>; data: Record<string, unknown> }) {
  const items = resolvePath(data, block.path);
  if (!Array.isArray(items) || items.length === 0) return <p className="type-ui-sm text-faint">{block.empty}</p>;
  const records = items.slice(0, block.limit).map(asRecord);
  const groups = block.sectionPath
    ? groupedItems(records, (record) => asString(resolvePath(record, block.sectionPath ?? "")) || "")
    : [{ section: "", items: records }];
  const variant = block.variant ?? "plain";
  const density = block.density ?? "normal";
  const compact = density === "compact";
  const feedVariant = variant === "feed";
  const compactFeed = compact && feedVariant;

  function renderItem(record: Record<string, unknown>, index: number): ReactNode {
    const title = asString(resolvePath(record, block.titlePath));
    const meta = block.metaPath ? asString(resolvePath(record, block.metaPath)) : "";
    const text = block.textPath ? asString(resolvePath(record, block.textPath)) : "";
    const href = block.hrefPath ? safeHref(asString(resolvePath(record, block.hrefPath)), window.location.origin) : null;
    const tone = block.tonePath ? resolvePath(record, block.tonePath) : null;
    const iconName = (block.iconPath ? iconNameOrNull(asString(resolvePath(record, block.iconPath))) : null) ?? block.icon ?? null;
    const count = block.countPath ? asString(resolvePath(record, block.countPath)) : "";
    const chips = block.chipsPath ? chipsFrom(resolvePath(record, block.chipsPath)) : [];
    const progress = numericPathValue(record, block.progressPath);
    const progressPct = progress === null ? null : (progress / (block.progressMax ?? 100)) * 100;
    const checked = block.checkedPath ? Boolean(resolvePath(record, block.checkedPath)) : false;
    const muted = block.mutedPath ? Boolean(resolvePath(record, block.mutedPath)) : false;
    const image = block.imagePath ? safeSrc(asString(resolvePath(record, block.imagePath)), window.location.origin) : null;

    const content = (() => {
      if (variant === "check") {
        return (
          <span className={cn("group flex min-w-0 items-start gap-2.5", (checked || muted) && "opacity-55")}>
            <span className={cn("mt-1 flex size-3.5 shrink-0 items-center justify-center rounded-full border border-border", checked && "border-success/40 bg-success-soft text-success")}>
              {checked && <DashboardIcon name="check" className="size-2.5" />}
            </span>
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className={cn("line-clamp-2 type-ui-sm leading-relaxed text-fg", href && "group-hover:underline", checked && "line-through")}>{title}</span>
              {text && <span className="line-clamp-2 type-ui-xs leading-relaxed text-muted">{text}</span>}
            </span>
            {meta && <span className="shrink-0 font-mono type-ui-xs text-faint">{meta}</span>}
          </span>
        );
      }

      if (variant === "timeline") {
        return (
          <span className="group flex min-w-0 items-start gap-2.5">
            <span className="mt-1.5 flex size-3 shrink-0 items-center justify-center">
              {iconName ? <DashboardIcon name={iconName} className={cn("size-3.5", toneClass(tone))} /> : <span className={cn("size-1.5 rounded-full", toneDotClass(tone))} />}
            </span>
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className={cn("min-w-0 truncate type-ui-sm text-fg", href && "group-hover:underline")}>{title}</span>
              {text && <span className="line-clamp-2 type-ui-xs leading-relaxed text-muted">{text}</span>}
            </span>
            {meta && <span className="ml-auto shrink-0 font-mono type-ui-xs text-muted">{meta}</span>}
          </span>
        );
      }

      if (variant === "feed") {
        const countNode = count ? (
          <span className="inline-flex items-center gap-0.5 text-muted [&>svg]:size-3">
            <DashboardIcon name={block.countIcon ?? "heart"} />
            {count}
          </span>
        ) : null;
        return (
          <span className={cn("group flex min-w-0 items-start", compact ? "gap-2" : "gap-2.5")}>
            <span className={cn("mt-0.5 flex shrink-0 items-center justify-center rounded-full", compact ? "size-[1.125rem]" : "size-5", toneSoftClass(tone))}>
              <DashboardIcon name={iconName || block.fallbackIcon || "message-square"} className={compact ? "size-3" : "size-3.5"} />
            </span>
            <span className="flex min-w-0 grow flex-col gap-1">
              <span className="flex min-w-0 items-start gap-2">
                <span className="flex min-w-0 grow flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className={cn("line-clamp-2 min-w-0 type-ui-sm font-medium leading-snug text-fg", href && "group-hover:underline")}>{title}</span>
                  {chips.map((chip) => (
                    <span key={chip.label} className={cn("shrink-0 rounded-full px-1.5 py-px type-ui-2xs font-medium", toneSoftClass(chip.tone))}>{chip.label}</span>
                  ))}
                </span>
                {(meta || countNode) && (
                  <span className="flex shrink-0 items-center gap-1.5 font-mono type-ui-xs text-faint">
                    {meta && <span>{meta}</span>}
                    {countNode}
                  </span>
                )}
              </span>
              {text && <span className="line-clamp-2 type-ui-xs leading-snug text-muted">{text}</span>}
              {progressPct !== null && <ProgressBar pct={progressPct} />}
            </span>
          </span>
        );
      }

      if (variant === "media") {
        return (
          <span className="group flex min-w-0 items-center gap-3">
            <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border-[0.5px] border-border bg-canvas text-faint">
              <DashboardIcon name={block.fallbackIcon ?? iconName ?? "music"} className="size-5" />
              {image && (
                <img
                  key={image}
                  src={image}
                  alt=""
                  className="music-artwork absolute inset-0 size-full object-cover"
                  loading="lazy"
                  onLoad={(event) => {
                    event.currentTarget.style.display = "";
                  }}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}
            </span>
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className={cn("min-w-0 truncate type-ui-md font-medium text-fg", href && "group-hover:underline")}>{title}</span>
              {text && <span className="min-w-0 truncate type-ui-sm text-muted">{text}</span>}
              {meta && <span className="min-w-0 truncate font-mono type-ui-xs text-faint">{meta}</span>}
              {progressPct !== null && <ProgressBar pct={progressPct} />}
            </span>
          </span>
        );
      }

      return (
        <span className="group flex min-w-0 items-start gap-2.5">
          {iconName && <span className="mt-0.5 shrink-0 text-faint [&>svg]:size-3.5"><DashboardIcon name={iconName} /></span>}
          <span className="min-w-0 grow">
            <span className="flex min-w-0 items-baseline justify-between gap-3">
              <span className={cn("truncate type-ui-sm text-fg", href && "group-hover:underline")}>{title}</span>
              {meta && <span className="shrink-0 font-mono type-ui-xs text-faint">{meta}</span>}
            </span>
            {text && <span className="mt-0.5 block line-clamp-2 type-ui-xs leading-relaxed text-muted">{text}</span>}
          </span>
        </span>
      );
    })();

    const external = href ? isExternalHref(href) : false;
    const mutedWrapper = muted && !(variant === "check");
    return href ? (
      <a
        key={`${title}-${index}`}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={cn("block rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent", mutedWrapper && "opacity-55")}
      >
        {content}
      </a>
    ) : (
      <div key={`${title}-${index}`} className={cn(mutedWrapper && "opacity-55")}>{content}</div>
    );
  }

  const itemSpacing = cn(
    "space-y-2",
    (variant === "timeline" || feedVariant || variant === "check") && "space-y-1.5",
    variant === "feed" && !compact && "space-y-2.5",
    compactFeed && "space-y-2",
    compact && !feedVariant && "space-y-1"
  );

  return (
    <div className={cn("space-y-2", compact && !feedVariant && "space-y-1.5")}>
      {groups.map((group, groupIndex) => (
        <div key={group.section || groupIndex} className={cn("flex flex-col gap-2", compact && !feedVariant && "gap-1.5")}>
          {group.section && <SectionLabel>{group.section}</SectionLabel>}
          <div className={itemSpacing}>
            {group.items.map((record, index) => renderItem(record, index))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBlock({ block, data }: { block: Extract<Block, { type: "status" }>; data: Record<string, unknown> }) {
  const tone = block.tonePath ? resolvePath(data, block.tonePath) : "ok";
  const valueTone = block.valueTonePath ? resolvePath(data, block.valueTonePath) : tone;
  const message = block.messagePath ? asString(resolvePath(data, block.messagePath)) : "";
  const value = block.valuePath ? asString(resolvePath(data, block.valuePath)) : "";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 type-ui-xs text-muted">
          <span className={cn("size-1.5 shrink-0 rounded-full", toneDotClass(tone))} />
          <span className="truncate">{block.label}</span>
        </span>
        <span className="flex shrink-0 justify-end font-mono type-ui-xs">
          <ValueText value={value || asString(valueTone)} tone={valueTone} variant={block.valueVariant} />
        </span>
      </div>
      {message && <p className="type-ui-sm leading-snug text-fg">{message}</p>}
    </div>
  );
}

function SparklineBlock({ block, data }: { block: Extract<Block, { type: "sparkline" }>; data: Record<string, unknown> }) {
  const values = asNumberArray(resolvePath(data, block.path));
  return (
    <div className="space-y-2">
      {block.label && <SectionLabel>{block.label}</SectionLabel>}
      <Sparkline values={values} variant={block.variant ?? "line"} min={block.min} max={block.max} className="h-12 w-full text-accent" />
    </div>
  );
}

function ActionRowBlock({ block }: { block: Extract<Block, { type: "action-row" }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {block.actions.map((action) => (
        <button
          key={action.id}
          type="button"
          title={action.display === "icon" ? action.label : undefined}
          aria-label={action.display === "icon" ? action.label : undefined}
          disabled
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-full border border-border font-mono type-ui-xs text-muted transition-colors enabled:cursor-pointer enabled:hover:text-fg disabled:opacity-50",
            action.display === "icon" ? "size-7 p-0" : "px-3 py-1"
          )}
        >
          {action.icon && <DashboardIcon name={action.icon} className="size-3.5" />}
          {action.display !== "icon" && action.label}
        </button>
      ))}
    </div>
  );
}

function TabsBlock({
  block,
  data,
  storageKey,
}: {
  block: Extract<Block, { type: "tabs" }>;
  data: Record<string, unknown>;
  storageKey: string;
}) {
  const ids = block.tabs.map((tab) => tab.id);
  const [active, setActive] = useStoredTab(
    `${storageKey}:${block.id ?? "tabs"}`,
    ids,
    block.defaultTab,
    block.persist,
  );
  const selected = block.tabs.find((tab) => tab.id === active) ?? block.tabs[0];
  return (
    <div className="space-y-3">
      <TabPills tabs={block.tabs.map(({ id, label }) => ({ id, label }))} active={selected.id} onSelect={setActive} />
      <Blocks blocks={selected.blocks} data={data} storageKey={storageKey} />
    </div>
  );
}

function renderBlock(block: Block, data: Record<string, unknown>, storageKey: string): ReactNode {
  if (!visible(block, data)) return null;
  switch (block.type) {
    case "text":
      return <TextBlock block={block} data={data} />;
    case "metric":
      return <MetricBlock block={block} data={data} />;
    case "rows":
      if (!block.rows.some((row) => conditionMatches(row.visibleWhen, data))) return null;
      return <RowsBlock block={block} data={data} />;
    case "allocation":
      return <AllocationBlock block={block} data={data} />;
    case "leaderboard":
      return <LeaderboardBlock block={block} data={data} />;
    case "list":
      return <ListBlock block={block} data={data} />;
    case "status":
      return <StatusBlock block={block} data={data} />;
    case "sparkline":
      return <SparklineBlock block={block} data={data} />;
    case "group":
      return (
        <div className="space-y-2 border-t-[0.5px] border-border pt-3">
          {block.title && <SectionLabel>{block.title}</SectionLabel>}
          <Blocks blocks={block.blocks} data={data} storageKey={storageKey} />
        </div>
      );
    case "tabs":
      return <TabsBlock block={block} data={data} storageKey={storageKey} />;
    case "divider":
      return <div className="border-t-[0.5px] border-border" />;
    case "action-row":
      return <ActionRowBlock block={block} />;
  }
}

export function Blocks({
  blocks,
  data,
  storageKey,
}: {
  blocks: unknown[];
  data: Record<string, unknown>;
  storageKey: string;
}) {
  return (
    <>
      {blocks.map((block, index) => {
        const typed = block as Block;
        const node = renderBlock(typed, data, storageKey);
        return node === null ? null : <div key={typed.id ?? `${typed.type}-${index}`}>{node}</div>;
      })}
    </>
  );
}

export function CardProblem({ message, hint }: { message: string; hint?: string }) {
  return <SourceError message={message} hint={hint ?? null} />;
}

export function ProgressBlock({ value }: { value: number }) {
  return <ProgressBar pct={value} />;
}
