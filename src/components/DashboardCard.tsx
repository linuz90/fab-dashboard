import { agoLabel } from "../lib/time";
import { Blocks, CardProblem } from "../renderer/BlockRenderer";
import { DashboardIcon } from "../renderer/icons";
import type { ResolvedCard, SourceFreshness } from "../shared/schemas";
import { CardShell, ErrorCard } from "./CardShell";

const NOOP_REFRESH = () => undefined;

export function freshnessFor(card: ResolvedCard, now: number): { label: string; tone: "ok" | "stale" | "error" } | null {
  const freshnessEntry = card.definition?.freshness?.connector
    ? ([card.definition.freshness.connector, card.freshness[card.definition.freshness.connector]] as const)
    : Object.entries(card.freshness)[0];
  if (!freshnessEntry) return null;
  const [connectorId, freshness] = freshnessEntry;
  if (!freshness) return null;
  let tone: "ok" | "stale" | "error" = freshness.status === "fresh" ? "ok" : freshness.status;
  const staleAfterSeconds = card.definition?.freshness?.staleAfterSeconds;
  if (tone === "ok" && staleAfterSeconds && freshness.fetchedAt) {
    const fetchedAt = Date.parse(freshness.fetchedAt);
    if (Number.isFinite(fetchedAt) && now - fetchedAt > staleAfterSeconds * 1000) tone = "stale";
  }
  const source = card.definition?.freshness?.label ?? connectorId ?? freshness.status;
  return {
    label: freshnessLabel(freshness, source, now),
    tone,
  };
}

function freshnessLabel(freshness: SourceFreshness, source: string = freshness.status, now?: number): string {
  if (freshness.refreshing) return `${source} · refreshing`;
  if (!freshness.fetchedAt || now === undefined) return source === freshness.status ? freshness.status : `${source} · ${freshness.status}`;
  return `${source} · ${agoLabel(freshness.fetchedAt, now) || freshness.status}`;
}

export function DashboardCard({
  card,
  now,
  onRefresh,
  refreshing = false,
}: {
  card: ResolvedCard;
  now: number;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  if (!card.definition) return <ErrorCard title={card.instance.title} message={card.error ?? "missing card definition"} />;
  const visual = card.definition.visual;
  return (
    <CardShell
      id={card.instance.id}
      title={card.instance.title}
      freshness={freshnessFor(card, now)}
      visual={{
        accent: visual.accent,
        icon: visual.icon ? <DashboardIcon name={visual.icon} /> : undefined,
      }}
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      {card.error && <CardProblem message={card.error} hint={card.definition.errorHint} />}
      <Blocks blocks={card.definition.blocks} data={card.data} storageKey={card.instance.id} onRefresh={onRefresh ?? NOOP_REFRESH} />
    </CardShell>
  );
}
