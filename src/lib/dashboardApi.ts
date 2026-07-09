import {
  DASHBOARD_CONFIG_MUTATION_HEADER,
  REORDER_CARDS_ACTION,
  UPDATE_APPEARANCE_LAYOUT_ACTION,
} from "../shared/actions";
import type { DashboardLayoutConfig } from "../shared/layout";
import type { DashboardResponse } from "../shared/schemas";
import { DEFAULT_THEME } from "../shared/themes";

export const DASHBOARD_QUERY_KEY = ["dashboard"];
const DEFAULT_REFRESH_SECONDS = 30;

export class DashboardApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DashboardApiError";
  }
}

type LegacyDashboardCapabilities = Partial<DashboardResponse["capabilities"]> & {
  canReorderCards?: boolean;
};

type LegacyDashboardResponse = Omit<DashboardResponse, "config" | "capabilities" | "header" | "sources"> & {
  config: Omit<DashboardResponse["config"], "appearance" | "header" | "refreshSeconds"> & {
    appearance?: DashboardResponse["config"]["appearance"];
    header?: DashboardResponse["config"]["header"];
    refreshSeconds?: number;
  };
  capabilities?: LegacyDashboardCapabilities;
  header?: DashboardResponse["header"];
  sources?: DashboardResponse["sources"];
};

export async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await fetch("/api/dashboard", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`dashboard API ${response.status}`);
  return normalizeDashboardResponse((await response.json()) as LegacyDashboardResponse);
}

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : `dashboard API ${response.status}`;
}

async function postDashboardConfigMutation<T>(path: string, action: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      [DASHBOARD_CONFIG_MUTATION_HEADER]: action,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new DashboardApiError(await responseError(response), response.status);
  return (await response.json()) as T;
}

export function reorderDashboardCardsAction(input: {
  baseOrder: string[];
  order: string[];
}): Promise<{ ok: true; changed: boolean }> {
  return postDashboardConfigMutation("/api/dashboard/cards/reorder", REORDER_CARDS_ACTION, input);
}

export function updateDashboardLayoutAction(input: {
  baseLayout: DashboardLayoutConfig;
  layout: DashboardLayoutConfig;
}): Promise<{ ok: true; changed: boolean }> {
  return postDashboardConfigMutation("/api/dashboard/appearance/layout", UPDATE_APPEARANCE_LAYOUT_ACTION, input);
}

export function normalizeDashboardResponse(resp: LegacyDashboardResponse): DashboardResponse {
  const canMutateConfig = resp.capabilities?.canMutateConfig ?? resp.capabilities?.canReorderCards ?? false;
  return {
    ...resp,
    config: {
      ...resp.config,
      appearance: resp.config.appearance ?? { defaultTheme: DEFAULT_THEME },
      header: resp.config.header ?? { widgets: [] },
      refreshSeconds: resp.config.refreshSeconds ?? DEFAULT_REFRESH_SECONDS,
    },
    capabilities: { canMutateConfig },
    header: resp.header ?? { widgets: [] },
    sources: resp.sources ?? {},
  };
}

export function hasRefreshingSources(resp: DashboardResponse | undefined): boolean {
  return Object.values(resp?.sources ?? {}).some((source) => source.refreshing);
}

export function dashboardRefetchInterval(resp: DashboardResponse | undefined): number {
  if (!resp) return 5_000;
  return hasRefreshingSources(resp) ? 3_000 : (resp.config.refreshSeconds ?? DEFAULT_REFRESH_SECONDS) * 1000;
}
