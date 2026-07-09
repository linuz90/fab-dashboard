import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export interface FileSignature {
  mtimeMs: number;
  size: number;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

function timestampForFile(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function sameSignature(a: FileSignature, b: FileSignature): boolean {
  return a.mtimeMs === b.mtimeMs && a.size === b.size;
}

async function assertExpectedSignature(path: string, expected: FileSignature | undefined): Promise<void> {
  if (!expected) return;
  const current = await stat(path);
  if (!sameSignature(current, expected)) {
    const error = new Error("file changed while writing");
    (error as NodeJS.ErrnoException).code = "ESTALE";
    throw error;
  }
}

export async function writeJsonAtomic(
  path: string,
  value: unknown,
  options: { backup?: boolean; expected?: FileSignature } = {},
): Promise<string | null> {
  await ensureDir(dirname(path));
  await assertExpectedSignature(path, options.expected);

  let backupPath: string | null = null;
  if (options.backup && (await pathExists(path))) {
    const backupDir = join(dirname(path), ".backups");
    await ensureDir(backupDir);
    backupPath = join(backupDir, `${basename(path)}.${timestampForFile()}.bak`);
    await copyFile(path, backupPath);
  }

  const tmp = join(dirname(path), `.${basename(path)}.${crypto.randomUUID()}.tmp`);
  try {
    await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await assertExpectedSignature(path, options.expected);
    await rename(tmp, path);
    return backupPath;
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}
