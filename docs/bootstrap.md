# Bootstrap

Use this when the active dashboard is empty and the user asks for help getting started. The goal is not to produce a generic starter board; it is to help the user discover a small first dashboard that reflects their real day, with data sources they can actually connect.

## First Check

Inspect the active config home before making recommendations:

```bash
bun run cli doctor --json
```

Use `dashboardCards` and `dashboardConnectors` to decide whether the user's dashboard is empty. `catalogCards` and `catalogConnectors` include tracked examples, so they can be non-zero on a fresh install.

If the dashboard is empty, explain that the real dashboard is ready but has no cards yet. Ask who the user is, what they care about, and which apps/tools/services matter most in their day. Make the question easy to answer: they can list apps, describe a workflow, or share a personal website, GitHub, LinkedIn, X/social account, company page, or another public link.

Public links are inspiration, not authorization. Do not scrape or connect private services from a public profile alone. Before creating a real connector, confirm the data source, credential location, and whether the files should live in `$FAB_DASHBOARD_HOME` or another user-owned location.

## Recommendation Shape

Suggest 3-6 first cards. Group them by source type so the user can choose based on effort and comfort:

- local files/apps
- API/service with key
- command/script connector
- manual/static starter

For each recommended card, include:

- what the card shows and why it belongs on the first dashboard
- the likely connector kind: `http`, `file`, `command`, trusted `ts`, or `static`
- what credentials, exports, local paths, or user choices are needed
- a proposed card shape: key metric, rows, list, card-level tabs, status, allocation, leaderboard, sparkline, or header widget

Prefer cards that answer recurring questions: what needs attention, what changed, what is next, what is healthy/unhealthy, and what is worth celebrating. Avoid cards that are merely decorative, require fragile scraping, or need high-privilege admin keys before the user has opted in.

Keep the first dashboard flat by default. A small board is easier to understand and rearrange before its long-term contexts are clear.

## When To Offer Dashboard Tabs

Offer optional dashboard-level tabs when the user names stable top-level contexts, asks for multiple dashboard views in one installation, or has unrelated groups of cards competing for the same screen. Prefer the fewest clear groups, such as Today and System.

Before enabling tabs:

- confirm the tab labels and which one should be the first/default view when that is not obvious
- place every existing card into one declared tab in the same edit
- keep the dashboard title and header widgets global
- explain that command search stays global and can switch tabs to reach a card
- do not present tabs as a performance feature; inactive-tab connectors still resolve eagerly

Dashboard-level tabs group whole cards and appear in the URL. A card-level `tabs` block switches related content inside one card. If the active dashboard already declares top-level tabs, assign every new card to one valid destination tab and ask when placement is ambiguous.

## Strong First Dashboards

Use these as patterns, not templates to apply blindly.

### Builder / Developer

- Today: calendar, Things/Todoist, or local notes. Use a card-level `tabs` block for Today, Upcoming, Waiting; use compact `list` rows.
- Code queue: GitHub/GitLab PRs, issues, failing checks, or assigned reviews. Use `status`, `rows`, and a compact `feed` list.
- Deploy health: Vercel, Render, Fly.io, GitHub Actions, Sentry, or Datadog. Use `status` plus rows for the latest deploy, error rate, and incidents.
- Agent usage: local Codex/Claude logs, OpenAI/Anthropic admin APIs, or billing exports. Use `metric`, `rows`, and `sparkline`; distinguish local CLI logs from org-level billing APIs.
- System pulse: local command connector for battery, disk, backups, Docker, or homelab services. Use a `status` block and short rows.

### Founder / Operator

- Revenue pulse: Stripe, ChartMogul, Paddle, Lemon Squeezy, or a warehouse snapshot. Use `metric`, `sparkline`, and rows for MRR, trials, churn, or failed payments.
- Product usage: PostHog, Plausible, TelemetryDeck, Amplitude, or a database/API snapshot. Use `metric` and `leaderboard` for active users, key events, or top flows.
- Company performance: define the source first. It might be finance, product analytics, sales CRM, support, or a spreadsheet; do not infer the system from the company name.
- Support queue: Intercom, Zendesk, Help Scout, Linear, or GitHub issues. Use a card-level `tabs` block for Urgent, Waiting, Recently closed.
- Calendar + focus: calendar API plus task app/local notes. Use a half card or a header widget for the next commitment.

### Personal Home Screen

- Tasks: Things, Todoist, Apple Reminders export, or a local script. Use a card-level `tabs` block for Today, Upcoming, Projects; for Things, first look for an existing local connector/script before reading local app data.
- Calendar: Google Calendar, iCloud export, or local calendar cache. Use `list` or `timeline`; keep the next event visible.
- Weather + commute: weather API, local public transit, or a manual place. Use a header weather widget plus a small rows card if more detail matters.
- Media: Spotify, Last.fm, Plex, Jellyfin, or local playback snapshots. Use `media` list rows and progress.
- Reading/watchlist: RSS, Readwise, Raindrop, Pocket, Instapaper, or local bookmarks. Use a feed list with tags/chips.

### Money / Portfolio

- Portfolio: distinguish holdings from prices. Broker exports, spreadsheets, or local snapshots know holdings; quote APIs only know market prices.
- Allocation: use `allocation` for asset/category mix and rows for cash, daily change, or risk notes.
- Watchlist: quote API or static symbols plus an API key. Use `leaderboard`, `sparkline`, and visible freshness.
- Budget/bills: local spreadsheet, bank export, YNAB, or manual static starter. Ask before connecting finance APIs and keep secrets in `$FAB_DASHBOARD_HOME/.env` or `file:` refs.

### Content / Community

- Publishing queue: local drafts, Notion, GitHub issues, Linear, or a CMS API. Use a card-level `tabs` block for Drafting, Scheduled, Shipped.
- Social pulse: YouTube, GitHub, Mastodon, Bluesky, X, or analytics exports. Prefer official APIs or exports; avoid brittle scraping.
- Bookmarks/research: Raindrop, Readwise, browser export, Zotero, or RSS. Use compact `feed` lists and chips.
- Newsletter/blog metrics: Buttondown, Beehiiv, Ghost, Substack exports, Plausible, or a warehouse snapshot. Use `metric` and `sparkline`.

## Good Card Shapes

- Use a card-level `tabs` block when the user asked for one broad card with multiple modes, such as tasks by horizon, support by queue, portfolio by asset class, or analytics by period.
- Use `metric` plus `sparkline` for one number that should be watched over time.
- Use `rows` for compact status facts where every row has a stable label.
- Use `list` for tasks, events, feeds, media, alerts, and timelines.
- Use `status` when one source has a clear health state.
- Use `allocation` for percentages that sum to a meaningful whole.
- Use `leaderboard` for rankings, standings, top pages, top holdings, or top repos.
- Use header widgets only for tiny always-visible facts such as weather, focus mode, next meeting, or one system state.

## Starter Recommendation Example

If a user says "I am a solo founder and mostly live in Things, GitHub, Stripe, Spotify, and Linear", a good first response could be:

- local files/apps: Things Today card using an existing Things connector/script if present, otherwise a trusted local connector after confirming the data path
- API/service with key: Stripe revenue pulse with MRR, failed payments, and a 30-day sparkline, storing the key in `$FAB_DASHBOARD_HOME/.env`
- API/service with key: GitHub review queue with assigned PRs, failing checks, and recently merged work
- API/service with key: Linear support/product queue with urgent issues and waiting states
- API/service with key: Spotify now playing card with current track, progress, and recent plays
- manual/static starter: company goals card if live metrics are not ready yet, clearly marked as manual/static

Then ask the user which 2-3 they want first, confirm credentials/storage, and build only the chosen cards.

## Share What You Build

After the user's first selected cards are built and validated, briefly mention that they can ask to share any card with the bundled [`share-card`](../.agents/skills/share-card/SKILL.md) skill. It prepares a privacy-safe portable summary before any delivery. Do not invoke it unless the user asks.
