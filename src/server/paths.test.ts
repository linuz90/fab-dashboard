import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "./paths";

const keys = ["FAB_DASHBOARD_TEST_SECRET", "FAB_DASHBOARD_TEST_EXISTING", "FAB_DASHBOARD_TEST_HASH"];
const previous = new Map<string, string | undefined>();
let tempDir: string | null = null;

afterEach(() => {
  for (const key of keys) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previous.clear();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

function rememberEnv() {
  for (const key of keys) previous.set(key, process.env[key]);
}

function envValue(key: string): string | undefined {
  return process.env[key];
}

describe("loadEnvFile", () => {
  test("loads config secrets without overriding exported env", () => {
    rememberEnv();
    delete process.env.FAB_DASHBOARD_TEST_SECRET;
    delete process.env.FAB_DASHBOARD_TEST_HASH;
    process.env.FAB_DASHBOARD_TEST_EXISTING = "from-shell";

    tempDir = mkdtempSync(join(tmpdir(), "fab-dashboard-env-"));
    writeFileSync(
      join(tempDir, ".env"),
      [
        "# local dashboard secrets",
        "FAB_DASHBOARD_TEST_SECRET=\"hello world\"",
        "FAB_DASHBOARD_TEST_EXISTING=from-file",
        "FAB_DASHBOARD_TEST_HASH=abc123 # comment",
      ].join("\n"),
    );

    loadEnvFile(join(tempDir, ".env"));

    expect(envValue("FAB_DASHBOARD_TEST_SECRET")).toBe("hello world");
    expect(envValue("FAB_DASHBOARD_TEST_EXISTING")).toBe("from-shell");
    expect(envValue("FAB_DASHBOARD_TEST_HASH")).toBe("abc123");
  });
});
