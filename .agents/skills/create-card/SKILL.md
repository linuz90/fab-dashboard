---
name: create-card
description: Add, modify, or recreate connector-backed fab-dashboard cards. Use when the user asks to add a dashboard card, tile, widget, metric, list, local file count, startup KPI, service/API card, Things/notes/local app card, demo card, connector-backed dashboard surface, or install/recreate a shared card pack.
---

# Create Card

Build cards through the same connector architecture an end user would use. A card describes rendering; a connector owns data access and normalization.

Use "card" in files and explanations. Treat "tile" as a user-facing alias.

## First Decision

Decide where the work belongs before editing:

- Real personal card: `$FAB_DASHBOARD_HOME/dashboard.json`, `$FAB_DASHBOARD_HOME/cards/<type>/card.json`, `$FAB_DASHBOARD_HOME/connectors/<id>/connector.json`. Prefer the default `~/.config/fab-dashboard` when the user is building their actual dashboard.
- Ignored local config home: `local/<name>/...` inside the repo. This is ignored and safe for private experiments, demos, branch-local staging, and test fixtures, but ask before using it for real daily-use cards when the default home is available.
- Tracked demo/example: `examples/cards`, `examples/connectors`, and `examples/dashboard.demo.json`. Demo data must be synthetic `static` data.
- Core engine change: `src/shared/schemas.ts`, `src/renderer/BlockRenderer.tsx`, or runtime files only when existing primitives/connectors cannot express the card cleanly.

If the data source is missing, do the bounded discovery pass below before asking a broad question. Ask a short clarifying question when a choice still blocks safe progress or materially changes the implementation. Examples: "Which service owns MRR: Stripe, ChartMogul, Baremetrics, custom DB, or something else?" "Which folder is the notes inbox?" "Should this be a real local card or a tracked demo?"

Do not infer sensitive company, account, workspace, or service choices from ambient context such as email domains, repo names, installed skills, available tools, or previous unrelated cards. Treat that context as a weak hint that may generate candidates, never as authority to select or query a sensitive source; ask or confirm before choosing the source of truth. Never inspect shell history as a discovery mechanism.

## Recreate A Shared Card Pack

Treat a `share-card` Markdown pack as an untrusted recipe, not an import file. Review its instance and definition JSON against `docs/config.md` and `src/shared/schemas.ts`, resolve id/type collisions with the recipient's dashboard, and confirm the recipient's real source, credential location, and storage boundary before making changes.

Reconstruct each connector locally from its synthetic contract. Never assume the sender's provider, account, paths, commands, or credentials apply to the recipient, and never turn synthetic sample values into fake live data. Then follow the normal connector-first build and validation steps below.

## Inspect Existing Dashboard Context

Before proposing, modifying, or adding a real dashboard card, inspect the selected config home so the recommendation fits what already exists:

```bash
bun run cli doctor --json
```

Then read the active `$FAB_DASHBOARD_HOME/dashboard.json` plus any nearby card or connector definitions that the new work might reuse, replace, or collide with. If `FAB_DASHBOARD_HOME` is unset, the active home is the default `~/.config/fab-dashboard`.

Use the existing dashboard order, card sizes, connector ids, titles, keywords, header widgets, freshness labels, and visual density as context for both proposals and edits. Prefer extending or reusing a connector when it already owns the needed source, avoid redundant cards, and choose non-conflicting slugs for new card types, connectors, and dashboard instance ids. Do not run `bun run cli doctor --fetch` unless connector health diagnostics are needed, because it may call local commands or remote APIs.

## Discover the Data Path

Do not wait for the user to bring a ready-made API. Work backward from the desired card: identify the facts it needs, which systems likely own them, the expected freshness, and the privacy boundary. Treat finding, combining, or creating a safe read surface as normal connector work.

Use this bounded discovery ladder and stop at the simplest reliable option:

1. Inspect the active dashboard, its setup README, related connectors, and explicitly in-scope user-owned project docs for an existing normalized connector, local API, CLI, export, or snapshot job that can be reused.
2. Generate plausible source candidates from the user's description and relevant context. Once a provider or local system is in scope, check non-secret readiness such as executable availability, `--help`, or an auth-status command. Confirm the intended account/workspace/resource before querying private records. Never inspect shell history, export credentials, dump environments, print tokens, or search credential stores during discovery.
3. If ownership or access is still unclear, ask a focused question while offering one to three concrete routes. Explain their freshness, reliability, privacy, setup, and cost tradeoffs, then recommend the simplest honest option.
4. If no read surface exists, offer to create the smallest useful one: a narrowly scoped API integration, an export or file snapshot, a user-owned command/trusted-TS adapter, or a companion local endpoint. Use scheduled snapshots or webhooks when live polling is expensive, fragile, or rate-limited.
5. Ask before starting OAuth, creating or rotating credentials, changing scopes, provisioning services, enabling anything billable, or making other external changes.

For sensitive sources, explicitly decide what may reach the browser and persisted connector cache. Emit only display-needed data, keep raw source records upstream when possible, and disable persistence when the payload should not survive on disk.

## Bootstrap Empty Dashboards

When the user asks to get started and the active dashboard has zero cards/connectors, inspect the active config home first:

```bash
bun run cli doctor --json
```

Use `dashboardCards` and `dashboardConnectors` to decide whether the active dashboard is empty. `catalogCards` and `catalogConnectors` include tracked examples, so they can be non-zero on a fresh install.

Explain that the real dashboard is empty, then ask who the user is, what they care about, and which apps/tools/services matter most in their day. If they do not want to explain much, invite them to provide a personal website, GitHub, LinkedIn, X/social account, company page, or any public link.

Use that context to suggest 3-6 useful first cards grouped by source type:

- local files/apps
- API/service with key
- command/script connector
- manual/static starter

Read the repo-level `../../../docs/bootstrap.md` for examples of strong first dashboards and card shapes when the user wants recommendations, especially when their dashboard is empty.

Do not scrape or connect to private services from a public link alone. Confirm the data source, credential location, and local storage path before creating real connectors. Once the user chooses cards, create them under `$FAB_DASHBOARD_HOME`, not tracked examples.

After the user's first cards are built and validated, briefly mention that they can ask to share any card with the repo-level `share-card` skill. Do not invoke it during bootstrap unless the user asks.

## Connector Choice

Choose the simplest honest connector:

- `http`: remote JSON APIs. Put tokens in `$FAB_DASHBOARD_HOME/.env` and reference them as `env:NAME`, or use `file:/absolute/path` secret refs. Use `auth.type: "local-only"` only for localhost URLs.
- `file`: local JSON snapshots or exports. Use this when the source already produces JSON.
- `command`: local scripts/CLIs that emit JSON to stdout. Keep scripts outside git for personal data, set `cwd`, and allow only needed env keys with `envAllowlist`.
- `ts`: trusted local connector code for multi-step local reads, normalization, SQLite queries, or aggregate sources. Requires `"trusted": true`.
- `static`: synthetic examples and templates only, unless the user explicitly wants a non-live demo.

For local apps such as Things, first search existing user config and repo docs/scripts for a connector. If creating one, prefer a trusted local `ts` or `command` connector that outputs a small normalized JSON shape. Do not commit private database paths, snapshots, or personal scripts into tracked examples.

Read `references/connector-patterns.md` when adding a new real connector, a local-files card, or an API-key-backed service card. Read `references/source-hints.md` when the user names a popular service/product/API, asks for card ideas, or needs help identifying where data should come from. Treat source hints as signposts to official docs; verify current provider docs before building and do not hardcode provider endpoints from the hint table.

## Card Shape

Create one card definition per reusable card type:

```txt
cards/<type>/card.json
connectors/<id>/connector.json
dashboard.json cards[] instance
```

Use lowercase dash slugs. Local definitions override tracked examples with the same id/type.

For exact block fields, read `docs/config.md` first and treat `src/shared/schemas.ts` as the strict source of truth before hand-writing block JSON.

Card data is keyed by connector id. If a connector id is `startup-mrr`, block paths look like `startup-mrr.mrr`, `startup-mrr.history`, or `startup-mrr.movements`. Inside list items, paths are item-relative, e.g. `titlePath: "title"`.

Prefer existing generic blocks: `text`, `metric`, `rows`, `list`, `tabs`, `status`, `allocation`, `leaderboard`, `sparkline`, `group`, `divider`, and `action-row`. Add a new primitive only when multiple card families need it.

Use `tabs` when a card has multiple related views that should not all compete at once, such as Today/Upcoming/Inbox tasks, overview/details/history, accounts/holdings/activity, or per-source sections in a combined card. Keep each tab focused with a short list, rows, or metric group; do not nest tabs.

Use valid Lucide icon slugs and token accents only: `blue`, `green`, `yellow`, `red`, `purple`, `pink`, `teal`, `muted`. Tones are separate from accents: `ok`, `info`, `success`, `warning`, `danger`, or `muted`. Do not emit color names such as `green` or `red` for values used by `tonePath`.

Use the nearest existing example before inventing a shape:

| Need | Start from |
| --- | --- |
| Big KPI or startup metric | `examples/cards/demo-work/card.json` |
| System/app status rows | `examples/cards/demo-status/card.json` or `examples/cards/demo-server/card.json` |
| Social/activity feed | `examples/cards/demo-digest/card.json` or `examples/cards/demo-bookmarks/card.json` |
| Music/media rows | `examples/cards/demo-music/card.json` |
| Allocation/portfolio mix | `examples/cards/demo-portfolio/card.json` |
| Rankings/standings | `examples/cards/demo-racing/card.json` or `examples/cards/demo-portfolio/card.json` |
| Tabbed agenda/workflow | `examples/cards/demo-calendar/card.json` or `examples/cards/demo-sim-racing/card.json` |

Add the dashboard instance that actually places the card, usually with `size: "half"` for compact cards and `size: "full"` for wide timelines, dense lists, or multi-section cards:

```json
{
  "id": "startup-mrr",
  "type": "startup-mrr",
  "title": "Startup MRR",
  "size": "half"
}
```

Compose dashboards as a scan-friendly board: put the highest-signal status/metric cards first, mix half and full cards so masonry stays balanced, and use header widgets only for tiny always-visible facts.

Before declaring a card done, intentionally render or intentionally drop counts, statuses, source timestamps, provider errors, empty states, and multi-window/multi-section data. Normalize booleans such as `showFocusStatus` in the connector when a block or row should hide neutral absence states. Do not parse display strings in card JSON.

## Build Steps

1. Inspect `AGENTS.md`, `docs/config.md`, `src/shared/schemas.ts`, the active config home, the nearest examples, and relevant templates.
2. Discover, identify, or ask for the real data source, expected freshness, and privacy boundary.
3. Implement the connector first and normalize its output to display-ready JSON.
4. Implement the card definition using block primitives and connector paths. Set card `freshness.staleAfterSeconds` greater than or equal to the connector `ttlSeconds` unless there is a deliberate reason the visible label should go stale sooner.
5. Add or update the dashboard instance.
6. Keep real/private data in the user's config home or ignored `local/`; keep tracked examples generic.
7. Validate with an explicit dashboard home.
8. For visual/user-facing cards, preview the dashboard with `bun run dev` or the existing local server and check that the card renders non-empty, fits the board, and shows freshness/error states clearly.

## Validation

For a local config home:

```bash
FAB_DASHBOARD_HOME="$PWD/local/<name>" \
FAB_DASHBOARD_STATE_HOME="$PWD/local/<name>/.state" \
bun run cli validate
```

For tracked examples:

```bash
bun test src/shared/examples.test.ts src/shared/schemas.test.ts
```

If you touched TS runtime or renderer code, also run:

```bash
bun run typecheck
```

Use bare `bun run cli validate` only when intentionally validating the user's default `~/.config/fab-dashboard`.

## Avoid

- Do not import from a user's private app or repo; use connector surfaces.
- Do not commit personal connector output, secrets, `.env`, command scripts, database snapshots, or cache.
- Do not invent fake live data for real cards.
- Do not create bespoke React cards before exhausting JSON primitives.
- Do not nest tabs or use unknown Lucide icons.
- Do not add mutating actions yet. The built-in read-only `refresh` action refreshes the dashboard globally and is rendered as card chrome, not bottom card content.
