# Configuration

Every tracked or local JSON file uses `schemaVersion: 1`.

`dashboard.json` answers: what is on my dashboard?

```json
{
  "schemaVersion": 1,
  "title": "fab-dashboard",
  "refreshSeconds": 30,
  "appearance": {
    "defaultTheme": "basic",
    "themes": ["basic", "apple", "live"],
    "layout": {
      "width": "extra-large",
      "maxColumns": 4
    }
  },
  "header": {
    "widgets": [
      { "id": "weather", "kind": "weather", "connector": "demo-system", "path": "demo-system.weather" },
      { "id": "focus", "kind": "label", "connector": "demo-system", "icon": "moon", "labelPath": "demo-system.focus" }
    ]
  },
  "cards": [
    {
      "id": "status",
      "type": "demo-status",
      "title": "Status",
      "size": "half",
      "keywords": ["health"],
      "options": {}
    }
  ]
}
```

`cards/<type>/card.json` answers: how does this kind of card render?

`connectors/<id>/connector.json` answers: where does this data come from?

Supported connector kinds in v0: `static`, `file`, `http`, `command`, and trusted local `ts`.

Secret references are strings such as `env:OPENWEATHER_API_KEY` or `file:/absolute/path`. The runtime loads `$FAB_DASHBOARD_HOME/.env` after the config home is selected, without overriding already-exported environment variables. Put local API keys there or in separate secret files; templates and examples must never contain real secrets.

The tracked `examples/connectors/*` fixtures are safe `static` connectors. They are useful for visual parity and schema coverage, but they are not live personal data. Put real local connectors in your dashboard home instead, usually `~/.config/fab-dashboard/connectors`.

Freshness metadata controls the visible source label. `freshness.label` is shown as `source · age` when the connector has fetched data. `freshness.staleAfterSeconds` can make that visible label use stale tone even when the connector itself has no TTL.

Use `bun run cli doctor --json` to inspect the active config home. `dashboardCards` and `dashboardConnectors` describe the current `dashboard.json`; `catalogCards` and `catalogConnectors` include local plus tracked example definitions. Use `bun run cli doctor --fetch --json` for opt-in connector health diagnostics. Fetch diagnostics touch only active dashboard connectors, but they may call local commands, local TypeScript connectors, or remote APIs.

## Appearance

`dashboard.appearance` controls dashboard theme defaults, theme curation, and layout preferences:

```json
{
  "appearance": {
    "defaultTheme": "basic",
    "themes": ["basic", "apple", "live"],
    "layout": {
      "width": "extra-large",
      "maxColumns": 4
    }
  }
}
```

`defaultTheme` is applied after dashboard config loads when there is no valid stored browser selection. `themes` is the exact enabled theme list and display order for dashboard settings and command search. Omit `themes` to enable every built-in theme.

Unknown theme IDs, duplicate IDs, an empty `themes` list, or a `defaultTheme` that is not included in `themes` fail validation. See [themes](themes.md) for the theme authoring workflow.

`layout.width` is a named max-width preset: `small` = 960px, `medium` = 1200px, `large` = 1400px, and `extra-large` = 1680px. Omit it to use `large`, which preserves the original dashboard width.

`layout.maxColumns` accepts `1` through `4` and acts as a cap, not a forced count. The masonry renderer still uses the available container width, so mobile and narrow layouts collapse to fewer columns when needed. Omit it to use `3`.

The reusable engine default is `basic`; the tracked demo dashboard intentionally starts with `e-ink` to make the public example and README screenshot distinctive.

## Header Widgets

`dashboard.header.widgets` renders tiny connector-backed items next to the header clock/date. Header widgets are intentionally smaller than card blocks: they must fit in a single row and should never become mini-cards.

Supported widget kinds:

- `label`: generic Lucide icon plus a static `label` or connector-backed `labelPath`. Optional `tooltip`/`tooltipPath`, `tone`/`tonePath`, and `hrefPath` add detail without expanding the header.
- `weather`: a weather-shaped object read from `path`, with `{ place, tempC, code, isDay, hiC, loC }`. The renderer maps WMO `code` values to Lucide weather icons and formats the tooltip.

Widget paths are resolved against connector ids, like card blocks. For example, a widget with `"connector": "demo-system"` can read `"demo-system.focus"` or `"demo-system.weather"`.

Set `staleAfterSeconds` when a widget rides a fast-refresh aggregate connector but the tiny header value should not look stale immediately.

## Card Visuals

Cards can declare small visual metadata without leaving the JSON model:

```json
{
  "schemaVersion": 1,
  "type": "health",
  "visual": { "icon": "activity", "accent": "green" },
  "blocks": [{ "type": "text", "path": "health.summary" }]
}
```

`visual.icon` accepts any Lucide icon slug shipped by the installed `lucide-react` package, such as `activity`, `calendar-days`, `refresh-cw`, or `message-square`. Unknown icon names fail schema validation. `visual.accent` is a token, not a CSS value: `blue`, `green`, `yellow`, `red`, `purple`, `pink`, `teal`, or `muted`.

## Card Blocks

The renderer intentionally keeps a small block catalog and stretches those primitives for dense dashboard cards.

Common blocks:

- `text`: static text or a value from `path`, with `title`, `body`, `muted`, `mono`, or `caption` variants.
- `metric`: large value, optional unit, delta, sparkline, static `tone` or dynamic `tonePath`, and `pill` or `pillPath`.
- `rows`: compact label/value rows with optional Lucide `icon`, `hint`/`hintPath`, `valueTonePath`, `valueVariant: "badge"`, `progressPath`, and tiny `sparklinePath`.
- `list`: repeated items from `path`; supports `plain`, `check`, `timeline`, `feed`, and `media` variants, plus optional `density: "compact"` for tighter repeated surfaces. Compact density is currently optimized for feed-style lists.
- `allocation`: stacked percentage bar plus keyed allocation rows. Use this for portfolio/category mixes where the row value is both a number and a visual share.
- `leaderboard`: ranked rows with optional subtitle, value, delta, palette key, and progress bar. Use this for standings, holdings, or any compact ordered table.
- `status`, `sparkline`, `group`, `tabs`, `divider`, and `action-row`.

`tabs.defaultTab` selects the initial tab, falling back to the first tab if needed. With `persist: true`, normal dashboard renders restore and save the active tab per card. With `persist: false`, a page load starts from `defaultTab`; tab changes survive card remounts and data refreshes for that page lifetime, but reset on reload. Inert card previews always start from `defaultTab` and never read or write either form of dashboard selection state.

`list` paths are item-relative. For example, `path: "feed.items"` plus `titlePath: "title"` reads `feed.items[].title`, not `feed.items[].feed.items.title`.

List item links from `hrefPath` are sanitized with `safeHref`. External `http` and `https` links open in a new tab so the dashboard keeps running in place.

Variant-specific list fields are optional:

- `check`: `checkedPath`, `mutedPath`, `sectionPath`, `metaPath`, and `textPath`.
- `timeline`: `sectionPath`, `tonePath`, `icon`/`iconPath`, `metaPath`, and `textPath`.
- `feed`: `icon`/`iconPath`/`fallbackIcon`, `tonePath`, `chipsPath`, `countPath`, `countIcon`, and `progressPath`.
- `media`: `imagePath`, `fallbackIcon`, `metaPath`, `textPath`, and `progressPath`.

Media URLs from `imagePath` are sanitized like links but stricter: only `http:`, `https:`, and relative URLs are rendered. `mailto:`, `data:`, `file:`, and app-specific protocols are ignored. Broken images fall back to the configured icon.

`status` and `rows` values can use `valueVariant: "badge"` for compact state labels such as `online`, `synced`, or `ready`. Use `valueTonePath` for the badge tone and keep separate metadata, such as a model name or host, in its own row instead of joining unrelated facts into one value.

`visibleWhen` can be attached to any block, and to individual `rows.rows[]` items, to hide neutral or absent states without leaving layout gaps:

```json
{
  "type": "status",
  "label": "Focus",
  "valuePath": "system.focus",
  "messagePath": "system.summary",
  "visibleWhen": { "path": "system.showFocusStatus", "equals": true }
}
```

The condition shape is intentionally small: `path`, optional `equals`, and optional `exists`. A path-only condition follows normal truthiness, while `exists: true` keeps meaningful values such as `0`. Prefer connector-normalized booleans such as `showFocusStatus` over parsing display strings like `"0%"`.

`action-row` can render compact icon buttons for future registered read-only actions. The built-in `refresh` action is promoted to card chrome and labeled `Refresh dashboard`; refresh-only action rows are not rendered as card content. Unknown action ids render disabled until a later action API exists.

The `label` remains required and is used for the button title and accessible name when an action is rendered.

## Trust Model

`static` and simple `http` connectors are shareable config when they do not embed secrets. `file`, `command`, and `ts` connectors are trusted local capabilities:

- `file` can read JSON files visible to the dashboard process.
- `command` runs a local command with a minimal environment plus the manifest `envAllowlist`.
- `ts` imports trusted local code and requires `"trusted": true`.

`http.auth.type: "local-only"` is enforced as a localhost-only connector URL. Use it for companion services on `localhost`, `127.0.0.1`, or `::1`; use `bearer` or `header` secret references for non-local APIs.

## Actions

Action blocks carry capability metadata (`readOnly`, `mutating`, `destructive`) so cards can declare intent early. In v0 the renderer only enables registered `readOnly` actions. The built-in `refresh` action refetches the dashboard view; it does not bypass connector TTLs, run arbitrary mutating endpoints, or refresh only one card.

Real mutating/destructive actions need a later action API with confirmations, local-only mode checks, and CSRF/origin protection.

## Dashboard Config Mutations

The settings modal can make narrow local edits to the active `dashboard.json`:

- Card order uses `POST /api/dashboard/cards/reorder` with `{ "baseOrder": string[], "order": string[] }`; the server validates that both arrays match the current card ids, then atomically rewrites the raw card objects in the requested order without serializing schema defaults back into the file.
- Layout uses `POST /api/dashboard/appearance/layout` with `{ "baseLayout": Layout, "layout": Layout }`, where each `Layout` is `{ "width"?: "small" | "medium" | "large" | "extra-large", "maxColumns"?: 1 | 2 | 3 | 4 }`; the server verifies `baseLayout` still matches the current file, updates only `appearance.layout`, and prunes default layout values back out of the file.

These endpoints are intentionally separate from card `action-row` actions. They are enabled only for local dashboard requests, require a dashboard mutation header, use origin/fetch-site checks, and reject stale writes with `409` when the file changed before the save. Dashboards served from non-local hosts remain read-only. A localhost-bound dashboard may explicitly trust exact private proxy origins with `FAB_DASHBOARD_TRUSTED_CONFIG_ORIGINS`, primarily for Tailscale Serve; do not use that for Tailscale Funnel or unauthenticated public reverse proxies.
