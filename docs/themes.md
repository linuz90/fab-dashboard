# Themes

Themes are tracked engine features. They are not loaded from `$FAB_DASHBOARD_HOME`, because arbitrary user CSS would make caching, security, and visual debugging much harder. If a theme is generally useful, add it to the repo with docs and tests so it can become a PR.

The public engine default theme is `basic`. It lives in `src/index.css` because its `@theme` block defines the Tailwind token contract. The tracked demo dashboard may choose a different default, currently `e-ink`, without changing the engine default. Other built-in themes live in `src/themes/*.css` and are imported by `src/index.css` into the single app stylesheet. Runtime switching changes `<html data-theme>`; generic dynamic context such as time of day is exposed through separate root attributes.

## Add A Theme

1. Add a definition to `src/shared/themes.ts`.
   Include `id`, `label`, useful command-search `aliases`, `chartStyle`, `frameShape`, and `refreshPalette`.
2. Add `src/themes/<id>.css`.
   Start with token overrides under `:root[data-theme="<id>"]`.
3. Import it from `src/index.css`.
   Use `@import "./themes/<id>.css";` near the existing theme imports.
4. Run validation:

```bash
bun run typecheck
bun run test
bun run build
FAB_DASHBOARD_HOME="$PWD/local/demo" FAB_DASHBOARD_STATE_HOME="$PWD/local/state" bun run cli validate
```

5. Visually check the demo dashboard at desktop and mobile widths.
   Switch through all themes, open command search, open settings, inspect tabs, refresh animation, stale/error labels, header widgets, and the empty dashboard.

## Token Checklist

Every theme should review these tokens before adding component-specific CSS:

- canvas, card, border, foreground, muted, faint
- header foreground, header faint, header border
- success, warning, danger, and their soft fills
- accent
- calendar palette `--color-cal-1` through `--color-cal-6`
- card radius, border width, border color, padding, shadow, backdrop, gap
- focus ring
- layout gap and safe titlebar rhythm when needed

Prefer token-only themes. They are easier to reason about, work across existing and future card blocks, and are less likely to break on small component changes.

Themes can also select behavior traits in `src/shared/themes.ts` when tokens are not enough. `chartStyle` keeps card data semantic (`line` or `bars`) while choosing the shared chart renderer: `smooth` uses vector SVG and `dither` uses a low-resolution ordered-dot canvas. E-ink opts into `dither`; other built-in themes currently use `smooth`. Dither themes can tune dot resolution with the unitless CSS-pixel value `--chart-dither-pixel-size` and fill coverage with the `--chart-dither-density` multiplier.

## Immersive Themes

Immersive themes can use component selectors when tokens are not enough. `classic-macos`, `e-ink`, and `live` are examples:

- `classic-macos` turns card chrome into window chrome.
- `e-ink` changes the header layout, adds a paper texture, and selects dithered charts.
- `live` paints a time-of-day sky behind translucent cards.

Keep these overrides scoped to `:root[data-theme="<id>"]`. Do not add card-specific styling for one private dashboard. If a recurring runtime behavior is needed, add a registry trait in `src/shared/themes.ts` instead of hardcoding theme IDs in React components.

## Dynamic Themes

The theme runtime exposes generic, non-personal environment signals on `<html>` so themes can be dynamic without React branches or theme-specific scripts:

- `data-time-phase`: `dawn`, `morning`, `day`, `dusk`, `twilight`, or `night`
- `data-local-hour`: the local 24-hour clock hour, `0` through `23`

These attributes are set before first paint in `index.html`, refreshed by `src/lib/theme.ts`, and available to every theme. `live` uses them like this:

```css
:root[data-theme="live"][data-time-phase="dusk"] {
  color-scheme: light;
  --live-bg: linear-gradient(180deg, #9c9cc4 0%, #d9a9b0 55%, #f4c391 100%);
}
```

Keep dynamic selectors scoped to a theme id, for example `:root[data-theme="<id>"][data-time-phase="night"]`. If you add or change runtime signals, update `src/lib/theme.ts`, the inline first-paint fallback in `index.html`, and this document together. Do not expose personal data, connector values, or user-specific state as theme attributes.

CSS layer rules:

- Token blocks stay unlayered.
- Overrides that must beat Tailwind utility classes stay unlayered.
- Softer component overrides can use `@layer theme-overrides`; that layer is declared after shared components.

## Dashboard Curation

Dashboards can choose the enabled theme list and order:

```json
{
  "appearance": {
    "defaultTheme": "basic",
    "themes": ["basic", "apple", "live"]
  }
}
```

`appearance.themes` is both allowlist and display order. Omitted themes disappear from dashboard settings and command search, but they remain built into the engine and can be re-enabled by editing `dashboard.json`.

Rules:

- `defaultTheme` is optional.
- `themes` is optional; when omitted, every built-in theme is selectable.
- `themes` must not be empty.
- theme IDs must be known and unique.
- when `defaultTheme` is set with `themes`, it must be included in `themes`.
- a stored browser theme wins while it is still enabled; otherwise the app falls back to the dashboard default.
- first paint can only use a stored built-in theme; dashboard-specific defaults and disabled-theme cleanup happen after config loads.

Legacy stored `claude` values are normalized to `basic`.
