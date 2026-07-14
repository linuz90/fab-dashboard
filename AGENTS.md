# fab-dashboard

fab-dashboard is a personal dashboard engine for agent-built, connector-backed home screens. Users clone this public repo, run Codex or Claude inside it, and ask the agent to assemble a dashboard from their own apps, APIs, files, scripts, and local services.

Treat this repo as the reusable engine and agent playbook, not as the user's private dashboard. Tracked code should stay generic: React UI, block primitives, schemas, connector/runtime behavior, docs, safe examples, themes, service/PWA assets, and skills. Real personal dashboard files and source data belong outside this public engine repo, usually in `$FAB_DASHBOARD_HOME` or another user-owned location, and should only flow through explicit user-owned connector surfaces such as HTTP, file, command, static fixture, or trusted local TypeScript connector manifests.

The app is a standalone Bun + Vite React project. Keep implementation connector-first, local-first, and friendly to future agents who will read this file before changing either the public engine or a user's private dashboard.

Use **card** as the product/data-model term. If a user says "tile" or "widget", translate it to card in implementation and docs unless you are quoting them.

## Commands

```bash
bun install
bun run dev          # starts at API :7893 + Vite :5193; advances if busy
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

Read or update this note when the active card or service workflow calls for it. Keep secrets and tokens out of the note; reference secret locations such as `$FAB_DASHBOARD_HOME/.env` instead.

## Public Repo Boundary

This repository is the public, reusable dashboard engine. Agents may edit tracked repo files when the user asks for behavior that benefits the engine or other users: new generic block primitives, connector kinds, schema/runtime improvements, validation, docs, safe templates, or safe public-demo examples suitable for a PR.

Keep user-specific dashboards in `$FAB_DASHBOARD_HOME`, not in tracked files. Do not change repo source just to add a private card unless the card reveals a reusable engine capability that is missing. When making reusable repo changes, keep them generic and add docs/examples/tests as appropriate. Tracked demo data must be reproducible, safe to screenshot, and free of private account data, secrets, local paths, personal snapshots, or sensitive user details. Public, recognizable references are okay when they make examples easier to understand.

## Card Workflows

- Use `.agents/skills/create-card` when creating or modifying cards, helping with an empty dashboard, or recreating a shared card pack. It owns data-source discovery, privacy boundaries, config placement, connector design, and validation. Read [docs/bootstrap.md](docs/bootstrap.md) and [docs/config.md](docs/config.md) when that skill directs you to them.
- Use `.agents/skills/share-card` when sharing one or more cards. It owns sanitization, the portable card-pack structure, and approval before clipboard, file, gist, or other delivery.
- Use **card** in implementation and docs. Treat "tile" and "widget" as user-facing aliases.

Keep `AGENTS.md` at this routing level. Detailed card procedures belong in the skills and their referenced docs.

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
- Keep command-lens card selection two-stage when multiple results remain: first confirm the selected card and show its exact inert preview; selecting the sole card closes, scrolls, and visibly identifies the dashboard card. Preview rendering must stay side-effect-free through `CardInteractionModeProvider mode="preview"`.
- Prefer generic block primitives over bespoke card components. Current composable primitives include `text`, `metric`, `rows`, `list`, `tabs`, `status`, `allocation`, `leaderboard`, `sparkline`, `group`, `divider`, and `action-row`; add a primitive only when it can serve multiple cards or connectors.
- Use valid Lucide slugs for card, block, and header-widget icons. Unknown icon names intentionally fail schema validation.
- Validate local config homes with explicit homes, for example `FAB_DASHBOARD_HOME="$PWD/local/demo" FAB_DASHBOARD_STATE_HOME="$PWD/local/state" bun run cli validate`. Use bare `bun run cli validate` only when you intend to validate the user's default `~/.config/fab-dashboard`.
