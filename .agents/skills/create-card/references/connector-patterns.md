# Connector Patterns

Use these patterns when the user asks for a new real card. Keep the connector output small, normalized, and display-ready; the card should not know API quirks or local file formats.

## Remote Service Metric

Example request: "Show MRR on my startup."

Ask which service owns the number if the user did not say. Common answers are Stripe, ChartMogul, Baremetrics, Paddle, a custom API, or a local script.

For an API token, tell the user to place it in `$FAB_DASHBOARD_HOME/.env`:

```dotenv
STARTUP_API_TOKEN=...
```

Then reference it from an HTTP connector:

```json
{
  "schemaVersion": 1,
  "id": "startup-mrr",
  "kind": "http",
  "ttlSeconds": 900,
  "persist": true,
  "url": "https://api.example.com/dashboard/mrr",
  "method": "GET",
  "timeoutMs": 8000,
  "maxBytes": 1000000,
  "headers": {},
  "auth": { "type": "bearer", "token": "env:STARTUP_API_TOKEN" }
}
```

If the upstream API response is awkward, prefer a trusted `ts` connector or local companion service that normalizes to:

```json
{
  "mrr": "$145.8k",
  "delta": "+2.4%",
  "tone": "success",
  "history": [138, 139, 142, 145.8],
  "arr": "$1.75m",
  "customers": "5,482"
}
```

Then render with `metric`, `rows`, and optional `list` blocks.

## Local File Count

Example request: "Show how many notes I have in my inbox, and notes are local files."

Ask for the inbox path and what counts as an inbox note: folder, glob, extension, frontmatter status, or filename convention.

Use `file` only when another process already writes a JSON snapshot:

```json
{
  "schemaVersion": 1,
  "id": "notes-inbox",
  "kind": "file",
  "ttlSeconds": 60,
  "persist": true,
  "path": "~/Documents/Notes/inbox-summary.json",
  "maxBytes": 1000000,
  "allowSymlinks": false
}
```

`ttlSeconds` controls cached connector freshness, not background polling. The file is re-read on dashboard refresh, so use an external job or app automation when the snapshot itself needs to update on a schedule.

Use `command` or `ts` when the dashboard must scan files itself. A good normalized output is:

```json
{
  "count": "18",
  "status": "needs triage",
  "tone": "warning",
  "latest": [
    { "title": "Idea.md", "meta": "today", "text": "Inbox" }
  ]
}
```

Keep any scanner script or private path in `$FAB_DASHBOARD_HOME/connectors/<id>/`, not tracked examples.

## Local App Data

Example request: "Make a Things card."

Search first for an existing connector in the user's config home, ignored `local/` config homes, repo scripts, or notes. If none exists, ask what the card should show: today count, inbox count, deadlines, projects, or a list.

Use `command` for stable CLIs or scripts that output JSON. Use `ts` for SQLite reads, multiple files, AppleScript/JXA normalization, or any source that needs code. Treat this as trusted local access and keep implementation local unless the user explicitly asks for a generic, privacy-safe example.

Do not treat a desktop app URL scheme as a read API. For Things, the current dashboard pattern is to read or receive task data through a trusted local connector, then emit row `url` values like `things:///show?id=...` so rendered task rows can deep-link back into the app. If direct SQLite access is the chosen source, confirm the database path and schema with the user, prefer a copied/exported snapshot when practical, and keep private paths outside tracked examples.

Do not guess private database paths in tracked config. If a local app database path is needed, keep it in the local connector code or a user-owned `.env` value such as:

```dotenv
THINGS_DB_PATH=/absolute/path/to/local/database
```

## Card Example

```json
{
  "schemaVersion": 1,
  "type": "startup-mrr",
  "connectors": ["startup-mrr"],
  "keywords": ["mrr", "revenue", "startup"],
  "freshness": { "connector": "startup-mrr", "label": "api", "staleAfterSeconds": 1800 },
  "visual": { "icon": "chart-line", "accent": "green" },
  "errorHint": "Check the startup-mrr connector and API token.",
  "blocks": [
    {
      "type": "metric",
      "label": "MRR",
      "valuePath": "startup-mrr.mrr",
      "deltaPath": "startup-mrr.delta",
      "sparklinePath": "startup-mrr.history",
      "tonePath": "startup-mrr.tone"
    },
    {
      "type": "rows",
      "rows": [
        { "label": "ARR", "valuePath": "startup-mrr.arr" },
        { "label": "Customers", "valuePath": "startup-mrr.customers" }
      ]
    }
  ]
}
```
