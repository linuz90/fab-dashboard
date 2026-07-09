import { z } from "zod";
import {
  DASHBOARD_CONFIG_MUTATION_HEADER,
  REORDER_CARDS_ACTION,
  UPDATE_APPEARANCE_LAYOUT_ACTION,
} from "../shared/actions";
import type { DashboardPaths } from "./paths";
import {
  DashboardConfigActionError,
  parseReorderDashboardCardsInput,
  parseUpdateAppearanceLayoutInput,
  reorderDashboardCards,
  updateDashboardAppearanceLayout,
} from "./configActions";

interface ActionRouteOptions {
  mutationsAllowed?: boolean;
  publicOrigin?: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function isLocalOrigin(url: URL): boolean {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1")
  );
}

function normalizedOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function originAllowed(req: Request, options: ActionRouteOptions): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  let requestUrl: URL;
  let originUrl: URL;
  try {
    requestUrl = new URL(req.url);
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  if (originUrl.origin === requestUrl.origin) return true;
  if (isLocalOrigin(originUrl)) return true;

  const publicOrigin = normalizedOrigin(options.publicOrigin);
  return publicOrigin !== null && originUrl.origin === publicOrigin;
}

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DashboardConfigActionError(`invalid JSON body: ${message}`, 400);
  }
}

function rejectMutationRequest(req: Request, options: ActionRouteOptions, action: string): Response | null {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!options.mutationsAllowed) {
    return json({ error: "dashboard config mutations are only available on local dashboard servers" }, 403);
  }
  if (req.headers.get(DASHBOARD_CONFIG_MUTATION_HEADER) !== action) {
    return json({ error: "missing dashboard config mutation header" }, 403);
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "cross-site dashboard config mutations are not allowed" }, 403);
  }
  if (!originAllowed(req, options)) return json({ error: "origin not allowed" }, 403);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "content-type must be application/json" }, 415);
  }

  return null;
}

export async function handleReorderCardsRequest(
  req: Request,
  paths: Pick<DashboardPaths, "dashboardJson">,
  options: ActionRouteOptions = {},
): Promise<Response> {
  const rejection = rejectMutationRequest(req, options, REORDER_CARDS_ACTION);
  if (rejection) return rejection;

  try {
    const input = parseReorderDashboardCardsInput(await readJsonBody(req));
    const result = await reorderDashboardCards(paths, input);
    return json({ ok: true, changed: result.changed });
  } catch (error) {
    if (error instanceof DashboardConfigActionError) {
      return json({ error: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return json({ error: `dashboard.json: ${z.prettifyError(error)}` }, 409);
    }
    console.error(`[fab-dashboard] reorder-cards failed: ${error instanceof Error ? (error.stack ?? error.message) : error}`);
    return json({ error: "failed to reorder cards" }, 500);
  }
}

export async function handleUpdateAppearanceLayoutRequest(
  req: Request,
  paths: Pick<DashboardPaths, "dashboardJson">,
  options: ActionRouteOptions = {},
): Promise<Response> {
  const rejection = rejectMutationRequest(req, options, UPDATE_APPEARANCE_LAYOUT_ACTION);
  if (rejection) return rejection;

  try {
    const input = parseUpdateAppearanceLayoutInput(await readJsonBody(req));
    const result = await updateDashboardAppearanceLayout(paths, input);
    return json({ ok: true, changed: result.changed });
  } catch (error) {
    if (error instanceof DashboardConfigActionError) {
      return json({ error: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return json({ error: `dashboard.json: ${z.prettifyError(error)}` }, 409);
    }
    console.error(`[fab-dashboard] update-appearance-layout failed: ${error instanceof Error ? (error.stack ?? error.message) : error}`);
    return json({ error: "failed to update layout" }, 500);
  }
}
