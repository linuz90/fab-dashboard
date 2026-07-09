import { extname, join, normalize } from "node:path";
import { handleReorderCardsRequest, handleUpdateAppearanceLayoutRequest } from "./src/server/actionRoute";
import { buildDashboardResponse, createRuntime } from "./src/server/dashboard";
import { resolveDashboardPaths } from "./src/server/paths";
import { configMutationsAllowed, normalizeHostname, requestCanMutateConfig } from "./src/server/security";

const paths = resolveDashboardPaths();
const runtime = createRuntime(paths);

function parsePort(): number {
  const raw = process.env.FAB_DASHBOARD_PORT ?? process.env.PORT;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 7893;
}

const HOST = process.env.FAB_DASHBOARD_HOST?.trim() || "127.0.0.1";
const PORT = parsePort();
const CONFIG_MUTATIONS_SERVER_ALLOWED = configMutationsAllowed(HOST);
const DEFAULT_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "::1"];
const allowedHosts = new Set(
  (process.env.FAB_DASHBOARD_ALLOWED_HOSTS?.split(",").map((h) => h.trim()).filter(Boolean) ?? DEFAULT_ALLOWED_HOSTS)
    .map((host) => host.toLowerCase())
);

if (HOST !== "127.0.0.1" && HOST !== "localhost" && HOST !== "::1") {
  if (!process.env.FAB_DASHBOARD_ALLOWED_HOSTS || !process.env.FAB_DASHBOARD_PUBLIC_ORIGIN) {
    throw new Error("non-local FAB_DASHBOARD_HOST requires FAB_DASHBOARD_ALLOWED_HOSTS and FAB_DASHBOARD_PUBLIC_ORIGIN");
  }
}

const DIST_DIR = join(paths.repoRoot, "dist");
const NO_FALLBACK_STATIC_PATHS = new Set([
  "/manifest.webmanifest",
  "/sw.js",
  "/icon.svg",
  "/apple-touch-icon.png",
  "/favicon.ico",
]);

function hostAllowed(req: Request): boolean {
  const host = normalizeHostname(req.headers.get("host"));
  return allowedHosts.has(host);
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

function staticHeaders(pathname: string): HeadersInit {
  if (pathname.startsWith("/assets/")) {
    return { "Cache-Control": "public, max-age=31536000, immutable" };
  }
  return { "Cache-Control": "no-cache" };
}

async function serveStatic(pathname: string): Promise<Response> {
  const normalized = normalize(decodeURIComponent(pathname)).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(DIST_DIR, normalized === "/" ? "index.html" : normalized);
  const file = Bun.file(filePath);
  if (await file.exists()) return new Response(file, { headers: staticHeaders(pathname) });

  if (NO_FALLBACK_STATIC_PATHS.has(pathname) || extname(pathname)) {
    return new Response("Not found", { status: 404 });
  }

  const index = Bun.file(join(DIST_DIR, "index.html"));
  if (await index.exists()) return new Response(index, { headers: staticHeaders("/") });
  return new Response("Build missing. Run `bun run build` or use `bun run dev`.", { status: 503 });
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req, bunServer) {
    const url = new URL(req.url);
    if (!hostAllowed(req)) return json({ error: "host not allowed" }, 403);
    const canMutateConfig =
      CONFIG_MUTATIONS_SERVER_ALLOWED &&
      requestCanMutateConfig(req, {
        serverHost: HOST,
        remoteAddress: bunServer.requestIP(req)?.address ?? null,
      });

    if (url.pathname === "/healthz") {
      return json({
        ok: true,
        port: PORT,
        host: HOST,
      });
    }

    if (url.pathname === "/api/dashboard") {
      if (req.method !== "GET") return json({ error: "method not allowed" }, 405);
      return json(await buildDashboardResponse(paths, runtime, { canMutateConfig }));
    }

    if (url.pathname === "/api/dashboard/cards/reorder") {
      return handleReorderCardsRequest(req, paths, {
        mutationsAllowed: canMutateConfig,
        publicOrigin: process.env.FAB_DASHBOARD_PUBLIC_ORIGIN,
      });
    }

    if (url.pathname === "/api/dashboard/appearance/layout") {
      return handleUpdateAppearanceLayoutRequest(req, paths, {
        mutationsAllowed: canMutateConfig,
        publicOrigin: process.env.FAB_DASHBOARD_PUBLIC_ORIGIN,
      });
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    return serveStatic(url.pathname);
  },
});

console.log(`[fab-dashboard] listening on http://${server.hostname}:${server.port}`);
console.log(`[fab-dashboard] config home: ${paths.configHome}`);
