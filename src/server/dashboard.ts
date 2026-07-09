import type { Catalog } from "./catalog";
import { loadCatalog } from "./catalog";
import { emptyDashboardConfig, loadDashboardConfig } from "./config";
import type { DashboardPaths } from "./paths";
import { ConnectorRuntime } from "./runtime";
import type { DashboardConfig, DashboardResponse, HeaderWidgetDefinition, ResolvedCard, ResolvedHeaderWidget, SourceFreshness } from "../shared/schemas";

interface DashboardState {
  lastGoodConfig: DashboardConfig | null;
}

const state: DashboardState = {
  lastGoodConfig: null,
};

export interface DashboardUsageSummary {
  dashboardCards: number;
  dashboardConnectors: number;
  connectorIds: string[];
}

export async function validateAll(paths: DashboardPaths): Promise<{ ok: boolean; errors: string[]; config: DashboardConfig | null; dashboardExists: boolean; catalog: Catalog }> {
  const [loaded, catalog] = await Promise.all([loadDashboardConfig(paths), loadCatalog(paths)]);
  const errors = [...catalog.errors];
  if (loaded.error) errors.push(`${paths.dashboardJson}: ${loaded.error}`);
  const config = loaded.config;
  if (config) {
    for (const widget of config.header.widgets) {
      if (!catalog.connectors.has(widget.connector)) errors.push(`header widget "${widget.id}" references missing connector "${widget.connector}"`);
    }

    for (const card of config.cards) {
      const definition = catalog.cards.get(card.type);
      if (!definition) {
        errors.push(`dashboard card "${card.id}" uses unknown type "${card.type}"`);
        continue;
      }
      for (const connector of definition.connectors) {
        if (!catalog.connectors.has(connector)) errors.push(`card type "${card.type}" references missing connector "${connector}"`);
      }
    }
  }
  return { ok: errors.length === 0, errors, config, dashboardExists: loaded.exists, catalog };
}

export function summarizeDashboardUsage(config: DashboardConfig | null, catalog: Catalog): DashboardUsageSummary {
  const connectorIds = new Set<string>();
  if (!config) {
    return { dashboardCards: 0, dashboardConnectors: 0, connectorIds: [] };
  }

  for (const widget of config.header.widgets) connectorIds.add(widget.connector);
  for (const card of config.cards) {
    const definition = catalog.cards.get(card.type);
    if (!definition) continue;
    for (const connectorId of definition.connectors) connectorIds.add(connectorId);
  }

  return {
    dashboardCards: config.cards.length,
    dashboardConnectors: connectorIds.size,
    connectorIds: [...connectorIds].sort(),
  };
}

export async function buildDashboardResponse(
  paths: DashboardPaths,
  runtime: ConnectorRuntime,
  options: { canMutateConfig?: boolean } = {},
): Promise<DashboardResponse> {
  const generatedAt = new Date().toISOString();
  const [loaded, catalog] = await Promise.all([loadDashboardConfig(paths), loadCatalog(paths)]);
  let config = loaded.config;
  let configError = loaded.error;

  if (config) {
    state.lastGoodConfig = config;
  } else if (state.lastGoodConfig) {
    config = state.lastGoodConfig;
  } else {
    config = emptyDashboardConfig();
  }

  if (catalog.errors.length > 0) {
    configError = [configError, ...catalog.errors].filter(Boolean).join("\n");
  }

  const sources: Record<string, SourceFreshness> = {};
  const headerWidgets = await resolveHeaderWidgets(config.header.widgets, runtime, catalog.connectors, sources);
  const cards: ResolvedCard[] = [];

  for (const instance of config.cards) {
    const definition = catalog.cards.get(instance.type) ?? null;
    if (!definition) {
      cards.push({
        instance,
        definition,
        data: {},
        freshness: {},
        error: `unknown card type "${instance.type}"`,
      });
      continue;
    }

    const cardData: Record<string, unknown> = {};
    const freshness: Record<string, SourceFreshness> = {};
    const connectorErrors: string[] = [];
    await Promise.all(definition.connectors.map(async (connectorId) => {
      const snapshot = await runtime.get(connectorId, catalog.connectors);
      cardData[connectorId] = snapshot.data;
      freshness[connectorId] = snapshot.freshness;
      sources[connectorId] = snapshot.freshness;
      if (snapshot.freshness.status === "error" && snapshot.freshness.error) {
        connectorErrors.push(`${connectorId}: ${snapshot.freshness.error}`);
      }
    }));

    cards.push({
      instance: {
        ...instance,
        options: { ...definition.options.defaults, ...instance.options },
      },
      definition,
      data: cardData,
      freshness,
      error: connectorErrors.length > 0 ? connectorErrors.join("\n") : null,
    });
  }

  return {
    schemaVersion: 1,
    generatedAt,
    configError,
    config,
    capabilities: {
      canMutateConfig: options.canMutateConfig ?? false,
      canReorderCards: options.canMutateConfig ?? false,
    },
    header: { widgets: headerWidgets },
    cards,
    sources,
  };
}

async function resolveHeaderWidgets(
  widgets: HeaderWidgetDefinition[],
  runtime: ConnectorRuntime,
  connectors: Catalog["connectors"],
  sources: Record<string, SourceFreshness>
): Promise<ResolvedHeaderWidget[]> {
  return Promise.all(widgets.map(async (definition) => {
    const snapshot = await runtime.get(definition.connector, connectors);
    const data = { [definition.connector]: snapshot.data };
    sources[definition.connector] = snapshot.freshness;
    return {
      definition,
      value: definition.kind === "weather" ? resolveDataPath(data, definition.path) : null,
      label: definition.kind === "label" ? (definition.labelPath ? asString(resolveDataPath(data, definition.labelPath)) : definition.label ?? null) : null,
      tooltip: definition.kind === "label" ? (definition.tooltipPath ? asString(resolveDataPath(data, definition.tooltipPath)) : definition.tooltip ?? null) : null,
      tone: definition.kind === "label" ? (definition.tonePath ? asString(resolveDataPath(data, definition.tonePath)) : definition.tone ?? null) : null,
      href: definition.kind === "label" && definition.hrefPath ? asString(resolveDataPath(data, definition.hrefPath)) : null,
      freshness: snapshot.freshness,
      error: snapshot.freshness.error,
    };
  }));
}

function resolveDataPath(root: unknown, path: string): unknown {
  const normalized = path.startsWith("$.") ? path.slice(2) : path;
  const parts = normalized
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  let current = root;
  for (const part of parts) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const index = Number(part);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function createRuntime(paths: DashboardPaths): ConnectorRuntime {
  return new ConnectorRuntime(paths);
}
