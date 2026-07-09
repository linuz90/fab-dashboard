import { cn } from "../lib/cn";

/** Thin metric bar. Callers pass the fill class so semantic color decisions
 * stay at the callsite: accent for goal progress, warning/danger for pressure
 * metrics (disk, memory), success for a reached goal. */
export function ProgressBar({ pct, fillClass = "bg-accent/80" }: { pct: number; fillClass?: string }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-border/60">
      <div
        className={cn("h-full rounded-full", fillClass)}
        // NaN% is a dropped declaration → auto width → a misleading full bar,
        // so non-finite input renders empty instead.
        style={{ width: `${Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0}%` }}
      />
    </div>
  );
}
