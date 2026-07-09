import { useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  isThemeId,
  normalizeThemeChoice,
  normalizeThemeId,
  type ThemeAppearanceInput,
  type ThemeId,
} from "../shared/themes";

const STORAGE_KEY = "dashboard-theme";

/** Runtime theme context exposed as <html> data attributes. CSS themes can use
 * these generic signals for clock-aware variants without coupling React to a
 * specific theme id. Keep these boundaries in sync with index.html's inline
 * first-paint fallback. */
export type ThemeTimePhase = "dawn" | "morning" | "day" | "dusk" | "twilight" | "night";

export interface ThemeEnvironment {
  localHour: number;
  timePhase: ThemeTimePhase;
}

export function timePhaseForHour(hour: number): ThemeTimePhase {
  if (hour < 5) return "night";
  if (hour < 8) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 17) return "day";
  if (hour < 20) return "dusk";
  if (hour < 22) return "twilight";
  return "night";
}

export function themeEnvironmentForDate(date: Date): ThemeEnvironment {
  const localHour = date.getHours();
  return {
    localHour,
    timePhase: timePhaseForHour(localHour),
  };
}

export function applyThemeEnvironment(date = new Date()): void {
  const env = themeEnvironmentForDate(date);
  const root = document.documentElement;
  root.dataset.localHour = String(env.localHour);
  root.dataset.timePhase = env.timePhase;
  delete root.dataset.livePhase;
}

/* Advance clock-aware themes without a reload. The root data attributes are
 * intentionally generic, so future themes can opt in with CSS only. */
const ENVIRONMENT_TICK_MS = 5 * 60 * 1000;
if (typeof window !== "undefined") {
  window.setInterval(() => applyThemeEnvironment(), ENVIRONMENT_TICK_MS);
}

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode etc.; theme just won't persist.
  }
}

export function getStoredTheme(appearance?: ThemeAppearanceInput | null): ThemeId {
  const stored = readStoredTheme();
  const theme = normalizeThemeChoice(stored, appearance);
  const normalizedStored = normalizeThemeId(stored);
  const canPersistFallback = appearance !== undefined && appearance !== null;
  if (stored !== null && stored !== theme && (normalizedStored !== null || canPersistFallback)) persistTheme(theme);
  return theme;
}

/** index.html applies a validated stored value inline before CSS paints; main.tsx
 * calls this to normalize legacy/invalid storage before React renders. */
export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
  applyThemeEnvironment();
}

/* <html data-theme> is the single runtime source of truth. useTheme reads it
 * through useSyncExternalStore so any number of consumers stay in sync after
 * a switch (per-component useState would silently drift). */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ThemeId {
  const current = document.documentElement.dataset.theme;
  return isThemeId(current) ? current : DEFAULT_THEME;
}

function notifyThemeListeners(): void {
  listeners.forEach((notify) => notify());
}

export function setTheme(next: ThemeId): void {
  applyTheme(next);
  persistTheme(next);
  notifyThemeListeners();
}

export function syncThemeWithAppearance(appearance?: ThemeAppearanceInput | null): ThemeId {
  const next = getStoredTheme(appearance);
  if (getSnapshot() !== next) {
    applyTheme(next);
    notifyThemeListeners();
  }
  return next;
}

export function useTheme(): [ThemeId, (theme: ThemeId) => void] {
  return [useSyncExternalStore(subscribe, getSnapshot), setTheme];
}
