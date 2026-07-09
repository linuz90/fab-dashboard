import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_THEMES,
  DEFAULT_THEME,
  THEME_DEFINITIONS,
  isThemeId,
  normalizeThemeChoice,
  normalizeThemeId,
  resolveDefaultTheme,
  resolveSelectableThemes,
  themeFrameShape,
  themeLabel,
  themeRefreshPalette,
  themeSearchText,
} from "./themes";

describe("theme registry", () => {
  test("has unique ids and labels with a valid explicit default", () => {
    expect(new Set(ALL_THEMES).size).toBe(ALL_THEMES.length);
    expect(new Set(THEME_DEFINITIONS.map((theme) => theme.id))).toEqual(new Set(ALL_THEMES));
    expect(new Set(THEME_DEFINITIONS.map((theme) => theme.label)).size).toBe(THEME_DEFINITIONS.length);
    expect(isThemeId(DEFAULT_THEME)).toBe(true);
    expect(DEFAULT_THEME).toBe("basic");
    expect(themeLabel("basic")).toBe("Basic");
  });

  test("normalizes legacy and curated theme choices", () => {
    expect(normalizeThemeId("claude")).toBe("basic");
    expect(themeSearchText("basic")).toContain("claude");
    expect(resolveSelectableThemes({ themes: ["live", "apple"] })).toEqual(["live", "apple"]);
    expect(resolveDefaultTheme({ themes: ["live", "apple"] })).toBe("live");
    expect(resolveDefaultTheme({ defaultTheme: "apple", themes: ["live", "apple"] })).toBe("apple");
    expect(normalizeThemeChoice("claude", { themes: ["apple", "live"] })).toBe("apple");
    expect(normalizeThemeChoice("e-ink", { defaultTheme: "live", themes: ["apple", "live"] })).toBe("live");
  });

  test("exposes frame and refresh traits for card chrome", () => {
    expect(themeFrameShape("classic-macos")).toBe("square");
    expect(themeFrameShape("e-ink")).toBe("square");
    expect(themeFrameShape("basic")).toBe("rounded");
    expect(themeRefreshPalette("e-ink")).toBe("mono");
    expect(themeRefreshPalette("live")).toBe("ocean");
  });

  test("keeps non-basic theme css files imported", () => {
    const root = process.cwd();
    const indexCss = readFileSync(join(root, "src/index.css"), "utf8");

    for (const theme of ALL_THEMES) {
      if (theme === "basic") continue;
      const cssPath = join(root, "src/themes", `${theme}.css`);
      expect(existsSync(cssPath), `${theme} css file`).toBe(true);
      expect(indexCss, `${theme} css import`).toContain(`@import "./themes/${theme}.css";`);
    }
  });

  test("keeps first-paint html allowlist in sync with registry", () => {
    const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const match = indexHtml.match(/\[([^\]]+)\]\.indexOf\(t\)/);
    expect(match, "inline theme allowlist").not.toBeNull();

    const inlineThemes = JSON.parse(`[${match![1]}]`) as string[];
    expect(inlineThemes).toEqual([...ALL_THEMES]);
  });

  test("keeps first-paint theme environment attributes available", () => {
    const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");

    expect(indexHtml).toContain("dataset.localHour");
    expect(indexHtml).toContain("dataset.timePhase");
    expect(indexHtml).not.toContain("dataset.livePhase =");
  });

  test("keeps dynamic theme css on generic environment attributes", () => {
    const liveCss = readFileSync(join(process.cwd(), "src/themes/live.css"), "utf8");

    expect(liveCss).toContain('[data-time-phase="dawn"]');
    expect(liveCss).not.toContain("data-live-phase");
  });
});
