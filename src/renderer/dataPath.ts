export function resolvePath(root: unknown, path: string): unknown {
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

export function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "number" ? item : Number(item))).filter(Number.isFinite);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function safeHref(value: string, base = "http://127.0.0.1"): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed, base);
    // App deep-links stay explicitly allowlisted so local connectors can link to
    // useful desktop workflows without turning the renderer into a generic
    // protocol launcher.
    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "mailto:" ||
      parsed.protocol === "things:"
    ) {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

export function safeSrc(value: string, base = "http://127.0.0.1"): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed, base);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}
