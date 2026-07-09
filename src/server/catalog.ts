import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  cardDefinitionSchema,
  connectorManifestSchema,
  prettyZodError,
  type CardDefinition,
  type ConnectorManifest,
} from "../shared/schemas";
import type { DashboardPaths } from "./paths";
import { pathExists, readJsonFile } from "./storage";

export interface Catalog {
  cards: Map<string, CardDefinition>;
  connectors: Map<string, ConnectorManifest>;
  counts: {
    exampleCards: number;
    localCards: number;
    exampleConnectors: number;
    localConnectors: number;
  };
  errors: string[];
}

async function readManifestDirs<T>({
  dir,
  filename,
  parse,
}: {
  dir: string;
  filename: string;
  parse: (value: unknown) => T;
}): Promise<{ values: T[]; errors: string[] }> {
  if (!(await pathExists(dir))) return { values: [], errors: [] };
  const entries = await readdir(dir, { withFileTypes: true });
  const values: T[] = [];
  const errors: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name, filename);
    if (!(await pathExists(path))) continue;
    try {
      values.push(parse(await readJsonFile(path)));
    } catch (error) {
      errors.push(`${path}: ${prettyZodError(error)}`);
    }
  }
  return { values, errors };
}

export async function loadCatalog(paths: DashboardPaths): Promise<Catalog> {
  const cards = new Map<string, CardDefinition>();
  const connectors = new Map<string, ConnectorManifest>();
  const errors: string[] = [];

  const [exampleCardSet, localCardSet] = await Promise.all([
    readManifestDirs({
      dir: paths.exampleCardsDir,
      filename: "card.json",
      parse: (value) => cardDefinitionSchema.parse(value),
    }),
    readManifestDirs({
      dir: paths.localCardsDir,
      filename: "card.json",
      parse: (value) => cardDefinitionSchema.parse(value),
    }),
  ]);

  for (const set of [exampleCardSet, localCardSet]) {
    errors.push(...set.errors);
    for (const card of set.values) cards.set(card.type, card);
  }

  const [exampleConnectorSet, localConnectorSet] = await Promise.all([
    readManifestDirs({
      dir: paths.exampleConnectorsDir,
      filename: "connector.json",
      parse: (value) => connectorManifestSchema.parse(value),
    }),
    readManifestDirs({
      dir: paths.localConnectorsDir,
      filename: "connector.json",
      parse: (value) => connectorManifestSchema.parse(value),
    }),
  ]);

  for (const set of [exampleConnectorSet, localConnectorSet]) {
    errors.push(...set.errors);
    for (const connector of set.values) connectors.set(connector.id, connector);
  }

  return {
    cards,
    connectors,
    counts: {
      exampleCards: exampleCardSet.values.length,
      localCards: localCardSet.values.length,
      exampleConnectors: exampleConnectorSet.values.length,
      localConnectors: localConnectorSet.values.length,
    },
    errors,
  };
}
