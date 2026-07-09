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

function parseOrigin(value: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function requestCanMutateConfig(
  req: Request,
  options: { serverHost: string; remoteAddress?: string | null },
): boolean {
  if (!configMutationsAllowed(options.serverHost)) return false;
  if (!isLocalHostname(options.remoteAddress ?? "")) return false;

  const requestUrl = new URL(req.url);
  if (!isLocalHostname(requestUrl.hostname)) return false;

  const origin = parseOrigin(req.headers.get("origin"));
  if (!origin) return true;
  return isLocalHostname(origin.hostname);
}
