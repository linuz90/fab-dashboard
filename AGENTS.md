# fab-dashboard

fab-dashboard is a personal dashboard engine for agent-built, connector-backed home screens. Users clone this public repo, run Codex or Claude inside it, and ask the agent to assemble a dashboard from their own apps, APIs, files, scripts, and local services.

Treat this repo as the reusable engine and agent playbook, not as the user's private dashboard. Tracked code should stay generic: React UI, block primitives, schemas, connector/runtime behavior, docs, safe examples, themes, service/PWA assets, and skills. Real personal dashboard files and source data belong outside this public engine repo, usually in `$FAB_DASHBOARD_HOME` or another user-owned location, and should only flow through explicit user-owned connector surfaces such as HTTP, file, command, static fixture, or trusted local TypeScript connector manifests.

The app is a standalone Bun + Vite React project. Keep implementation connector-first, local-first, and friendly to future agents who will read this file before changing either the public engine or a user's private dashboard.

Use **card** as the product/data-model term. If a user says "tile" or "widget", translate it to card in implementation and docs unless you are quoting them.

## Commands

```bash
bun install
bun run dev          # API on :7893 + Vite on :5193
bun run start        # serve built app + API on :7893
bun run build
bun run typecheck
bun run test
bun run cli validate
bun run cli doctor --json
bun run cli init --demo
bun run cli service print <macos|systemd>
```

The default app home is `~/.config/fab-dashboard`; state/cache defaults to `~/.local/state/fab-dashboard`. Override with `FAB_DASHBOARD_HOME` and `FAB_DASHBOARD_STATE_HOME` for development and tests.

`CLAUDE.md` should remain a symlink to this file so Codex and Claude read the same repo instructions.

## Managed Worktrees

Codex and Claude worktrees share this repo contract. Fresh managed worktrees run `./workspace-setup.sh init`, which reapplies narrow `.worktreeinclude` files and installs dependencies.

Keep `.worktreeinclude` limited to useful ignored local config such as `.env`, `.env.*`, and `.claude/settings.local.json`. Do not add `local/`, cache, snapshots, generated connector data, or anything that could contain personal dashboard data. `CLAUDE.md` should stay symlinked to `AGENTS.md`.

## Local Data Boundary

Tracked: engine source, schemas, docs, templates, safe examples, demo cards/connectors, and PWA assets.

Ignored/outside repo: user `dashboard.json`, user cards/connectors, `.env`, secrets, command scripts, fixtures with personal data, cache, history, and snapshots.

Use `local/` only for temporary development homes, demos, branch-local staging, or test fixtures. It is ignored by design, but it is not the default place for a user's real dashboard when `~/.config/fab-dashboard` is available.

## Local Setup Note

Agents should treat `$FAB_DASHBOARD_HOME/README.md` as the user's private operating note for this dashboard. It is outside the public repo and may describe how the dashboard is served, which service manager owns it, Tailscale/private URLs, non-secret environment variable names, restart commands, companion local APIs, and refresh jobs that feed connectors.

When inspecting a real dashboard, run `bun run cli doctor --json` and read `setupReadme` if `setupReadmeExists` is true. When creating or changing a service, Tailscale Serve setup, trusted origin, local companion API, refresh job, or important local path, create or update this note. Keep secrets and tokens out of it; reference secret locations such as `$FAB_DASHBOARD_HOME/.env` instead.

## Public Repo Boundary

This repository is the public, reusable dashboard engine. Agents may edit tracked repo files when the user asks for behavior that benefits the engine or other users: new generic block primitives, connector kinds, schema/runtime improvements, validation, docs, safe templates, or safe public-demo examples suitable for a PR.

Keep user-specific dashboards in `$FAB_DASHBOARD_HOME`, not in tracked files. Do not change repo source just to add a private card unless the card reveals a reusable engine capability that is missing. When making reusable repo changes, keep them generic and add docs/examples/tests as appropriate. Tracked demo data must be reproducible, safe to screenshot, and free of private account data, secrets, local paths, personal snapshots, or sensitive user details. Public, recognizable references are okay when they make examples easier to understand.

## Card + Connector Workflow

When adding or modifying a card, use `.agents/skills/create-card` and read [docs/config.md](docs/config.md) for schema/block details. If a user says "tile" or "widget", translate that to card terminology.

Before proposing or changing a real dashboard card, inspect the active config home with `bun run cli doctor --json`, then read the active `$FAB_DASHBOARD_HOME/dashboard.json` and relevant existing card/connector definitions. Preserve layout/order, visual density, header widgets, connector reuse, and id/type uniqueness. Use `bun run cli doctor --fetch` only when connector health diagnostics are needed, because it may call local commands or remote APIs.

Also read the local setup note reported by `doctor --json` when it exists, especially before adding cards that depend on companion services, scheduled snapshots, command connectors, or private APIs.

Every real card should have a connector and live under `$FAB_DASHBOARD_HOME`, usually `~/.config/fab-dashboard`. Ask/confirm unclear data sources, credentials, and local paths; do not infer sensitive company/account/service choices from ambient context. Do not hardcode personal/live values in card JSON, commit secrets or private scripts, or add repo source just for a private card unless the card reveals a missing reusable engine capability.

## Empty Dashboard Bootstrap

When the user asks for help getting started, inspect the explicit or default config home first, for example with `bun run cli doctor --json`. Use `dashboardCards` and `dashboardConnectors` for the bootstrap decision; `catalogCards` and `catalogConnectors` include tracked examples and do not mean the user's dashboard has content.

If the active dashboard is empty, read [docs/bootstrap.md](docs/bootstrap.md), then ask who the user is, what they care about, and which apps/tools/services matter most in their day. Suggest 3-6 concrete starter cards grouped by source type, confirm data sources and credential/storage locations, and build only the cards the user chooses. Do not add personal starter cards, private scripts, or live data to tracked examples.

## Serving + PWA Workflow

When the user asks to access the dashboard from other devices, install it on mobile, make it a PWA, or serve it over a nice private URL, prefer Tailscale Serve as the default recommendation. It is a strong fit for this project because it gives the local dashboard an HTTPS tailnet URL without making it public to the internet; Tailscale's Personal plan is free for individual/home use, but confirm the user's plan/constraints for business or team use.

- Keep `FAB_DASHBOARD_HOST=127.0.0.1` unless the user explicitly needs another bind address. Tailscale Serve can proxy the local port, so binding to all interfaces is usually unnecessary.
- If the tailnet URL is used in a browser, include its hostname in `FAB_DASHBOARD_ALLOWED_HOSTS`, for example `localhost,127.0.0.1,example.tailnet.ts.net`. Set `FAB_DASHBOARD_PUBLIC_ORIGIN` when documenting or configuring a known public/tailnet origin.
- If the user wants in-browser settings writes through a private Tailscale Serve URL, set `FAB_DASHBOARD_TRUSTED_CONFIG_ORIGINS` to the exact origin, for example `https://example.tailnet.ts.net`, while keeping the dashboard bound to localhost. Do not enable trusted config origins for Tailscale Funnel or unauthenticated public proxies.
- Use `bun run cli service print macos` or `bun run cli service print systemd` for background service templates, then adapt environment variables in the user's untracked service configuration.
- Create or update `$FAB_DASHBOARD_HOME/README.md` after configuring a background service, Tailscale Serve, trusted config origin, or companion local API so future agents can see what is already running.
- Point users to [docs/service.md](docs/service.md) for the current serving workflow and host/origin guardrails.
- Treat Tailscale Funnel, public reverse proxies, and non-local binds as explicit public-exposure choices. Ask before enabling them, and remind the user that fab-dashboard is not a multi-user auth system; keep remote setups private/read-only whenever possible.
- The app ships PWA assets in tracked files. For mobile installation, prefer an HTTPS Tailscale Serve URL; localhost development URLs are for local desktop iteration.

## Theme Workflow

Themes are tracked engine features, not private dashboard data. When a user asks to add, disable, reorder, or make a dynamic theme, read [docs/themes.md](docs/themes.md), then inspect `src/shared/themes.ts`, `src/themes/`, `src/index.css`, and the active dashboard `appearance` config before changing behavior.

Keep `basic` as the public default/base theme; legacy stored `claude` values normalize to `basic`. Prefer token-only themes, do not load arbitrary CSS from `$FAB_DASHBOARD_HOME`, preserve `dashboard.appearance.themes` as the exact enabled theme list/order, and use generic runtime attributes such as `data-time-phase` or `data-local-hour` instead of card-specific or connector-specific theme styling.

## Layout Workflow

Dashboard layout preferences are tracked engine features under `dashboard.appearance.layout`, not arbitrary user CSS. When changing layout width or masonry column behavior, inspect `src/shared/layout.ts`, `src/components/Masonry.tsx`, `src/App.tsx`, `src/components/DashboardSettings*.tsx`, `src/server/configActions.ts`, `src/server/actionRoute.ts`, and `docs/config.md` together.

- Keep width customization preset-based. Do not add arbitrary CSS lengths or user-supplied style strings to `dashboard.json`.
- Keep `large` as the default 1400px shell and `maxColumns: 3` as the default masonry cap. Resolve omitted layout config at call sites instead of serializing defaults into user config.
- Masonry columns must be container-aware, not viewport-only, because width presets can intentionally narrow the dashboard on wide screens.
- Settings writes for layout use the same local/private config mutation boundary as card reordering. Keep endpoint writes narrow, validate before and after, preserve raw unrelated JSON, and prune default layout values where possible.

## Implementation Notes

- Keep dashboard/card/connector JSON strict and versioned with `schemaVersion`.
- Unknown card types should render inline card errors instead of blanking the page.
- Invalid dashboard config should keep the last-known-good config running when the server already has one.
- Connector errors must be redacted and scoped to that connector/card; one broken connector should not blank the whole dashboard.
- Keep visual primitives token-driven through `src/index.css`; avoid hardcoded colors in React components.
- Preserve the existing dashboard visual language: small dense type, tokenized card chrome, height-balanced masonry, theme selector, command lens, and visible freshness/stale/error states.
- Prefer generic block primitives over bespoke card components. Current composable primitives include `text`, `metric`, `rows`, `list`, `tabs`, `status`, `allocation`, `leaderboard`, `sparkline`, `group`, `divider`, and `action-row`; add a primitive only when it can serve multiple cards or connectors.
- Use valid Lucide slugs for card, block, and header-widget icons. Unknown icon names intentionally fail schema validation.
- Validate local config homes with explicit homes, for example `FAB_DASHBOARD_HOME="$PWD/local/demo" FAB_DASHBOARD_STATE_HOME="$PWD/local/state" bun run cli validate`. Use bare `bun run cli validate` only when you intend to validate the user's default `~/.config/fab-dashboard`.
