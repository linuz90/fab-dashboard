import { cn } from "../lib/cn";
import { asRecord, asString, safeHref } from "../renderer/dataPath";
import { DashboardIcon } from "../renderer/icons";
import type { ResolvedHeaderWidget } from "../shared/schemas";

interface WeatherSnapshot {
  place: string;
  tempC: number;
  code: number;
  isDay: boolean;
  hiC: number | null;
  loC: number | null;
}

export function HeaderWidgets({
  widgets,
  now,
  showSeparator = false,
  className,
}: {
  widgets: ResolvedHeaderWidget[];
  now: number;
  showSeparator?: boolean;
  className?: string;
}) {
  const rendered = widgets.map((widget) => renderWidget(widget, now)).filter(Boolean);
  if (rendered.length === 0) return null;

  return (
    <span className={cn("header-widgets inline-flex min-w-0 items-center gap-2", className)}>
      {showSeparator && <span aria-hidden="true">·</span>}
      {rendered}
    </span>
  );
}

function renderWidget(widget: ResolvedHeaderWidget, now: number) {
  if (widget.definition.kind === "weather") return <WeatherWidget key={widget.definition.id} widget={widget} now={now} />;
  return <LabelWidget key={widget.definition.id} widget={widget} now={now} />;
}

function LabelWidget({ widget, now }: { widget: ResolvedHeaderWidget; now: number }) {
  const definition = widget.definition;
  if (definition.kind !== "label") return null;

  const label = widget.label ?? "";
  const fallbackLabel = definition.label || definition.id;
  if (!label && !widget.error) return null;

  const href = widget.href ? safeHref(widget.href) : null;
  const tone = widgetTone(widget, now);
  const content = (
    <>
      {definition.icon && <DashboardIcon name={definition.icon} className="size-3.5 shrink-0" />}
      <span className="min-w-0 truncate">{label || fallbackLabel}</span>
    </>
  );
  const commonProps = {
    className: cn("header-widget inline-flex min-w-0 max-w-[10rem] items-center gap-1 truncate", toneClass(tone)),
    title: widget.error ?? widget.tooltip ?? undefined,
    "aria-label": widget.error ? `${fallbackLabel}: ${widget.error}` : undefined,
  };

  if (href) {
    return (
      <a key={definition.id} href={href} {...commonProps}>
        {content}
      </a>
    );
  }

  return (
    <span key={definition.id} {...commonProps}>
      {content}
    </span>
  );
}

function WeatherWidget({ widget, now }: { widget: ResolvedHeaderWidget; now: number }) {
  const definition = widget.definition;
  if (definition.kind !== "weather") return null;

  const weather = weatherFrom(widget.value);
  const tone = widgetTone(widget, now);
  if (!weather) {
    if (!widget.error) return null;
    return (
      <span
        key={definition.id}
        className="header-widget inline-flex min-w-0 max-w-[10rem] items-center gap-1 truncate text-danger"
        title={widget.error}
        aria-label={`weather: ${widget.error}`}
      >
        <DashboardIcon name="cloud" className="size-3.5 shrink-0" />
        <span>weather</span>
      </span>
    );
  }

  const { icon, label } = weatherIcon(weather.code, weather.isDay);
  const range = weather.loC !== null && weather.hiC !== null ? ` · ${weather.loC}°-${weather.hiC}°` : "";
  const prefix =
    isVisiblyStale(widget, now) ? "stale · " : widget.freshness?.status === "error" ? "stale, refresh failed · " : "";

  return (
    <span
      key={definition.id}
      className={cn("header-widget inline-flex min-w-0 max-w-[10rem] items-center gap-1 truncate", toneClass(tone))}
      title={`${prefix}${label ? `${label} · ` : ""}${weather.tempC}°C${range} in ${weather.place}`}
    >
      <DashboardIcon name={icon} className="size-3.5 shrink-0" />
      <span>{weather.tempC}°</span>
    </span>
  );
}

function widgetTone(widget: ResolvedHeaderWidget, now: number): string {
  if (widget.freshness?.status === "error") return "danger";
  if (isVisiblyStale(widget, now)) return "warning";
  const definition = widget.definition;
  if (definition.kind !== "label") return "muted";
  return widget.tone ?? "muted";
}

function isVisiblyStale(widget: ResolvedHeaderWidget, now: number): boolean {
  if (widget.freshness?.status !== "stale") return false;
  const staleAfterSeconds = widget.definition.staleAfterSeconds;
  if (!staleAfterSeconds || !widget.freshness.fetchedAt) return true;
  const fetchedAt = Date.parse(widget.freshness.fetchedAt);
  return Number.isFinite(fetchedAt) && now - fetchedAt > staleAfterSeconds * 1000;
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
    case "info":
      return "text-accent";
    case "muted":
    default:
      return "text-header-faint";
  }
}

function weatherIcon(code: number, isDay: boolean): { icon: string; label: string } {
  if (code <= 1) return { icon: isDay ? "sun" : "moon", label: "clear" };
  if (code === 2) return { icon: isDay ? "cloud-sun" : "cloud-moon", label: "partly cloudy" };
  if (code === 3) return { icon: "cloud", label: "overcast" };
  if (code === 45 || code === 48) return { icon: "cloud-fog", label: "foggy" };
  if (code >= 51 && code <= 57) return { icon: "cloud-drizzle", label: "drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: "cloud-rain", label: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: "cloud-snow", label: "snow" };
  if (code >= 95) return { icon: "cloud-lightning", label: "thunderstorm" };
  return { icon: "cloud", label: "" };
}

function weatherFrom(value: unknown): WeatherSnapshot | null {
  const weather = asRecord(value);
  const tempC = numberOrNull(weather.tempC);
  if (tempC === null) return null;
  return {
    place: asString(weather.place) || "weather",
    tempC: Math.round(tempC),
    code: Math.round(numberOrNull(weather.code) ?? -1),
    isDay: weather.isDay !== false && weather.isDay !== 0,
    hiC: roundOrNull(numberOrNull(weather.hiC)),
    loC: roundOrNull(numberOrNull(weather.loC)),
  };
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundOrNull(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}
