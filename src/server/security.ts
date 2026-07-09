export function normalizeHostname(host: string | null): string {
  if (!host) return "";
  const normalized = host.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized) return "";

  if (normalized.startsWith("[")) {
    const end = normalized.indexOf("]");
    if (end !== -1) return normalized.slice(1, end);
  }

  const colonCount = normalized.split(":").length - 1;
  if (colonCount > 1) return normalized;
  return normalized.replace(/:\d+$/, "");
}

export function isLocalHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function configMutationsAllowed(hostname: string): boolean {
  return isLocalHostname(hostname);
}

export function parseTrustedConfigOrigins(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => parseOrigin(value.trim())?.origin)
    .filter((origin): origin is string => Boolean(origin));
}

function parseOrigin(value: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function originCanMutate(url: URL, trustedOrigins: ReadonlySet<string>): boolean {
  if (isLocalHostname(url.hostname) || trustedOrigins.has(url.origin)) return true;
  if (url.protocol !== "http:") return false;

  // Tailscale Serve terminates HTTPS before proxying to the local HTTP server,
  // so Bun may see the public tailnet host with an http: request URL.
  const externalHttpsUrl = new URL(url);
  externalHttpsUrl.protocol = "https:";
  return trustedOrigins.has(externalHttpsUrl.origin);
}

export function requestCanMutateConfig(
  req: Request,
  options: { serverHost: string; remoteAddress?: string | null; trustedOrigins?: readonly string[] },
): boolean {
  if (!configMutationsAllowed(options.serverHost)) return false;
  if (!isLocalHostname(options.remoteAddress ?? "")) return false;

  const trustedOrigins = new Set(options.trustedOrigins ?? []);
  const requestUrl = new URL(req.url);
  if (!originCanMutate(requestUrl, trustedOrigins)) return false;

  const origin = parseOrigin(req.headers.get("origin"));
  if (!origin) return true;
  return originCanMutate(origin, trustedOrigins);
}
