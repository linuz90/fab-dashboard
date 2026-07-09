/** Minimal sparkline (line area or bars). Color comes from the caller via
 * `className` (e.g. text-accent) — the paths just use currentColor, keeping
 * the no-hardcoded-colors rule intact. Renders nothing with too few points,
 * so callers don't need to guard. */
export function Sparkline({
  values,
  variant = "line",
  min,
  max,
  emphasizeLast = false,
  className,
}: {
  /** Oldest → newest. Non-finite entries are dropped. */
  values: number[];
  variant?: "line" | "bars";
  /** Scale overrides: pass min 0 / max 100 for percentage series so the shape
   * is honest; omit for data-relative scaling (trend emphasis). Bars always
   * baseline at 0 unless min is given. */
  min?: number;
  max?: number;
  /** Bars only: full opacity on the newest bar, dimmed history behind it. */
  emphasizeLast?: boolean;
  className?: string;
}) {
  const points = values.filter((v) => Number.isFinite(v));
  if (points.length < (variant === "bars" ? 1 : 2)) return null;

  const lo = min ?? (variant === "bars" ? 0 : Math.min(...points));
  const hi = max ?? Math.max(...points);
  // Flat series (or near-flat) still renders as a readable mid-height line.
  const span = hi - lo || 1;
  const W = 100;
  const H = 32;

  if (variant === "bars") {
    const gap = points.length > 20 ? 0.5 : 1.5;
    const barW = (W - gap * (points.length - 1)) / points.length;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden="true">
        {points.map((v, i) => {
          const clamped = Math.min(Math.max(v, lo), hi);
          // 1-unit floor so zero days stay visible as ticks, not gaps.
          const h = Math.max(((clamped - lo) / span) * H, 1);
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={H - h}
              width={barW}
              height={h}
              fill="currentColor"
              opacity={emphasizeLast && i < points.length - 1 ? 0.45 : 1}
            />
          );
        })}
      </svg>
    );
  }

  // 2px vertical padding so the stroke never clips at the extremes.
  const y = (v: number) => 2 + (H - 4) * (1 - (Math.min(Math.max(v, lo), hi) - lo) / span);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d={area} fill="currentColor" opacity="0.08" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        // Keep the stroke 1.5px on screen despite preserveAspectRatio="none"
        // stretching the viewBox non-uniformly.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
