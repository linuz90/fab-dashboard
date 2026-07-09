import { dashboardConfigSchema, prettyZodError, SCHEMA_VERSION, type DashboardConfig } from "../shared/schemas";
import { DEFAULT_THEME } from "../shared/themes";
import type { DashboardPaths } from "./paths";
import { pathExists, readJsonFile } from "./storage";

export function emptyDashboardConfig(): DashboardConfig {
  return {
    schemaVersion: SCHEMA_VERSION,
    title: "fab-dashboard",
    refreshSeconds: 30,
    header: { widgets: [] },
    appearance: { defaultTheme: DEFAULT_THEME },
    cards: [],
  };
}

export async function loadDashboardConfig(paths: DashboardPaths): Promise<{
  config: DashboardConfig | null;
  error: string | null;
  exists: boolean;
}> {
  if (!(await pathExists(paths.dashboardJson))) {
    return { config: emptyDashboardConfig(), error: null, exists: false };
  }
  try {
    return {
      config: dashboardConfigSchema.parse(await readJsonFile(paths.dashboardJson)),
      error: null,
      exists: true,
    };
  } catch (error) {
    return {
      config: null,
      error: prettyZodError(error),
      exists: true,
    };
  }
}
