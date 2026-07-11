export const ALL_THEMES = ["basic", "apple", "classic-macos", "kingdom", "e-ink", "live"] as const;

export type ThemeId = (typeof ALL_THEMES)[number];
export type ThemeChartStyle = "smooth" | "dither";
export type ThemeFrameShape = "rounded" | "square";
export type ThemeRefreshPalette = "ocean" | "mono";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  aliases: readonly string[];
  chartStyle: ThemeChartStyle;
  frameShape: ThemeFrameShape;
  refreshPalette: ThemeRefreshPalette;
}

export interface ThemeAppearanceInput {
  defaultTheme?: ThemeId;
  themes?: readonly ThemeId[];
}

export const DEFAULT_THEME: ThemeId = "basic";

export const THEME_DEFINITIONS = [
  {
    id: "basic",
    label: "Basic",
    aliases: ["default", "neutral", "claude"],
    chartStyle: "smooth",
    frameShape: "rounded",
    refreshPalette: "ocean",
  },
  {
    id: "apple",
    label: "Apple",
    aliases: ["ios", "macos", "squircle", "sf"],
    chartStyle: "smooth",
    frameShape: "rounded",
    refreshPalette: "ocean",
  },
  {
    id: "classic-macos",
    label: "Classic MacOS",
    aliases: ["classic", "mac os", "macintosh", "retro", "system 9"],
    chartStyle: "smooth",
    frameShape: "square",
    refreshPalette: "ocean",
  },
  {
    id: "kingdom",
    label: "Kingdom",
    aliases: ["medieval", "parchment", "manuscript"],
    chartStyle: "smooth",
    frameShape: "rounded",
    refreshPalette: "ocean",
  },
  {
    id: "e-ink",
    label: "E-ink",
    aliases: ["ebook", "kindle", "paper", "grayscale", "monochrome"],
    chartStyle: "dither",
    frameShape: "square",
    refreshPalette: "mono",
  },
  {
    id: "live",
    label: "Live",
    aliases: ["glass", "sky", "time", "daylight", "dynamic"],
    chartStyle: "smooth",
    frameShape: "rounded",
    refreshPalette: "ocean",
  },
] as const satisfies readonly ThemeDefinition[];

const THEME_BY_ID = new Map(THEME_DEFINITIONS.map((theme) => [theme.id, theme] as const));

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (ALL_THEMES as readonly string[]).includes(value);
}

export function normalizeThemeId(value: unknown): ThemeId | null {
  if (value === "claude") return "basic";
  return isThemeId(value) ? value : null;
}

export function themeDefinition(theme: ThemeId): ThemeDefinition {
  return THEME_BY_ID.get(theme) ?? THEME_BY_ID.get(DEFAULT_THEME)!;
}

export function themeLabel(theme: ThemeId): string {
  return themeDefinition(theme).label;
}

export function themeSearchText(theme: ThemeId): string {
  const definition = themeDefinition(theme);
  return [definition.id, definition.label, ...definition.aliases].join(" ");
}

export function themeChartStyle(theme: ThemeId): ThemeChartStyle {
  return themeDefinition(theme).chartStyle;
}

export function themeFrameShape(theme: ThemeId): ThemeFrameShape {
  return themeDefinition(theme).frameShape;
}

export function themeRefreshPalette(theme: ThemeId): ThemeRefreshPalette {
  return themeDefinition(theme).refreshPalette;
}

export function resolveSelectableThemes(appearance?: ThemeAppearanceInput | null): ThemeId[] {
  const requested = appearance?.themes;
  if (!requested?.length) return [...ALL_THEMES];

  const selectable: ThemeId[] = [];
  for (const theme of requested) {
    if (!isThemeId(theme) || selectable.includes(theme)) continue;
    selectable.push(theme);
  }
  return selectable.length > 0 ? selectable : [...ALL_THEMES];
}

export function resolveDefaultTheme(appearance?: ThemeAppearanceInput | null): ThemeId {
  const selectable = resolveSelectableThemes(appearance);
  const preferred = appearance?.defaultTheme ?? DEFAULT_THEME;
  if (selectable.includes(preferred)) return preferred;
  if (selectable.includes(DEFAULT_THEME)) return DEFAULT_THEME;
  return selectable[0] ?? DEFAULT_THEME;
}

export function normalizeThemeChoice(value: unknown, appearance?: ThemeAppearanceInput | null): ThemeId {
  const normalized = normalizeThemeId(value);
  const selectable = resolveSelectableThemes(appearance);
  return normalized && selectable.includes(normalized) ? normalized : resolveDefaultTheme(appearance);
}
