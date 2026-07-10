import { chmod, copyFile, lstat, readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ConnectorManifest, SourceFreshness } from "../shared/schemas";
import { resolveUserPath, type DashboardPaths } from "./paths";
import { ensureDir, pathExists, readJsonFile, writeJsonAtomic } from "./storage";

export interface ConnectorSnapshot {
  data: unknown;
  freshness: SourceFreshness;
  manifestHash: string;
}

interface ConnectorGetOptions {
  waitForRefresh?: boolean;
}

interface PersistedSnapshot {
  cacheVersion: 1;
  manifestHash: string;
  fetchedAt: string;
  ttlMs: number;
  data: unknown;
}

type ConnectorMap = Map<string, ConnectorManifest>;

const TS_CONNECTOR_IGNORED_DIRS = new Set(["node_modules"]);

function ttlMs(manifest: ConnectorManifest): number {
  return Math.max(0, manifest.ttlSeconds * 1000);
}

function isFresh(snapshot: ConnectorSnapshot, now = Date.now()): boolean {
  if (!snapshot.freshness.fetchedAt) return false;
  if (snapshot.freshness.ttlMs === 0) return true;
  return now - Date.parse(snapshot.freshness.fetchedAt) < snapshot.freshness.ttlMs;
}

function manifestHash(manifest: ConnectorManifest): string {
  return Bun.hash(JSON.stringify(manifest)).toString(36);
}

export function redactForDisplay(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  let redacted = raw;
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < 6) continue;
    if (!/(secret|token|key|password|auth|credential)/i.test(key)) continue;
    redacted = redacted.split(value).join("[redacted]");
  }
  return redacted
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(token|api[_-]?key|authorization)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/\b(sk|pk|ghp|gho|ghu|ghs|glpat|xox[baprs])[-_][A-Za-z0-9][A-Za-z0-9._-]{6,}\b/g, "$1-[redacted]")
    .slice(0, 500);
}

function isLocalUrl(url: string): boolean {
  const parsed = new URL(url);
  return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
}

async function connectorSourceFingerprint(root: string): Promise<string> {
  const parts: string[] = [];
  async function walk(dir: string, prefix = ""): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (TS_CONNECTOR_IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const source = await readFile(fullPath);
      parts.push(`${relativePath}\0${source.byteLength}\0${Bun.hash(source).toString(36)}`);
    }
  }

  await walk(root);
  return Bun.hash(parts.sort().join("\n")).toString(36);
}

async function copyConnectorSource(sourceDir: string, targetDir: string): Promise<void> {
  await ensureDir(targetDir);
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (TS_CONNECTOR_IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyConnectorSource(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) await copyFile(sourcePath, targetPath);
  }
}

function okSnapshot(data: unknown, manifest: ConnectorManifest): ConnectorSnapshot {
  return {
    data,
    manifestHash: manifestHash(manifest),
    freshness: {
      status: "fresh",
      fetchedAt: new Date().toISOString(),
      ttlMs: ttlMs(manifest),
      error: null,
      refreshing: false,
    },
  };
}

function errorSnapshot(error: unknown, manifest: ConnectorManifest, previous?: ConnectorSnapshot): ConnectorSnapshot {
  return {
    data: previous?.data ?? null,
    manifestHash: manifestHash(manifest),
    freshness: {
      status: previous?.data == null ? "error" : "stale",
      fetchedAt: previous?.freshness.fetchedAt ?? null,
      ttlMs: ttlMs(manifest),
      error: redactForDisplay(error),
      refreshing: false,
    },
  };
}

async function readJsonWithLimit(path: string, maxBytes: number): Promise<unknown> {
  const buf = await readFile(path);
  if (buf.byteLength > maxBytes) throw new Error(`payload exceeds ${maxBytes} bytes`);
  return JSON.parse(buf.toString("utf8"));
}

async function responseJsonWithLimit(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const buf = await response.arrayBuffer();
  if (buf.byteLength > maxBytes) throw new Error(`payload exceeds ${maxBytes} bytes`);
  return JSON.parse(Buffer.from(buf).toString("utf8"));
}

async function resolveSecret(ref: string | undefined): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith("env:")) return process.env[ref.slice("env:".length)] ?? null;
  if (ref.startsWith("file:")) return (await readFile(ref.slice("file:".length), "utf8")).trim();
  return null;
}

export class ConnectorRuntime {
  private snapshots = new Map<string, ConnectorSnapshot>();
  private refreshes = new Map<string, Promise<ConnectorSnapshot>>();

  constructor(private readonly paths: DashboardPaths) {}

  async get(id: string, connectors: ConnectorMap, options: ConnectorGetOptions = {}): Promise<ConnectorSnapshot> {
    const manifest = connectors.get(id);
    if (!manifest) {
      return {
        data: null,
        manifestHash: "missing",
        freshness: {
          status: "error",
          fetchedAt: null,
          ttlMs: 0,
          error: `missing connector "${id}"`,
          refreshing: false,
        },
      };
    }

    const hash = manifestHash(manifest);
    const cached = this.snapshots.get(id) ?? (await this.loadPersisted(id, manifest));
    const validCached = cached?.manifestHash === hash ? cached : null;
    if (validCached && isFresh(validCached)) return validCached;

    const running = this.refreshes.get(id);
    if (running) {
      if (!validCached || options.waitForRefresh) return running;
      return {
        ...validCached,
        freshness: { ...validCached.freshness, status: "stale", refreshing: true },
      };
    }

    const refresh = this.refresh(manifest, validCached ?? undefined).finally(() => this.refreshes.delete(id));
    this.refreshes.set(id, refresh);
    if (!validCached || options.waitForRefresh) return refresh;
    void refresh;
    return {
      ...validCached,
      freshness: { ...validCached.freshness, status: "stale", refreshing: true },
    };
  }

  private async loadPersisted(id: string, manifest: ConnectorManifest): Promise<ConnectorSnapshot | null> {
    if (!manifest.persist) return null;
    const path = `${this.paths.cacheHome}/${id}.json`;
    if (!(await pathExists(path))) return null;
    try {
      // Persisted connector payloads may contain private user aggregates.
      // Tighten old cache paths before reading them, not only on the next write.
      await ensureDir(this.paths.cacheHome, { mode: 0o700 });
      await chmod(path, 0o600);
      const persisted = (await readJsonFile(path)) as PersistedSnapshot;
      if (persisted.manifestHash !== manifestHash(manifest)) return null;
      const snapshot: ConnectorSnapshot = {
        data: persisted.data,
        manifestHash: persisted.manifestHash,
        freshness: {
          status: "stale",
          fetchedAt: persisted.fetchedAt,
          ttlMs: persisted.ttlMs,
          error: null,
          refreshing: false,
        },
      };
      this.snapshots.set(id, snapshot);
      return snapshot;
    } catch {
      return null;
    }
  }

  private async refresh(manifest: ConnectorManifest, previous?: ConnectorSnapshot): Promise<ConnectorSnapshot> {
    try {
      const data = await this.fetchConnector(manifest);
      const snapshot = okSnapshot(data, manifest);
      this.snapshots.set(manifest.id, snapshot);
      if (manifest.persist) await this.persist(manifest.id, snapshot);
      return snapshot;
    } catch (error) {
      const snapshot = errorSnapshot(error, manifest, previous);
      this.snapshots.set(manifest.id, snapshot);
      return snapshot;
    }
  }

  private async persist(id: string, snapshot: ConnectorSnapshot): Promise<void> {
    if (!snapshot.freshness.fetchedAt) return;
    await writeJsonAtomic(`${this.paths.cacheHome}/${id}.json`, {
      cacheVersion: 1,
      manifestHash: snapshot.manifestHash,
      fetchedAt: snapshot.freshness.fetchedAt,
      ttlMs: snapshot.freshness.ttlMs,
      data: snapshot.data,
    } satisfies PersistedSnapshot, { mode: 0o600, dirMode: 0o700 });
  }

  private async fetchConnector(manifest: ConnectorManifest): Promise<unknown> {
    switch (manifest.kind) {
      case "static":
        return manifest.data;
      case "file":
        return this.fetchFile(manifest);
      case "http":
        return this.fetchHttp(manifest);
      case "command":
        return this.fetchCommand(manifest);
      case "ts":
        return this.fetchTs(manifest);
    }
  }

  private async fetchFile(manifest: Extract<ConnectorManifest, { kind: "file" }>): Promise<unknown> {
    const path = resolveUserPath(manifest.path, this.paths.configHome);
    const info = await lstat(path);
    if (info.isSymbolicLink() && !manifest.allowSymlinks) throw new Error("symlinked files require allowSymlinks: true");
    return readJsonWithLimit(path, manifest.maxBytes);
  }

  private async fetchHttp(manifest: Extract<ConnectorManifest, { kind: "http" }>): Promise<unknown> {
    if (manifest.auth.type === "local-only" && !isLocalUrl(manifest.url)) {
      throw new Error("local-only auth requires a localhost URL");
    }

    const headers = new Headers(manifest.headers);
    if (manifest.auth.type === "bearer") {
      const token = await resolveSecret(manifest.auth.token);
      if (!token) throw new Error("bearer token is not available");
      headers.set("authorization", `Bearer ${token}`);
    }
    if (manifest.auth.type === "header") {
      if (!manifest.auth.header) throw new Error("header auth requires header");
      const value = await resolveSecret(manifest.auth.value);
      if (!value) throw new Error("header auth value is not available");
      headers.set(manifest.auth.header, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), manifest.timeoutMs);
    try {
      const response = await fetch(manifest.url, {
        method: manifest.method,
        headers,
        signal: controller.signal,
      });
      return await responseJsonWithLimit(response, manifest.maxBytes);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchCommand(manifest: Extract<ConnectorManifest, { kind: "command" }>): Promise<unknown> {
    const env: Record<string, string> = {};
    for (const key of ["PATH", "HOME", "SHELL", "TMPDIR", ...manifest.envAllowlist]) {
      if (process.env[key] !== undefined) env[key] = process.env[key]!;
    }

    const proc = Bun.spawn([manifest.command, ...manifest.args], {
      cwd: manifest.cwd ? resolveUserPath(manifest.cwd, this.paths.configHome) : this.paths.configHome,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    let timeout: Timer | undefined;
    try {
      const result = await Promise.race([
        Promise.all([
          proc.exited,
          new Response(proc.stdout).arrayBuffer(),
          new Response(proc.stderr).text(),
        ]),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            proc.kill();
            reject(new Error(`command timed out after ${manifest.timeoutMs}ms`));
          }, manifest.timeoutMs);
        }),
      ]);
      const [exitCode, stdout, stderr] = result;
      if (stdout.byteLength > manifest.maxStdoutBytes) throw new Error(`stdout exceeds ${manifest.maxStdoutBytes} bytes`);
      // Connector stderr often contains command context or secrets. Keep the
      // user-facing error useful without reflecting arbitrary local output.
      if (exitCode !== 0) throw new Error(`command exited ${exitCode}${stderr ? " with stderr" : ""}`);
      return JSON.parse(Buffer.from(stdout).toString("utf8"));
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async fetchTs(manifest: Extract<ConnectorManifest, { kind: "ts" }>): Promise<unknown> {
    const connectorDir = dirname(`${this.paths.localConnectorsDir}/${manifest.id}/connector.json`);
    const entry = resolveUserPath(manifest.entry, connectorDir);
    const entryDir = dirname(entry);
    const fingerprint = Bun.hash(`${entryDir}\n${await connectorSourceFingerprint(entryDir)}`).toString(36);
    const importDir = join(this.paths.cacheHome, "ts-connectors", manifest.id, fingerprint);
    const sourceCopy = join(importDir, "source");
    // Bun caches local TS modules by filesystem path and ignores query strings.
    // A content-addressed copy gives edited trusted connectors a fresh import
    // path while keeping relative imports inside the connector working.
    await copyConnectorSource(entryDir, sourceCopy);
    const url = pathToFileURL(join(sourceCopy, basename(entry))).href;
    const mod = await import(url) as {
      fetchRaw?: () => unknown | Promise<unknown>;
      normalize?: (raw: unknown) => unknown | Promise<unknown>;
      default?: () => unknown | Promise<unknown>;
    };
    const run = async () => {
      if (mod.fetchRaw) {
        const raw = await mod.fetchRaw();
        return mod.normalize ? mod.normalize(raw) : raw;
      }
      if (mod.default) return mod.default();
      throw new Error("ts connector must export fetchRaw() or default()");
    };
    let timeout: Timer | undefined;
    try {
      return await Promise.race([
        run(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`ts connector timed out after ${manifest.timeoutMs}ms`)), manifest.timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
