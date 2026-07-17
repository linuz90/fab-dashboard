---
name: share-card
description: Create privacy-safe Markdown blueprints for existing fab-dashboard cards, including their layout, principal blocks, bindings, and connector shapes. Use when the user asks to share, send, copy, export, gist, or publish a card for another fab-dashboard installation.
---

# Share Card

Create a card blueprint, not a lossless export or a complete connector implementation. Capture enough of the card's visible shape and data contract for another capable agent to recreate it using fab-dashboard's `create-card` skill and repo guidance.

Return one sanitized Markdown pack first, then let the user choose how to deliver that exact artifact. Use "card" in the artifact; treat "tile" and "widget" as aliases.

## Inspect Safely

1. Locate the active config home with a projection such as `bun run cli doctor --json | jq '{configHome, dashboardJson, dashboardExists, dashboardCards}'`. Never use `--fetch` while sharing.
2. Query only card `id`, `title`, and `type`; match the request, then read only the selected dashboard instances. Treat any tab membership on those selected instances as context for sanitization, not portable placement.
3. Resolve selected card definitions and connector manifests with app precedence: config home first, tracked examples second.
4. Read `docs/config.md` and use `src/shared/schemas.ts` as the source of truth for JSON included in the pack.
5. Project only the connector fields needed to understand its shape, such as kind, TTL, persistence, source category, and safe public provider/tool names. Do not dump raw manifests.

Do not fetch or execute connectors. Do not read `.env`, credentials, live output, caches, history, snapshots, source records, connector source code, private setup notes, or referenced commands/files. Keep discovery read-only.

## Keep Tab Placement Portable

Dashboard tabs describe the sender's installation, not the reusable card. Omit each selected instance's top-level `tab` field from the pack, even when several shared cards came from the same tab. State clearly that a recipient with dashboard-level tabs must choose one declared destination per recreated card; a flat recipient must leave `tab` absent.

## Build The Blueprint

Preserve dashboard order. Include each selected dashboard entry, each reused card definition once, and each shared connector shape once.

Use this structure:

````markdown
# fab-dashboard card pack: <generic title>

> Portable blueprint; not directly importable.
> Engine schema: <card schemaVersion>
> Sanitized for sharing; review before forwarding.

## Overview
<What the cards show and why they are useful.>

## Compatibility
- Card sizes, visual settings, and principal block types
- Number and kinds of connectors
- Dashboard-tab placement omitted; assign each card to a declared recipient tab when needed
- Material details omitted or generalized

## Dashboard entries
```json
[<sanitized card instance objects>]
```

## Card definitions
### cards/<generic-type>/card.json
```json
<valid sanitized definition preserving the ordered principal blocks and bindings>
```

## Connector shapes
### <generic-source-id>
- Kind: `http`, `file`, `command`, trusted `ts`, or `static`
- Purpose/source: <high-level source and capability>
- Recipient inputs: <credential purposes, paths, account choices, or tools the recipient must provide>
- Runtime traits: <useful TTL, persistence, or trust notes>

Optional manifest sketch:
```json
<small sanitized outline showing useful connector fields and neutral placeholders>
```

Normalized data contract:

| Field | Type | Meaning |
| --- | --- | --- |
| `metric` | number | Primary value used by the card |

## Omitted on purpose
- Secrets, credential values, and sender-specific environment names
- Private paths, hosts, ports, account/workspace/resource identifiers, and live values
- Connector source code, implementation details, raw output, caches, and history
- Private options, extensions, unsupported actions, and unrelated context
- Sender-specific dashboard-tab ids, labels, ordering, and card placement

## Recreate
Give this blueprint to an agent running fab-dashboard. Ask it to use the repo's `create-card` guidance, choose or build suitable connectors for the recipient's environment, assign each card to a valid destination tab if the recipient uses dashboard-level tabs, validate the result, and add the cards to the recipient's config home.
````

The connector section should explain what feeds the card and what normalized fields it must return. Do not include adapter source, line-by-line acquisition or transformation logic, setup tutorials, or synthetic live values. Agents can choose the simplest connector implementation that fits the recipient's environment.

## Sanitize By Reconstruction

- Preserve the layout, ordered principal blocks, visual settings, important labels, conditions, and connector bindings that define the experience.
- Rewrite card, type, and connector ids to neutral slugs; update every reference consistently.
- Keep public provider or tool names when they are central and non-sensitive. Generalize sensitive affiliations.
- Replace private labels, paths, hosts, ports, ids, account choices, sender environment names, and real values with neutral descriptions or placeholders.
- Omit each instance's top-level `tab` membership. It describes where the sender placed the card, not a portable requirement of the card itself; the recipient must choose a declared destination tab when installing into a tabbed dashboard.
- Omit instance options, definition defaults, extensions, and action rows unless essential to understanding the card.
- Never represent a live connector as `static`. Describe uncertainty honestly when the manifest does not reveal enough.

## Verify

- Validate included card instances and definitions against the current schema. Portable entries intentionally omit sender tab placement; after recreation, validate the recipient's complete dashboard so every card in a tabbed config references one declared destination tab. If a connector snippet is only an outline, label it as a manifest sketch rather than installable config.
- Confirm every connector path used by the card appears in the normalized data contract.
- Scan the complete Markdown for secrets, absolute paths, private infrastructure, sender-specific identifiers, and live personal or analytics values.
- Remove temporary validation files before returning.

## Deliver

Show the complete pack before taking delivery action, then ask whether to:

- copy it to the clipboard
- upload it as a secret/unlisted GitHub gist
- save it to an exact local path
- use another specified destination

Do not deliver until the user chooses. Secret gists are link-accessible, not access-controlled; require an explicit request before making one public. Use the already displayed Markdown without silently adding omitted details.
