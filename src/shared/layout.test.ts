import { describe, expect, test } from "bun:test";
import {
  calculateColumnCount,
  DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX,
  DEFAULT_DASHBOARD_LAYOUT,
  resolveDashboardLayout,
} from "./layout";

describe("dashboard layout", () => {
  test("resolves omitted layout to the current large three-column default", () => {
    expect(resolveDashboardLayout(undefined)).toEqual({
      width: "large",
      maxColumns: 3,
      maxWidthPx: 1400,
    });
    expect(resolveDashboardLayout({})).toEqual({
      width: DEFAULT_DASHBOARD_LAYOUT.width,
      maxColumns: DEFAULT_DASHBOARD_LAYOUT.maxColumns,
      maxWidthPx: 1400,
    });
  });

  test("resolves width presets and max columns independently", () => {
    expect(resolveDashboardLayout({ width: "small" })).toEqual({
      width: "small",
      maxColumns: 3,
      maxWidthPx: 960,
    });
    expect(resolveDashboardLayout({ maxColumns: 4 })).toEqual({
      width: "large",
      maxColumns: 4,
      maxWidthPx: 1400,
    });
  });

  test("calculates columns from container width with maxColumns as a cap", () => {
    expect(calculateColumnCount(375, 12, DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX, 4)).toBe(1);
    expect(calculateColumnCount(960, 12, DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX, 4)).toBe(2);
    expect(calculateColumnCount(1200, 12, DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX, 4)).toBe(3);
    expect(calculateColumnCount(1680, 12, DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX, 4)).toBe(4);
    expect(calculateColumnCount(1680, 12, DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX, 1)).toBe(1);
  });

  test("keeps invalid numeric inputs bounded", () => {
    expect(calculateColumnCount(Number.NaN, 12, DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX, 4)).toBe(1);
    expect(calculateColumnCount(1680, -10, DASHBOARD_LAYOUT_MIN_COLUMN_WIDTH_PX, 99)).toBe(4);
    expect(calculateColumnCount(1680, 12, 0, 3)).toBe(3);
  });
});
