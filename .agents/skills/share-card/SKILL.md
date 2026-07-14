---
name: share-card
description: Create privacy-safe, portable Markdown summaries of one or more existing fab-dashboard cards. Use when the user asks to share or send cards to someone else, make a shareable gist or recipe, or copy, export, or publish a sanitized card example for another fab-dashboard installation.
---

# Share Card

Create a reconstructable card recipe, not a lossless export. Return one sanitized Markdown card pack first, then let the user choose how to deliver that exact artifact.

Use "card" in the artifact. Treat "tile" and "widget" as user-facing aliases.

## Inspect Only What Is Needed

1. Locate the active config home with a structured projection such as `bun run cli doctor --json | jq '{configHome, dashboardJson, dashboardExists, dashboardCards}'`. Do not return the unfiltered doctor payload to the transcript, and never use `--fetch` for sharing.
2. From the projected `dashboardJson` path, use a structured query to read only each card's `id`, `title`, and `type`. Match the request against those candidates, ask only when multiple plausible matches remain, then read only the selected instance objects.
3. Resolve each selected definition with the same catalog precedence as the app: `<configHome>/cards/<type>/card.json` first, then `examples/cards/<type>/card.json`. Resolve referenced connectors from `<configHome>/connectors/<id>/connector.json` first and then `examples/connectors/<id>/connector.json`, but inspect only the chosen definition and the allowlisted connector metadata below.
4. Read `docs/config.md` and treat `src/shared/schemas.ts` as the current schema source of truth before reconstructing JSON.
5. Do not read the local setup note, `.env`, secret files, connector output, cache, history, snapshots, source data, or screenshots of the live card.
6. Do not print or copy a full real connector manifest. If the connector kind or freshness is useful, project only `kind`, `ttlSeconds`, and `persist` with a structured JSON query. Do not inspect connector code, file targets, commands, arguments, URLs, headers, auth fields, environment names, or trusted TypeScript entry paths.

Keep this discovery read-only. Do not modify the user's dashboard while preparing a share.

## Build The Card Pack

Produce one Markdown artifact for all requested cards. Preserve dashboard order, include each reused card definition once, and deduplicate shared connector contracts.

Use this structure:

````markdown
# fab-dashboard card pack: <generic title>

> Portable Markdown recipe; not directly importable.
> Engine schema: <card schemaVersion>
> Sanitized for sharing; review before forwarding.

## Overview
<What the cards show and why they are useful, in generic language.>

## Compatibility
- Cards and built-in block types used
- Number of normalized data sources
- Any behavior omitted because it is private, executable, or not portable

## Dashboard entries
```json
[<sanitized card instance objects>]
```

## Card definitions
### cards/<generic-type>/card.json
```json
<valid sanitized card definition>
```

## Connector contracts
### <generic-source-id>
- Purpose: <generic capability>
- Suggested implementation: `http`, `file`, `command`, trusted `ts`, or `static`
- Expected freshness: <generic expectation>

Synthetic normalized connector output:
```json
<invented safe connector output matching the sanitized paths, without a connector-id wrapper>
```

For a `static` connector, place this object in `connector.json.data`; other connector kinds must return the equivalent JSON. fab-dashboard exposes the normalized output to card paths under the connector id. For example, field `metric` from connector `example-source` is read as `example-source.metric`.

## Omitted on purpose
- Credentials, secret references, and environment names
- Real connector manifests, source code, and executable configuration
- URLs, hosts, account/workspace/resource identifiers, and local paths
- Live values, cached output, timestamps, and personal text
- Private options, extensions, and unsupported actions

## Recreate
Give this card pack to an agent running fab-dashboard. Ask it to choose and configure a real connector for each contract, validate the result, and add the cards to the recipient's own config home.
````

The pack is deliberately not an import format. The recipient must provide their own data source, credentials, and local configuration.

## Sanitize By Reconstruction

Build the artifact from an allowlist instead of copying everything and relying on regex replacement.

- Preserve useful layout, visual settings, built-in block structure, and generic labels.
- Rewrite identifying card, type, and connector ids to neutral slugs. Update every matching connector reference and data-path prefix consistently.
- Keep a provider name only when it is clearly non-sensitive and essential to the card's purpose, or when the user explicitly asks to retain it. Default to a generic provider category when the affiliation itself could reveal sensitive health, therapy, dating, recovery, finance, or similar information. Remove tenant, account, workspace, project, repository, host, and person identifiers.
- Reword or omit sensitive titles, keywords, static text, empty/error messages, freshness labels, field names, and `visibleWhen.equals` values.
- Omit instance `options`, definition option defaults, and `extensions` by default because they allow arbitrary JSON. Include only a reconstructed generic value when it is essential to understanding the card.
- Omit action rows unless they contain only the built-in read-only `refresh` action. Describe other omitted behavior under Compatibility.
- Never include a real connector manifest. Describe its capability and normalized output contract instead.
- Generate synthetic payloads from the sanitized card paths and block usage, never by perturbing or paraphrasing real values. Use an honest placeholder or mark a type as unknown when the card does not reveal enough information.
- Do not include a live screenshot. If the user later requests a preview, render an isolated synthetic version.

Review every free-form string semantically. Sensitive meaning often hides in otherwise harmless labels, ids, property names, keywords, and error text.

## Verify Before Returning

Confirm that the reconstructed card definitions remain valid JSON and use the current engine schema. When ids, paths, or multiple definitions changed materially, validate them under `/tmp` in a temporary dashboard home with safe static connectors, then remove the temporary files.

Scan the final Markdown for:

- absolute paths, URLs, emails, private hosts, and local ports
- secret refs, token-like strings, headers, and environment names
- original connector ids and private card/type slugs
- account, workspace, project, repository, customer, and person names
- actual financial, health, calendar, message, task, or analytics values

If any value is questionable, replace it with a clearly synthetic example or omit it. State material omissions rather than guessing.

## Ask How To Deliver It

Show the complete card pack in the response before taking any delivery action. End the response with a direct question asking what the user wants to do with that exact Markdown; do not leave the choices as a passive statement:

- copy it to the clipboard
- upload it as a secret/unlisted GitHub gist
- save it as a local Markdown file
- use another destination they specify

Do not copy the artifact to the clipboard, save it to a user location, upload, publish, or send it until the user chooses. Temporary files used only for the validation step above are allowed under `/tmp` and must be removed. For GitHub, default to a secret gist and explain that secret gists are link-accessible, not access-controlled; require an explicit request before making one public. Before any external delivery, use the already displayed artifact without silently adding omitted details.

After the user chooses:

- Clipboard: use an available platform clipboard command such as `pbcopy`, `wl-copy`, or `xclip`. If none is available, keep the artifact inline and offer a file instead.
- GitHub gist: check that `gh` is installed and already authenticated. Do not start authentication silently. Create a secret gist by default, or offer another destination if GitHub is unavailable.
- Local file: ask for an exact path when the user did not provide one, then save only the displayed Markdown.
- Other destination: confirm the destination, recipient or audience, and visibility before sending or publishing.
