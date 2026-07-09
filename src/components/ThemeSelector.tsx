import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { useTheme } from "../lib/theme";
import { resolveDefaultTheme, resolveSelectableThemes, themeLabel, type ThemeAppearanceInput, type ThemeId } from "../shared/themes";

/** Header theme picker: a minimal pill showing the current theme that opens a
 * small dropdown of all themes. The trigger uses the header-* tokens so it stays
 * legible over the live theme's bright sky; the menu panel uses card tokens
 * (frosted via backdrop-blur, a no-op on the opaque-card themes) so it reads on
 * every theme. Self-contained rather than a menu library — one control, and the
 * supply-chain rules make a new dep costly. */
export function ThemeSelector({ appearance }: { appearance?: ThemeAppearanceInput | null }) {
  const [theme, setTheme] = useTheme();
  const themes = useMemo(() => resolveSelectableThemes(appearance), [appearance]);
  const visibleTheme = themes.includes(theme) ? theme : resolveDefaultTheme(appearance);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // While open: close on outside pointer / Escape, and land focus on the
  // active item so the menu is keyboard-drivable.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    items?.[themes.indexOf(visibleTheme)]?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, themes, visibleTheme]);

  function pick(t: ThemeId) {
    setTheme(t);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Arrow keys cycle through items; the buttons themselves handle Enter/Space.
  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
    items[(next + items.length) % items.length]?.focus();
  }

  return (
    <div ref={rootRef} className="theme-selector relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${themeLabel(visibleTheme)}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-header-border pl-2.5 pr-1.5 font-mono type-ui-2xs text-header-faint transition-colors hover:text-header-fg"
      >
        {themeLabel(visibleTheme)}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-[60] mt-1.5 min-w-[10rem] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg backdrop-blur-xl"
        >
          {themes.map((t) => {
            const active = t === theme;
            return (
              <button
                key={t}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => pick(t)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 font-mono type-ui-xs transition-colors",
                  active ? "text-fg" : "text-muted hover:bg-fg/[0.06] hover:text-fg"
                )}
              >
                {themeLabel(t)}
                {active && <Check className="size-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
