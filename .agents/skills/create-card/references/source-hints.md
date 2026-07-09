# Source Hints

Use these as starting points when choosing a connector source. They are intentionally hints, not API recipes: open the linked official docs, confirm auth/scopes/rate limits/current endpoints, then normalize the result into small dashboard JSON.

Prefer `http` for direct JSON APIs, `command` for CLIs or scripts that already know how to authenticate, `file` for snapshots another process writes, and trusted `ts` when the source needs local normalization, pagination, joins, SQLite, or multiple reads.

| Source | Useful card ideas | Likely connector | Start with |
| --- | --- | --- | --- |
| Stripe | MRR, revenue, failed payments, churn signals, recent invoices | `http` or trusted `ts` for pagination/aggregation | [Stripe API docs](https://docs.stripe.com/api) |
| ChartMogul | MRR, ARR, customer count, subscription movements | `http` | [ChartMogul developer docs](https://dev.chartmogul.com/docs/introduction/) |
| Paddle | MRR, active subscribers, net revenue, transactions | `http` or trusted `ts` for metric shaping | [Paddle API reference](https://developer.paddle.com/api-reference/) |
| Shopify | orders, revenue, products needing attention, fulfillment status | `http` or trusted `ts` for GraphQL shaping | [Shopify Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql/latest) |
| Plaid / market data | portfolio value, holdings, allocation, day change, P/L | trusted `ts`, `command`, or `file` snapshot for holdings + quotes | [Plaid Investments docs](https://plaid.com/docs/investments/) and a quote provider such as [Alpha Vantage](https://www.alphavantage.co/documentation/) or [Massive stock docs](https://massive.com/docs/rest/stocks/overview) |
| GitHub | PR review queue, issues, releases, CI status, repo activity | `http` or `command` via `gh` | [GitHub REST API docs](https://docs.github.com/en/rest) |
| GitLab | merge requests, issues, pipeline status, release activity | `http` or `command` via `glab` | [GitLab REST API docs](https://docs.gitlab.com/api/rest/) |
| Linear | assigned issues, cycle progress, triage counts, team health | `http` GraphQL or trusted `ts` | [Linear developer docs](https://linear.app/developers) |
| OpenAI / Codex | Codex usage, workspace activity, API usage/cost, model mix | `http` for admin/analytics APIs, or trusted `ts`/`command` for local CLI logs | [Codex governance docs](https://developers.openai.com/codex/enterprise/governance) and [OpenAI usage API reference](https://platform.openai.com/docs/api-reference/usage) |
| Claude / Anthropic | Claude Code sessions, token/cost usage, team analytics, local activity | `http` for Admin/Analytics APIs, or trusted `ts`/`command` for local Claude Code logs | [Claude Code Analytics API](https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api) and [Usage and Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api) |
| Notion | database counts, project status, reading lists, notes inboxes | `http` or trusted `ts` for pagination/schema mapping | [Notion API reference](https://developers.notion.com/reference/intro) |
| Google Calendar | agenda, next meeting, free/busy windows, focus blocks | `http`, `command`, or trusted `ts` for OAuth/local token handling | [Google Calendar API docs](https://developers.google.com/workspace/calendar/api/guides/overview) |
| Gmail | unread counts, labeled inboxes, sender summaries, stale threads | `http`, `command`, or trusted `ts` for OAuth/local token handling | [Gmail API docs](https://developers.google.com/workspace/gmail/api/guides) |
| Slack | mentions, channels needing attention, unread summaries, team status | `http` or `command` if a local helper owns auth | [Slack Web API docs](https://docs.slack.dev/apis/web-api/) |
| Todoist | today count, overdue tasks, project lists, inbox triage | `http`, `command`, or `file` snapshot | [Todoist API docs](https://developer.todoist.com/api/v1/) |
| Things | today/inbox counts, deadlines, project summaries, task deep links | `command`, trusted `ts`, or `file` snapshot from local automation/SQLite/export | [Things URL scheme docs](https://culturedcode.com/things/support/articles/2803573/) for links/actions, not read access |
| Spotify | now playing, recently played, top tracks/artists, listening status | trusted `ts` for OAuth refresh, or `command`/`file` if a local helper owns auth | [Spotify Web API docs](https://developer.spotify.com/documentation/web-api) and [refreshing tokens](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens) |
| Google Analytics | visitors, top pages, realtime usage, conversions | `http` or trusted `ts` for service-account/OAuth handling | [Google Analytics Data API docs](https://developers.google.com/analytics/devguides/reporting/data/v1) |
| Plausible | visitors, goals, top referrers, page views | `http` | [Plausible Stats API docs](https://plausible.io/docs/stats-api) |
| PostHog | product metrics, feature usage, insights, experiments | `http` or trusted `ts` for query shaping | [PostHog API docs](https://posthog.com/docs/api) |
| Sentry | unresolved issues, deploy health, error trends, releases | `http` | [Sentry API docs](https://docs.sentry.io/api/) |
| Datadog | service health, monitor alerts, SLOs, incident context | `http` or `command` if local tooling owns auth | [Datadog API docs](https://docs.datadoghq.com/api/latest/) |
| Vercel | deployments, build status, project health, domains | `http` | [Vercel REST API docs](https://vercel.com/docs/rest-api) |
| Cloudflare | worker errors, traffic, cache/security events, zone health | `http` or trusted `ts` for account/zone joins | [Cloudflare API docs](https://developers.cloudflare.com/api/) |

Privacy and implementation reminders:

- Ask which account/workspace/project/site/repo owns the data before creating a real connector.
- Do not infer sensitive company/account/source choices from ambient context such as email domains, repo names, installed skills, or available tools. Treat them as weak hints and confirm.
- Store tokens in `$FAB_DASHBOARD_HOME/.env` or a user-owned secret file; never in card JSON or tracked examples.
- Keep personal scripts, OAuth token stores, snapshots, and local database paths in the user's config home or ignored `local/`.
- Normalize provider data into display-ready fields such as counts, labels, tones, timestamps, rows, and short histories; keep API quirks out of card JSON.
- Prefer provider webhooks or local snapshot jobs only when polling is costly, rate-limited, or needs heavyweight auth.
- For portfolio cards, distinguish the holdings source from the quote source; quote APIs do not know share counts, cost basis, cash, or account grouping.
- For agent-usage cards, distinguish local CLI/session logs from organization/admin billing or analytics APIs. Avoid scraping dashboards; admin keys are high privilege and local log formats can drift.
- For desktop apps with URL schemes, treat the scheme as an action/deep-link target after data has been read elsewhere. It usually cannot provide a structured task list or metric payload by itself.
