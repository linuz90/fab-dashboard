# Services

`fab-dashboard` is local-only by default. It binds `127.0.0.1:7893` unless overridden.

Build the production bundle, then run the local server:

```bash
bun run build
bun run start
```

Print background service templates:

```bash
bun run cli service print macos
bun run cli service print systemd
```

After creating or changing a service, write the private operating details to `$FAB_DASHBOARD_HOME/README.md`: service file path, local URL, Tailscale URL, relevant non-secret environment variable names, restart command, and any companion local APIs or refresh jobs. `bun run cli doctor --json` reports this path as `setupReadme`.

## Private Tailscale Access

The recommended way to open the dashboard from a phone, tablet, or another computer is [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve). Keep the dashboard bound to localhost, then proxy the local port from the same machine:

```bash
tailscale serve 7893
```

Tailscale prints an HTTPS URL like `https://example.tailnet.ts.net`. Use that URL from devices in your tailnet, then install it from the browser as a PWA. Tailscale Serve may ask you to enable HTTPS certificates for the tailnet, and tailnet access controls still apply.

If the dashboard responds with `host not allowed`, restart the dashboard with the printed tailnet hostname in the allow-list:

```bash
export FAB_DASHBOARD_ALLOWED_HOSTS=localhost,127.0.0.1,example.tailnet.ts.net
export FAB_DASHBOARD_PUBLIC_ORIGIN=https://example.tailnet.ts.net
bun run start
```

Settings writes, such as card reordering and layout changes, stay local-only unless you explicitly trust the exact Tailscale origin:

```bash
export FAB_DASHBOARD_TRUSTED_CONFIG_ORIGINS=https://example.tailnet.ts.net
```

Only use that for private Serve URLs you trust. The dashboard server must still be bound to localhost, and the proxy connection must still come from the local machine. Do not enable trusted config origins for Tailscale Funnel or an unauthenticated public reverse proxy.

Once the foreground Serve session works, run `tailscale serve --help` for the current background-mode options on your Tailscale client.

Use Tailscale Funnel only when you intentionally want a public internet URL. For the usual personal dashboard, Serve is the safer default because it stays inside your tailnet.

## Non-Local Binding

Caddy, nginx, public reverse proxies, and direct LAN binds are user-owned exposure layers. If you bind outside localhost, set explicit host/origin guardrails:

```bash
FAB_DASHBOARD_HOST=0.0.0.0
FAB_DASHBOARD_ALLOWED_HOSTS=localhost,127.0.0.1,example.tailnet.ts.net
FAB_DASHBOARD_PUBLIC_ORIGIN=https://example.tailnet.ts.net
```

This is not a multi-user auth system. Put it behind Tailscale, a VPN, or an authenticated reverse proxy before exposing it beyond the machine.

When bound outside localhost, the dashboard is read-only: the settings modal will not offer card reordering or layout changes, and config mutation endpoints reject writes. Keep `FAB_DASHBOARD_HOST` local when you want in-browser edits to `dashboard.json`, optionally with `FAB_DASHBOARD_TRUSTED_CONFIG_ORIGINS` for a private local proxy such as Tailscale Serve.
