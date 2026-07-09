# Security

fab-dashboard is designed for local-first personal dashboards. It can read local files, run local commands, call APIs, and render private data when you configure connectors to do so.

## Supported Versions

The public project is pre-1.0. Security fixes target the current `main` branch unless release branches are introduced later.

## Reporting A Vulnerability

Please do not post secrets, tokens, private dashboards, or exploit details in public issues.

Use GitHub private vulnerability reporting if it is enabled for the repository. If it is not enabled yet, open a minimal public issue saying you have a security report, without including sensitive details, and the maintainer will arrange a private channel.

## Local Safety Model

- Keep real dashboards in `~/.config/fab-dashboard` or another ignored config home.
- Keep secrets in `$FAB_DASHBOARD_HOME/.env` or files referenced with `file:/absolute/path`.
- Treat `file`, `command`, and `ts` connectors as trusted local capabilities.
- Use `http.auth.type: "local-only"` for companion services that should only be reached on localhost.
- Do not expose the dashboard on a public network without an authenticating reverse proxy.

When sharing examples, PRs, screenshots, logs, or bug reports, scrub personal card data and connector outputs first.
