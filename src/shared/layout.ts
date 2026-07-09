export const DASHBOARD_LAYOUT_WIDTHS = ["small", "medium", "large", "extra-large"] as const;
export type DashboardLayoutWidth = (typeof DASHBOARD_LAYOUT_WIDTHS)[number];

export const DASHBOARD_LAYOUT_WIDTH_PRESETS: Record<DashboardLayoutWidth, { label: string; maxWidthPx: number }> = {
  small: { label: "Small", maxWidthPx: 960 },
  medium: { label: "Medium", maxWidthPx: 1200 },
  large: { label: "Large", maxWidthPx: 1400 },
  "extra-large": { label: "XL", maxWidthPx: 1680 },
};

export const DASHBOARD_LAYOUT_MIN_COLUMNS = 1;
export const DASHBOARD_LAYOUT_MAX_COLUMNS = 4;
export const DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX = 360;

export interface DashboardLayoutConfig {
  width?: DashboardLayoutWidth;
  maxColumns?: number;
}

export interface ResolvedDashboardLayout {
  width: DashboardLayoutWidth;
  maxColumns: number;
  maxWidthPx: number;
}

export const DEFAULT_DASHBOARD_LAYOUT = {
  width: "large",
  maxColumns: 3,
} as const satisfies Required<DashboardLayoutConfig>;

function isDashboardLayoutWidth(value: unknown): value is DashboardLayoutWidth {
  return typeof value === "string" && DASHBOARD_LAYOUT_WIDTHS.includes(value as DashboardLayoutWidth);
}

function isDashboardMaxColumns(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= DASHBOARD_LAYOUT_MIN_COLUMNS &&
    value <= DASHBOARD_LAYOUT_MAX_COLUMNS
  );
}

export function resolveDashboardLayout(layout: DashboardLayoutConfig | null | undefined): ResolvedDashboardLayout {
  const width = isDashboardLayoutWidth(layout?.width) ? layout.width : DEFAULT_DASHBOARD_LAYOUT.width;
  const maxColumns = isDashboardMaxColumns(layout?.maxColumns) ? layout.maxColumns : DEFAULT_DASHBOARD_LAYOUT.maxColumns;
  return {
    width,
    maxColumns,
    maxWidthPx: DASHBOARD_LAYOUT_WIDTH_PRESETS[width].maxWidthPx,
  };
}

export function calculateColumnCount(
  containerWidth: number,
  gapPx: number,
  minColumnWidthPx: number,
  maxColumns: number,
): number {
  const safeContainerWidth = Number.isFinite(containerWidth) ? Math.max(0, containerWidth) : 0;
  const safeGapPx = Number.isFinite(gapPx) ? Math.max(0, gapPx) : 0;
  const safeMinColumnWidthPx = Number.isFinite(minColumnWidthPx) ? Math.max(1, minColumnWidthPx) : DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX;
  const safeMaxColumns = Number.isInteger(maxColumns)
    ? Math.min(DASHBOARD_LAYOUT_MAX_COLUMNS, Math.max(DASHBOARD_LAYOUT_MIN_COLUMNS, maxColumns))
    : DEFAULT_DASHBOARD_LAYOUT.maxColumns;

  for (let columns = safeMaxColumns; columns > 1; columns -= 1) {
    const requiredWidth = columns * safeMinColumnWidthPx + (columns - 1) * safeGapPx;
    if (safeContainerWidth >= requiredWidth) return columns;
  }

  return 1;
}
