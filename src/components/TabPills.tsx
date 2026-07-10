import { useState } from "react";
import { useCardInteractionMode } from "./CardInteractionMode";
import { cn } from "../lib/cn";

const STORAGE_PREFIX = "dashboard:tab:";

export function createTransientTabSelections() {
  const selections = new Map<string, string>();

  return {
    restore<T extends string>(storageKey: string, tabs: readonly T[]): T | null {
      const selected = selections.get(storageKey);
      if (!selected) return null;
      if (tabs.includes(selected as T)) return selected as T;
      selections.delete(storageKey);
      return null;
    },
    remember<T extends string>(storageKey: string, tab: T) {
      selections.set(storageKey, tab);
    },
    clear() {
      selections.clear();
    },
  };
}

// Non-persisted tabs should survive card remounts caused by data refreshes but
// reset on a real page load. Module memory gives us exactly that lifecycle.
export const transientTabSelections = createTransientTabSelections();

/** Active tab state with optional per-card persistence. Preview renders are
 * deliberately isolated from storage so they always show the configured safe
 * default and cannot change the dashboard's selection. */
export function useStoredTab<T extends string>(
  storageKey: string,
  tabs: readonly T[],
  defaultTab: string,
  persist: boolean,
): [T, (t: T) => void] {
  const mode = useCardInteractionMode();
  const fallback = tabs.includes(defaultTab as T) ? (defaultTab as T) : tabs[0]!;
  const [tab, setTab] = useState<T>(() => {
    if (mode === "preview") return fallback;
    if (!persist) return transientTabSelections.restore(storageKey, tabs) ?? fallback;
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + storageKey);
      return tabs.includes(stored as T) ? (stored as T) : fallback;
    } catch {
      return fallback;
    }
  });
  function select(next: T) {
    setTab(next);
    if (mode === "preview") return;
    if (!persist) {
      transientTabSelections.remember(storageKey, next);
      return;
    }
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, next);
    } catch {
      // Private-mode storage failures just lose persistence.
    }
  }
  return [tab, select];
}

/** Card-scale tab switcher. Theme-specific chrome lives in index.css so the
 * same primitive can be a segmented control in glassy themes and a plain tab
 * bar in e-ink. */
export function TabPills<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onSelect: (t: T) => void;
}) {
  return (
    <span className="tab-pills flex w-fit max-w-full items-center font-mono type-ui-2xs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          onClick={() => onSelect(t.id)}
          className={cn("tab-pill cursor-pointer", t.id === active && "tab-pill-active")}
        >
          {t.label}
        </button>
      ))}
    </span>
  );
}
