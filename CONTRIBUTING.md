# Contributing

Thanks for helping make fab-dashboard better. This repo is the reusable engine; personal dashboards and private connector data should stay in your local config home.

## Setup

```bash
bun install
export FAB_DASHBOARD_HOME="$PWD/local/demo"
export FAB_DASHBOARD_STATE_HOME="$PWD/local/state"
bun run cli init --demo --force
bun run dev
```

Open the Vite URL printed by `bun run dev` (normally `http://127.0.0.1:5193`).

## What Belongs In The Repo

Good public contributions include:

- generic card block primitives
- connector kinds and runtime improvements
- schema validation and migrations
- built-in themes
- docs, templates, and safe examples
- tests for reusable behavior

Keep these out of git:

- real `~/.config/fab-dashboard` dashboards
- API keys, tokens, account ids, and private endpoints
- command scripts that expose personal data
- connector caches, snapshots, history, or exports
- screenshots containing private cards

If a private card needs a missing engine feature, contribute the generic feature plus a safe example.

## Validation

Use the smallest useful checks for the change:

```bash
bun run typecheck
bun run test
FAB_DASHBOARD_HOME="$PWD/local/demo" FAB_DASHBOARD_STATE_HOME="$PWD/local/state" bun run cli init --demo --force
FAB_DASHBOARD_HOME="$PWD/local/demo" FAB_DASHBOARD_STATE_HOME="$PWD/local/state" bun run cli validate
```

Run `bun run build` for broad UI/runtime changes.

## Public Screenshots

README screenshots must come from the safe demo dashboard, not a real local dashboard. Public, recognizable references are fine; private account data is not.

Regenerate the main screenshot from a validated demo home:

```bash
export FAB_DASHBOARD_HOME="$PWD/local/demo"
export FAB_DASHBOARD_STATE_HOME="$PWD/local/state"
bun run cli init --demo --force
bun run cli validate
bun run dev
```

Open the printed Vite URL, switch to the intended theme if needed, and save the screenshot under `docs/assets/`. Before committing, confirm the image does not show private cards, personal locations, real account data, API keys, local file paths, or browser UI from your own machine.

## Cards And Connectors

Use `card` as the product term. Real cards should be connector-backed and live under `$FAB_DASHBOARD_HOME`, usually `~/.config/fab-dashboard`.

Tracked examples must be reproducible, safe to screenshot, and free of private account data. Public, recognizable references are fine when they make the demo easier to understand. Prefer `static` connectors for demos and templates; use `http`, `file`, `command`, or trusted `ts` connectors only when documenting reusable behavior.
