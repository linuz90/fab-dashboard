import { stat } from "node:fs/promises";
import { z } from "zod";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  resolveDashboardLayout,
  type DashboardLayoutConfig,
} from "../shared/layout";
import { dashboardConfigSchema, dashboardLayoutConfigSchema } from "../shared/schemas";
import type { DashboardPaths } from "./paths";
import { readJsonFile, writeJsonAtomic, type FileSignature } from "./storage";

export class DashboardConfigActionError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "DashboardConfigActionError";
  }
}

export interface ReorderDashboardCardsInput {
  baseOrder: string[];
  order: string[];
}

export interface ReorderDashboardCardsResult {
  changed: boolean;
}

export interface UpdateAppearanceLayoutInput {
  baseLayout: DashboardLayoutConfig;
  layout: DashboardLayoutConfig;
}

export interface UpdateAppearanceLayoutResult {
  changed: boolean;
}

const reorderDashboardCardsInputSchema = z.object({
  baseOrder: z.array(z.string().min(1)).max(500),
  order: z.array(z.string().min(1)).max(500),
}).strict();

const updateAppearanceLayoutInputSchema = z.object({
  baseLayout: dashboardLayoutConfigSchema,
  layout: dashboardLayoutConfigSchema,
}).strict();

interface RawCardWithId extends Record<string, unknown> {
  id: string;
}

interface RawDashboardConfig extends Record<string, unknown> {
  cards: RawCardWithId[];
}

let configWriteLock: Promise<void> = Promise.resolve();

async function withConfigWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const previous = configWriteLock;
  configWriteLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function dashboardJsonSignature(path: string): Promise<FileSignature> {
  return stat(path).then((s) => ({ mtimeMs: s.mtimeMs, size: s.size }));
}

async function readDashboardJsonForAction(paths: Pick<DashboardPaths, "dashboardJson">): Promise<{
  signature: FileSignature;
  raw: unknown;
}> {
  try {
    return {
      signature: await dashboardJsonSignature(paths.dashboardJson),
      raw: await readJsonFile(paths.dashboardJson),
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new DashboardConfigActionError("dashboard.json is missing; initialize the dashboard first", 404);
    }
    if (error instanceof SyntaxError) {
      throw new DashboardConfigActionError(`dashboard.json is not valid JSON: ${error.message}`, 409);
    }
    throw error;
  }
}

function validateDashboardJson(raw: unknown): void {
  try {
    dashboardConfigSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DashboardConfigActionError(`dashboard.json: ${z.prettifyError(error)}`, 409);
    }
    throw error;
  }
}

function writeConflictError(action: string): DashboardConfigActionError {
  return new DashboardConfigActionError(`dashboard.json changed while ${action}; reload and try again`, 409);
}

function asRawDashboardConfig(raw: unknown): RawDashboardConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new DashboardConfigActionError("dashboard.json must contain an object", 409);
  }
  const cards = (raw as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) {
    throw new DashboardConfigActionError("dashboard.json must contain a cards array", 409);
  }
  return raw as RawDashboardConfig;
}

function asRawObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new DashboardConfigActionError("dashboard.json must contain an object", 409);
  }
  return raw as Record<string, unknown>;
}

function asOptionalRawAppearance(raw: unknown): Record<string, unknown> {
  if (raw === undefined) return {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new DashboardConfigActionError("dashboard.json appearance must contain an object", 409);
  }
  return raw as Record<string, unknown>;
}

function serializeLayoutConfig(input: DashboardLayoutConfig): DashboardLayoutConfig {
  const resolved = resolveDashboardLayout(input);
  const layout: DashboardLayoutConfig = {};
  if (resolved.width !== DEFAULT_DASHBOARD_LAYOUT.width) layout.width = resolved.width;
  if (resolved.maxColumns !== DEFAULT_DASHBOARD_LAYOUT.maxColumns) layout.maxColumns = resolved.maxColumns;
  return layout;
}

function assertSameResolvedLayout(label: string, actual: DashboardLayoutConfig | null | undefined, expected: DashboardLayoutConfig) {
  const resolvedActual = resolveDashboardLayout(actual);
  const resolvedExpected = resolveDashboardLayout(expected);
  if (
    resolvedActual.width !== resolvedExpected.width ||
    resolvedActual.maxColumns !== resolvedExpected.maxColumns
  ) {
    throw new DashboardConfigActionError(`${label} does not match current dashboard layout; reload and try again`, 409);
  }
}

function hasOwnFields(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function sameJsonValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function assertSameOrder(label: string, actual: string[], expected: string[]) {
  if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
    throw new DashboardConfigActionError(`${label} does not match current dashboard order; reload and try again`, 409);
  }
}

function assertExactPermutation(currentOrder: string[], nextOrder: string[]) {
  if (nextOrder.length !== currentOrder.length) {
    throw new DashboardConfigActionError("card order must include every current card exactly once", 409);
  }

  const remaining = new Map<string, number>();
  for (const id of currentOrder) remaining.set(id, (remaining.get(id) ?? 0) + 1);

  for (const id of nextOrder) {
    const count = remaining.get(id) ?? 0;
    if (count === 0) throw new DashboardConfigActionError(`unknown or duplicate card id "${id}"`, 409);
    if (count === 1) remaining.delete(id);
    else remaining.set(id, count - 1);
  }

  if (remaining.size > 0) {
    throw new DashboardConfigActionError("card order is missing one or more current cards", 409);
  }
}

export function parseReorderDashboardCardsInput(input: unknown): ReorderDashboardCardsInput {
  try {
    return reorderDashboardCardsInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DashboardConfigActionError(`invalid reorder-cards request: ${z.prettifyError(error)}`, 400);
    }
    throw error;
  }
}

export function parseUpdateAppearanceLayoutInput(input: unknown): UpdateAppearanceLayoutInput {
  try {
    return updateAppearanceLayoutInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DashboardConfigActionError(`invalid update-appearance-layout request: ${z.prettifyError(error)}`, 400);
    }
    throw error;
  }
}

export async function reorderDashboardCards(
  paths: Pick<DashboardPaths, "dashboardJson">,
  input: ReorderDashboardCardsInput,
): Promise<ReorderDashboardCardsResult> {
  return withConfigWriteLock(async () => {
    const { signature, raw } = await readDashboardJsonForAction(paths);
    validateDashboardJson(raw);
    const rawConfig = asRawDashboardConfig(raw);
    const currentOrder = rawConfig.cards.map((card) => card.id);
    assertSameOrder("baseOrder", input.baseOrder, currentOrder);
    assertExactPermutation(currentOrder, input.order);

    if (currentOrder.length < 2 || input.order.every((id, index) => id === currentOrder[index])) {
      return { changed: false };
    }

    const cardsById = new Map(rawConfig.cards.map((card) => [card.id, card] as const));
    const nextRaw: RawDashboardConfig = {
      ...rawConfig,
      cards: input.order.map((id) => cardsById.get(id)!),
    };

    try {
      dashboardConfigSchema.parse(nextRaw);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new DashboardConfigActionError(`dashboard.json: ${z.prettifyError(error)}`, 409);
      }
      throw error;
    }

    // The schema parse above is a validation gate only; writing `nextRaw`
    // preserves the user's exact card objects instead of serializing defaults.
    try {
      await writeJsonAtomic(paths.dashboardJson, nextRaw, { expected: signature });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ESTALE" || code === "ENOENT") {
        throw writeConflictError("reordering");
      }
      throw error;
    }
    return { changed: true };
  });
}

export async function updateDashboardAppearanceLayout(
  paths: Pick<DashboardPaths, "dashboardJson">,
  input: UpdateAppearanceLayoutInput,
): Promise<UpdateAppearanceLayoutResult> {
  return withConfigWriteLock(async () => {
    const { signature, raw } = await readDashboardJsonForAction(paths);
    validateDashboardJson(raw);

    const rawConfig = asRawObject(raw);
    const rawAppearance = asOptionalRawAppearance(rawConfig.appearance);
    assertSameResolvedLayout("baseLayout", rawAppearance.layout as DashboardLayoutConfig | undefined, input.baseLayout);
    const nextAppearance = { ...rawAppearance };
    const nextLayout = serializeLayoutConfig(input.layout);

    if (hasOwnFields(nextLayout as Record<string, unknown>)) {
      nextAppearance.layout = nextLayout;
    } else {
      delete nextAppearance.layout;
    }

    const nextRaw: Record<string, unknown> = { ...rawConfig };
    if (hasOwnFields(nextAppearance)) {
      nextRaw.appearance = nextAppearance;
    } else {
      delete nextRaw.appearance;
    }

    if (sameJsonValue(rawConfig, nextRaw)) {
      return { changed: false };
    }

    try {
      dashboardConfigSchema.parse(nextRaw);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new DashboardConfigActionError(`dashboard.json: ${z.prettifyError(error)}`, 409);
      }
      throw error;
    }

    try {
      await writeJsonAtomic(paths.dashboardJson, nextRaw, { expected: signature });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ESTALE" || code === "ENOENT") {
        throw writeConflictError("updating layout");
      }
      throw error;
    }

    return { changed: true };
  });
}
