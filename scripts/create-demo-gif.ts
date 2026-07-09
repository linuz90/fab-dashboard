import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { chromium, type Browser } from "playwright";
import { isThemeId, type ThemeId } from "../src/shared/themes";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demoHome = join(repoRoot, "local", "readme-demo");
const demoStateHome = join(repoRoot, "local", "readme-demo-state");
const outputGif = join(repoRoot, "docs", "assets", "fab-dashboard-demo.gif");
const viewport = { width: 1440, height: 1100 };
const gifWidth = 1200;
const frameSeconds = 1.25;
const fixedDemoNow = { year: 2026, monthIndex: 6, day: 9, hour: 14, minute: 30 };

interface ManagedProcess {
  name: string;
  process: ReturnType<typeof Bun.spawn>;
}

type ProcessEnv = Record<string, string | undefined>;

const managedProcesses: ManagedProcess[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function findFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("could not allocate a local port")));
        return;
      }
      const { port } = address;
      server.close(() => resolvePort(port));
    });
  });
}

async function assertFfmpegAvailable(): Promise<void> {
  let result: ReturnType<typeof Bun.spawn>;
  try {
    result = Bun.spawn(["ffmpeg", "-version"], {
      cwd: repoRoot,
      stdout: "ignore",
      stderr: "ignore",
    });
  } catch {
    throw new Error("ffmpeg is required to create docs/assets/fab-dashboard-demo.gif. Install it, then rerun `bun run create-demo-gif`.");
  }
  const code = await result.exited;
  if (code !== 0) {
    throw new Error("ffmpeg is required to create docs/assets/fab-dashboard-demo.gif. Install it, then rerun `bun run create-demo-gif`.");
  }
}

async function runCommand(name: string, args: string[], env: ProcessEnv = {}): Promise<void> {
  console.log(`[demo-gif] ${name} ${args.join(" ")}`);
  const child = Bun.spawn([name, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await child.exited;
  if (code !== 0) throw new Error(`${name} ${args.join(" ")} exited with code ${code}`);
}

function spawnManaged(name: string, args: string[], env: ProcessEnv): ManagedProcess {
  console.log(`[demo-gif] starting ${name}`);
  const child = Bun.spawn(args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdout: "inherit",
    stderr: "inherit",
  });
  const managed = { name, process: child };
  managedProcesses.push(managed);
  return managed;
}

async function stopManagedProcesses(): Promise<void> {
  for (const child of managedProcesses) child.process.kill();
  await Promise.allSettled(managedProcesses.map((child) => child.process.exited));
}

function installSignalHandlers(): void {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void stopManagedProcesses().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
    });
  }
}

async function readDemoThemes(): Promise<ThemeId[]> {
  const dashboardPath = join(repoRoot, "examples", "dashboard.demo.json");
  const dashboard = JSON.parse(await readFile(dashboardPath, "utf8")) as {
    appearance?: { themes?: unknown[] };
  };
  const themes = dashboard.appearance?.themes;
  if (!Array.isArray(themes) || themes.length === 0) {
    throw new Error("examples/dashboard.demo.json must define appearance.themes for the README demo GIF.");
  }

  const invalidThemes = themes.filter((theme) => !isThemeId(theme));
  if (invalidThemes.length > 0) {
    throw new Error(`examples/dashboard.demo.json contains unknown theme ids: ${invalidThemes.join(", ")}`);
  }
  return themes as ThemeId[];
}

async function waitForUrl(url: string, label: string, timeoutMs = 30_000): Promise<void> {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(250);
  }
  throw new Error(`${label} did not become ready at ${url}${lastError ? ` (${lastError})` : ""}`);
}

async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch (chromeError) {
    try {
      return await chromium.launch({ headless: true });
    } catch (bundledError) {
      throw new Error(
        [
          "Could not launch Chrome or Playwright Chromium.",
          "Install Google Chrome, or run `bunx playwright install chromium`, then rerun `bun run create-demo-gif`.",
          `Chrome launch error: ${chromeError instanceof Error ? chromeError.message : String(chromeError)}`,
          `Chromium launch error: ${bundledError instanceof Error ? bundledError.message : String(bundledError)}`,
        ].join("\n"),
      );
    }
  }
}

async function captureFrames(options: {
  framesDir: string;
  themes: ThemeId[];
  vitePort: number;
}): Promise<string[]> {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
    });

    const page = await context.newPage();
    // Freeze browser time before navigation so regenerated README assets only
    // change when the dashboard UI or demo data changes.
    await page.clock.setFixedTime(new Date(
      fixedDemoNow.year,
      fixedDemoNow.monthIndex,
      fixedDemoNow.day,
      fixedDemoNow.hour,
      fixedDemoNow.minute,
    ));
    await page.goto(`http://127.0.0.1:${options.vitePort}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-dashboard-card-id]", { timeout: 30_000 });
    await page.waitForTimeout(900);

    const frames: string[] = [];
    for (const [index, theme] of options.themes.entries()) {
      await page.evaluate((nextTheme) => {
        localStorage.setItem("dashboard-theme", nextTheme);
        document.documentElement.dataset.theme = nextTheme;
        document.documentElement.dataset.localHour = "14";
        document.documentElement.dataset.timePhase = "day";
        document.querySelector(".app-scroll")?.scrollTo(0, 0);
      }, theme);
      await page.waitForTimeout(250);

      const framePath = join(options.framesDir, `frame-${String(index).padStart(2, "0")}.png`);
      await page.screenshot({ path: framePath, fullPage: false, animations: "disabled" });
      frames.push(framePath);
      console.log(`[demo-gif] captured ${theme}`);
    }
    return frames;
  } finally {
    await browser.close();
  }
}

async function encodeGif(framesDir: string): Promise<void> {
  await mkdir(dirname(outputGif), { recursive: true });
  const framePattern = join(framesDir, "frame-%02d.png");
  const palettePath = join(framesDir, "palette.png");
  const frameRate = (1 / frameSeconds).toFixed(2);

  await runCommand("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-framerate",
    frameRate,
    "-i",
    framePattern,
    "-vf",
    `scale=${gifWidth}:-1:flags=lanczos,palettegen=max_colors=160:stats_mode=diff`,
    "-frames:v",
    "1",
    "-update",
    "1",
    palettePath,
  ]);
  await runCommand("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-framerate",
    frameRate,
    "-i",
    framePattern,
    "-i",
    palettePath,
    "-lavfi",
    `scale=${gifWidth}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
    "-loop",
    "0",
    outputGif,
  ]);
}

async function main(): Promise<void> {
  installSignalHandlers();
  const keepFrames = process.argv.includes("--keep-frames");
  const themes = await readDemoThemes();
  const framesDir = await mkdtemp(join(tmpdir(), "fab-dashboard-demo-gif-"));
  const apiPort = await findFreePort();
  const vitePort = await findFreePort();
  const demoEnv: ProcessEnv = {
    FAB_DASHBOARD_HOME: demoHome,
    FAB_DASHBOARD_STATE_HOME: demoStateHome,
    FAB_DASHBOARD_PORT: String(apiPort),
    FAB_DASHBOARD_HOST: "127.0.0.1",
    FAB_DASHBOARD_ALLOWED_HOSTS: "localhost,127.0.0.1",
  };

  let succeeded = false;
  try {
    await assertFfmpegAvailable();
    await rm(demoHome, { recursive: true, force: true });
    await rm(demoStateHome, { recursive: true, force: true });
    await mkdir(demoHome, { recursive: true });
    await mkdir(demoStateHome, { recursive: true });

    await runCommand(process.execPath, ["run", "src/cli.ts", "init", "--demo", "--force"], demoEnv);
    await runCommand(process.execPath, ["run", "src/cli.ts", "validate"], demoEnv);

    spawnManaged("api", [process.execPath, "run", "server.ts"], demoEnv);
    spawnManaged("vite", [process.execPath, "x", "vite", "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"], demoEnv);
    await waitForUrl(`http://127.0.0.1:${apiPort}/healthz`, "dashboard API");
    await waitForUrl(`http://127.0.0.1:${vitePort}/healthz`, "Vite dev server");

    await captureFrames({ framesDir, themes, vitePort });
    await encodeGif(framesDir);

    const gifStats = await stat(outputGif);
    console.log(`[demo-gif] wrote ${outputGif} (${Math.round(gifStats.size / 1024)} KB)`);
    succeeded = true;
  } finally {
    await stopManagedProcesses();
    if (!keepFrames && succeeded) {
      await rm(framesDir, { recursive: true, force: true });
    } else {
      console.log(`[demo-gif] frames kept at ${framesDir}`);
    }
  }
}

await main();
