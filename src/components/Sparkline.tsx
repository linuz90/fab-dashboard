import { useEffect, useMemo, useRef } from "react";
import { cn } from "../lib/cn";
import { useTheme } from "../lib/theme";
import { themeChartStyle, type ThemeChartStyle } from "../shared/themes";

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 32;
const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

type SparklineVariant = "line" | "bars";

interface SparklineModel {
  points: number[];
  lo: number;
  hi: number;
  span: number;
}

function sparklineModel(values: number[], variant: SparklineVariant, min?: number, max?: number): SparklineModel | null {
  const points = values.filter((value) => Number.isFinite(value));
  if (points.length < (variant === "bars" ? 1 : 2)) return null;

  const lo = min ?? (variant === "bars" ? 0 : Math.min(...points));
  const hi = max ?? Math.max(...points);
  return { points, lo, hi, span: hi - lo || 1 };
}

function clampedRatio(value: number, model: SparklineModel): number {
  return (Math.min(Math.max(value, model.lo), model.hi) - model.lo) / model.span;
}

function bayerThreshold(x: number, y: number): number {
  return (BAYER_4X4[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
}

function drawDitherLine(
  context: CanvasRenderingContext2D,
  model: SparklineModel,
  width: number,
  height: number,
  densityScale: number,
): void {
  const { points } = model;
  const yFor = (value: number) => 1 + (height - 2) * (1 - clampedRatio(value, model));
  let previousRidgeY: number | null = null;

  for (let x = 0; x < width; x += 1) {
    const seriesPosition = width <= 1 ? 0 : (x / (width - 1)) * (points.length - 1);
    const left = Math.floor(seriesPosition);
    const right = Math.min(points.length - 1, left + 1);
    const value = points[left] + (points[right] - points[left]) * (seriesPosition - left);
    const top = yFor(value);
    const firstRow = Math.max(0, Math.ceil(top));

    for (let y = firstRow; y < height; y += 1) {
      const depth = (y - top) / Math.max(1, height - 1 - top);
      // Ordered density, rather than translucent color, keeps the result
      // legible on actual limited-palette e-ink displays.
      const density = Math.min(1, (0.04 + 0.82 * Math.pow(1 - depth, 0.9)) * densityScale);
      if (bayerThreshold(x, y) < density) context.fillRect(x, y, 1, 1);
    }

    // Canvas strokes are anti-aliased even on a low-resolution backing store.
    // Painting the ridge column-by-column gives dither charts the same crisp,
    // stair-stepped boundary as their ordered fill.
    const ridgeY = Math.max(0, Math.min(height - 1, Math.round(top)));
    const ridgeStart = previousRidgeY === null ? ridgeY : Math.min(previousRidgeY, ridgeY);
    const ridgeHeight = previousRidgeY === null ? 1 : Math.abs(previousRidgeY - ridgeY) + 1;
    context.fillRect(x, ridgeStart, 1, ridgeHeight);
    previousRidgeY = ridgeY;
  }
}

function drawDitherBars(
  context: CanvasRenderingContext2D,
  model: SparklineModel,
  width: number,
  height: number,
  emphasizeLast: boolean,
  densityScale: number,
): void {
  const { points } = model;
  const preferredGap = points.length > 20 ? 0 : 1;
  const gap = Math.min(preferredGap, Math.max(0, Math.floor(width / Math.max(points.length * 3, 1))));
  const barWidth = (width - gap * (points.length - 1)) / points.length;

  points.forEach((value, index) => {
    const xStart = Math.floor(index * (barWidth + gap));
    const xEnd = Math.max(xStart + 1, Math.ceil(xStart + barWidth));
    const barHeight = Math.max(clampedRatio(value, model) * height, 1);
    const yStart = Math.max(0, Math.floor(height - barHeight));
    context.globalAlpha = emphasizeLast && index < points.length - 1 ? 0.45 : 1;

    for (let x = xStart; x < Math.min(width, xEnd); x += 1) {
      for (let y = yStart; y < height; y += 1) {
        const depth = (y - yStart) / Math.max(1, height - 1 - yStart);
        const density = Math.min(1, (0.18 + 0.75 * Math.pow(1 - depth, 0.75)) * densityScale);
        if (bayerThreshold(x, y) < density) context.fillRect(x, y, 1, 1);
      }
    }
  });
  context.globalAlpha = 1;
}

function DitherSparkline({
  model,
  variant,
  emphasizeLast,
  styleKey,
  className,
}: {
  model: SparklineModel;
  variant: SparklineVariant;
  emphasizeLast: boolean;
  styleKey: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const styles = window.getComputedStyle(canvas);
      // These are theme-owned presentation controls. Keeping them out of card
      // JSON means the same data remains portable across visual treatments.
      const pixelSize = Math.max(0.5, Number.parseFloat(styles.getPropertyValue("--chart-dither-pixel-size")) || 1);
      const densityScale = Math.max(0.1, Number.parseFloat(styles.getPropertyValue("--chart-dither-density")) || 1);
      // clientWidth/clientHeight exclude card-entry transforms. A DOMRect
      // captured mid-scale would leave the backing grid permanently stretched
      // after the animation because ResizeObserver tracks layout, not transforms.
      const width = Math.max(1, Math.round(canvas.clientWidth / pixelSize));
      const height = Math.max(1, Math.round(canvas.clientHeight / pixelSize));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.fillStyle = styles.color;

      if (variant === "bars") drawDitherBars(context, model, width, height, emphasizeLast, densityScale);
      else drawDitherLine(context, model, width, height, densityScale);
    };

    draw();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(draw);
    observer?.observe(canvas);
    const colorScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    colorScheme?.addEventListener("change", draw);
    return () => {
      observer?.disconnect();
      colorScheme?.removeEventListener("change", draw);
    };
  }, [emphasizeLast, model, styleKey, variant]);

  return (
    <span className={cn("block", className)} aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="block size-full"
        data-chart-style="dither"
        aria-hidden="true"
        style={{ imageRendering: "pixelated" }}
      />
    </span>
  );
}

/** Minimal theme-aware sparkline (line area or bars). Color comes from the
 * caller via `className` and both renderers use currentColor. The semantic
 * variant stays card-owned; the visual treatment is selected by the active
 * theme, with an optional override for isolated previews and tests. */
export function Sparkline({
  values,
  variant = "line",
  min,
  max,
  emphasizeLast = false,
  chartStyle: chartStyleOverride,
  className,
}: {
  /** Oldest → newest. Non-finite entries are dropped. */
  values: number[];
  variant?: SparklineVariant;
  /** Scale overrides: pass min 0 / max 100 for percentage series so the shape
   * is honest; omit for data-relative scaling (trend emphasis). Bars always
   * baseline at 0 unless min is given. */
  min?: number;
  max?: number;
  /** Bars only: full opacity on the newest bar, dimmed history behind it. */
  emphasizeLast?: boolean;
  chartStyle?: ThemeChartStyle;
  className?: string;
}) {
  const [theme] = useTheme();
  const chartStyle = chartStyleOverride ?? themeChartStyle(theme);
  const model = useMemo(() => sparklineModel(values, variant, min, max), [max, min, values, variant]);
  if (!model) return null;

  if (chartStyle === "dither") {
    return (
      <DitherSparkline
        model={model}
        variant={variant}
        emphasizeLast={emphasizeLast}
        styleKey={`${theme}:${className ?? ""}`}
        className={className}
      />
    );
  }

  const { points } = model;
  if (variant === "bars") {
    const preferredGap = points.length > 20 ? 0.5 : 1.5;
    const gap = Math.min(preferredGap, VIEWBOX_WIDTH / Math.max(points.length * 2, 1));
    const barWidth = (VIEWBOX_WIDTH - gap * (points.length - 1)) / points.length;
    return (
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        className={className}
        data-chart-style="smooth"
        aria-hidden="true"
      >
        {points.map((value, index) => {
          const height = Math.max(clampedRatio(value, model) * VIEWBOX_HEIGHT, 1);
          return (
            <rect
              key={index}
              x={index * (barWidth + gap)}
              y={VIEWBOX_HEIGHT - height}
              width={barWidth}
              height={height}
              fill="currentColor"
              opacity={emphasizeLast && index < points.length - 1 ? 0.45 : 1}
            />
          );
        })}
      </svg>
    );
  }

  // 2px vertical padding so the stroke never clips at the extremes.
  const y = (value: number) => 2 + (VIEWBOX_HEIGHT - 4) * (1 - clampedRatio(value, model));
  const x = (index: number) => (index / (points.length - 1)) * VIEWBOX_WIDTH;
  const line = points.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(" ");
  const area = `${line} L${VIEWBOX_WIDTH},${VIEWBOX_HEIGHT} L0,${VIEWBOX_HEIGHT} Z`;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
      className={className}
      data-chart-style="smooth"
      aria-hidden="true"
    >
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
