import { useState } from "react";
import { useCardInteractionMode } from "./CardInteractionMode";
import { cn } from "../lib/cn";

const STORAGE_PREFIX = "dashboard:tab:";

/** Active tab persisted per card in localStorage, same pattern as
 * CollapsibleSection. Falls back to the first tab on bad stored values. */
export function useStoredTab<T extends string>(storageKey: string, tabs: readonly T[]): [T, (t: T) => void] {
  const mode = useCardInteractionMode();
  const [tab, setTab] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + storageKey);
      return tabs.includes(stored as T) ? (stored as T) : tabs[0]!;
    } catch {
      return tabs[0]!;
    }
  });
  function select(next: T) {
    setTab(next);
    if (mode === "preview") return;
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
