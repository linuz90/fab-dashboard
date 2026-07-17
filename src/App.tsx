import { useEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { AnimatedCardFrame } from "./components/AnimatedCardFrame";
import { CardInteractionModeProvider } from "./components/CardInteractionMode";
import { CardShell, ErrorCard } from "./components/CardShell";
import { CommandSearch, dashboardCardDomId } from "./components/CommandSearch";
import { DashboardCard } from "./components/DashboardCard";
import { DashboardSettings } from "./components/DashboardSettings";
import { HeaderWidgets } from "./components/HeaderWidgets";
import { Masonry, type MasonryItem } from "./components/Masonry";
import { syncThemeWithAppearance } from "./lib/theme";
import { agoLabel, friendlyDateTime } from "./lib/time";
import { useMobileCommandPull } from "./lib/useMobileCommandPull";
import { useDashboard, useNow } from "./lib/useDashboard";
import { resolveDashboardLayout } from "./shared/layout";

function headerTime(ts: number): string {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(ts);
}

function EmptyDashboard() {
  return (
    <div className="mx-auto max-w-lg pt-16 text-center">
      <CardShell title="Empty dashboard" freshness={{ label: "safe", tone: "ok" }}>
        <p className="type-ui-sm leading-relaxed text-muted">
          No local cards are configured. Run <span className="font-mono text-fg">bun run cli init --demo</span> for examples or add cards under your config home.
        </p>
      </CardShell>
    </div>
  );
}

export function App() {
  const { resp, fetchError, fetchedAt, showRefreshMotion } = useDashboard();
  const now = useNow();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cardsHaveEntered, setCardsHaveEntered] = useState(false);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const cardsEntering = Boolean(resp && !cardsHaveEntered);
  const headerWidgets = resp?.header?.widgets ?? [];
  const layout = resolveDashboardLayout(resp?.config.appearance.layout);
  const appearanceDefaultTheme = resp?.config.appearance.defaultTheme ?? null;
  const appearanceThemesKey = resp?.config.appearance.themes?.join("\u0000") ?? "";
  const footerText = fetchError
    ? `offline · ${fetchError}`
    : fetchedAt
      ? `refreshed ${agoLabel(fetchedAt, now)}`
      : null;

  useEffect(() => {
    if (!resp || cardsHaveEntered) return;
    const timeout = window.setTimeout(() => setCardsHaveEntered(true), 700);
    return () => window.clearTimeout(timeout);
  }, [cardsHaveEntered, resp]);

  useEffect(() => {
    if (resp) syncThemeWithAppearance(resp.config.appearance);
  }, [Boolean(resp), appearanceDefaultTheme, appearanceThemesKey]);

  useMobileCommandPull({
    enabled: Boolean(resp),
    open: commandSearchOpen,
    scrollContainerRef: scrollRef,
    onOpen: () => {
      // Mobile Safari is strict about keyboard focus; keep cmdk's autoFocus
      // mount inside the native touch gesture that opened the search.
      flushSync(() => setCommandSearchOpen(true));
    },
  });

  return (
    <CardInteractionModeProvider mode="dashboard">
      <div ref={scrollRef} className="app-scroll">
        <div
          className="app-shell mx-auto"
          style={{ "--dashboard-layout-max-width": `${layout.maxWidthPx}px` } as CSSProperties}
        >
          <header className="app-header relative flex items-center justify-between gap-4">
            <span className="eink-device-time font-mono type-ui-xs tabular-nums text-header-fg">{headerTime(now)}</span>
            <h1 className="app-title font-mono type-ui-sm font-medium lowercase text-header-fg">{resp?.config.title ?? "fab-dashboard"}</h1>
            <span className="app-status absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 type-ui-sm text-header-faint sm:flex">
              <span>{friendlyDateTime(now)}</span>
              <HeaderWidgets widgets={headerWidgets} now={now} showSeparator />
            </span>
            <span className="eink-device-weather items-center gap-1 font-mono type-ui-xs text-header-faint">
              <HeaderWidgets widgets={headerWidgets} now={now} />
            </span>
            <div className="app-actions flex items-center gap-2">
              <DashboardSettings resp={resp} />
            </div>
          </header>

          <main className="mt-6">
            {!resp ? null : resp.configError && resp.cards.length === 0 ? (
              <ErrorCard title="dashboard.json" message={resp.configError} />
            ) : resp.cards.length === 0 ? (
              <EmptyDashboard />
            ) : (
              <>
                {resp.configError && <div className="mb-[var(--layout-gap)]"><ErrorCard title="Config warning" message={resp.configError} /></div>}
                <Masonry
                  maxColumns={layout.maxColumns}
                  items={resp.cards.map((card, index): MasonryItem => {
                    const enterDelayMs = Math.min(index * 28, 220);
                    return {
                      key: card.instance.id,
                      full: card.instance.size === "full",
                      node: (
                        <div id={dashboardCardDomId(card.instance.id)} data-dashboard-card-id={card.instance.id}>
                          <AnimatedCardFrame enter={cardsEntering} refreshActive={showRefreshMotion} enterDelayMs={enterDelayMs}>
                            <DashboardCard card={card} now={now} />
                          </AnimatedCardFrame>
                        </div>
                      ),
                    };
                  })}
                />
              </>
            )}
          </main>

          {footerText && <footer className="mt-10 text-center font-mono type-ui-xs text-header-faint">{footerText}</footer>}
          <CommandSearch resp={resp} now={now} open={commandSearchOpen} onOpenChange={setCommandSearchOpen} />
        </div>
      </div>
    </CardInteractionModeProvider>
  );
}
