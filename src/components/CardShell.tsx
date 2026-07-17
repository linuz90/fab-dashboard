import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type FreshnessTone = "ok" | "stale" | "error";

/** Placement (column packing, "full" row spanning, gaps between cards) is
 * owned entirely by components/Masonry.tsx reading card.size from the config —
 * cards render pure content with no layout classes of their own. */
interface CardShellProps {
  id?: string;
  title: string;
  /** e.g. "source · ran 12 min ago"; stale/error tones get a colored dot. */
  freshness?: { label: string; tone: FreshnessTone } | null;
  visual?: {
    icon?: ReactNode;
    accent?: "blue" | "green" | "yellow" | "red" | "purple" | "pink" | "teal" | "muted";
  };
  children: ReactNode;
}

export function CardShell({ id, title, freshness, visual, children }: CardShellProps) {
  return (
    <section className="card-surface flex flex-col gap-[var(--card-gap)]" data-card-id={id} data-card-accent={visual?.accent}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 type-ui-md font-medium">
          {visual?.icon && <span className="card-title-icon text-faint [&>svg]:size-3.5">{visual.icon}</span>}
          <span className="truncate">{title}</span>
        </h2>
        {freshness && (
          <span className="flex max-w-[62%] shrink-0 items-center justify-end gap-1.5">
            <span data-card-meta data-tone={freshness.tone} className="flex min-w-0 items-center gap-1.5 truncate font-mono type-ui-xs text-faint">
              {freshness.tone !== "ok" && (
                <span className={cn("size-1.5 shrink-0 rounded-full", freshness.tone === "stale" ? "bg-warning" : "bg-danger")} />
              )}
              <span className="truncate">{freshness.label}</span>
            </span>
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

/** Inline problem card: invalid dashboard.json, unknown card type, adapter
 * failures. Renders instead of a blank page so agent edits fail loudly. */
export function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <CardShell title={title} freshness={{ label: "config", tone: "error" }}>
      <p className="whitespace-pre-wrap font-mono type-ui-sm leading-relaxed text-danger">{message}</p>
    </CardShell>
  );
}

/** Small labeled row: sans label left (optional glyph), mono value right. */
export function Row({
  label,
  value,
  icon,
  muted,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-px">
      <span className="flex min-w-0 flex-1 items-center gap-2 type-ui-sm text-muted">
        {icon && <span className="text-faint [&>svg]:size-3.5">{icon}</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className={cn("min-w-0 max-w-[72%] truncate text-right font-mono type-ui-sm", muted && "text-muted")}>
        {value}
      </span>
    </div>
  );
}

/** Tiny uppercase section label used inside cards with multiple lists.
 * A span (not div) so CollapsibleSection can nest it inside its toggle
 * button; as a flex item it lays out identically. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="type-ui-2xs font-medium uppercase tracking-ui-caps text-faint">{children}</span>;
}

/** Inline source failure with its repair hint, keeping the rest of the card alive. */
export function SourceError({ message, hint }: { message: string; hint: string | null }) {
  return (
    <div className="space-y-1">
      <p className="type-ui-sm text-danger">{message}</p>
      {hint && <p className="font-mono type-ui-xs text-muted">fix: {hint}</p>}
    </div>
  );
}
