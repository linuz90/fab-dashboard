import { Check } from "lucide-react";
import { useId, useMemo } from "react";
import { cn } from "../lib/cn";
import { useTheme } from "../lib/theme";
import { resolveDefaultTheme, resolveSelectableThemes, themeLabel, type ThemeAppearanceInput } from "../shared/themes";

export function DashboardThemeSettingsSection({ appearance }: { appearance?: ThemeAppearanceInput | null }) {
  const [theme, setTheme] = useTheme();
  const themes = useMemo(() => resolveSelectableThemes(appearance), [appearance]);
  const visibleTheme = themes.includes(theme) ? theme : resolveDefaultTheme(appearance);
  const groupName = useId();

  return (
    <section className="border-b-[0.5px] border-border pb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="type-ui-2xs font-medium uppercase tracking-ui-caps text-faint">Theme</h3>
        <span className="font-mono type-ui-xs text-faint">this browser</span>
      </div>
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {themes.map((option) => {
            const active = option === visibleTheme;
            return (
              <label key={option} className="cursor-pointer">
                <input
                  type="radio"
                  name={groupName}
                  value={option}
                  checked={active}
                  onChange={() => setTheme(option)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "dashboard-theme-option flex min-h-8 items-center justify-between gap-3 rounded-lg border border-border bg-canvas/35 px-2.5 py-2 font-mono type-ui-xs text-muted transition-colors",
                    "hover:bg-fg/[0.04] hover:text-fg",
                    "peer-focus-visible:outline peer-focus-visible:outline-[var(--focus-ring-width)] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring-color)]",
                    active && "border-fg/20 bg-fg/[0.06] text-fg"
                  )}
                >
                  {themeLabel(option)}
                  <Check className={cn("size-3.5 shrink-0", !active && "invisible")} aria-hidden="true" />
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
