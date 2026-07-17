import { FolderOpen, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { cn } from "../lib/cn";
import { mergeWithinTabCardOrder } from "../lib/dashboardTabs";
import type { DashboardTab } from "../shared/schemas";
import { SortableCardOrderList, type SortableCardOrderItem } from "./SortableCardOrderList";

export function DashboardCardOrderSettingsSection({
  cards,
  orderedCards,
  tabs,
  canMutateConfig,
  saving,
  orderError,
  retryOrder,
  onOrderChange,
  onDragStateChange,
  onRetry,
  onReset,
}: {
  cards: SortableCardOrderItem[];
  orderedCards: SortableCardOrderItem[];
  tabs?: readonly DashboardTab[];
  canMutateConfig: boolean;
  saving: boolean;
  orderError: string | null;
  retryOrder: string[] | null;
  onOrderChange: (nextOrder: string[]) => void;
  onDragStateChange: (active: boolean) => void;
  onRetry: () => void;
  onReset: () => void;
}) {
  const dashboardOrder = orderedCards.map((card) => card.id);

  return (
    <section className="mt-4 min-h-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="type-ui-2xs font-medium uppercase tracking-ui-caps text-faint">Card order</h3>
        {saving ? (
          <span aria-live="polite" className="flex items-center gap-1.5 font-mono type-ui-xs text-faint">
            <Loader2 className="size-3 animate-spin" />
            saving
          </span>
        ) : !canMutateConfig && cards.length > 0 ? (
          <span className="font-mono type-ui-xs text-faint">read only</span>
        ) : null}
      </div>

      {tabs ? (
        <div className="space-y-3">
          {tabs.map((tab) => {
            const tabCards = orderedCards.filter((card) => card.tab === tab.id);
            const currentTabOrder = tabCards.map((card) => card.id);
            return (
              <div key={tab.id} className="rounded-xl border border-border bg-canvas/20 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
                  <h4 className="truncate type-ui-sm font-medium text-fg">{tab.label}</h4>
                  <span className="shrink-0 font-mono type-ui-2xs text-faint">
                    {tabCards.length} {tabCards.length === 1 ? "card" : "cards"}
                  </span>
                </div>
                {tabCards.length ? (
                  <SortableCardOrderList
                    items={tabCards}
                    disabled={!canMutateConfig || saving || tabCards.length < 2}
                    onOrderChange={(nextTabOrder) => {
                      onOrderChange(mergeWithinTabCardOrder(dashboardOrder, currentTabOrder, nextTabOrder));
                    }}
                    onDragStateChange={onDragStateChange}
                  />
                ) : (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center type-ui-xs text-faint">
                    No cards in this tab.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : cards.length ? (
        <SortableCardOrderList
          items={orderedCards}
          disabled={!canMutateConfig || saving || cards.length < 2}
          onOrderChange={onOrderChange}
          onDragStateChange={onDragStateChange}
        />
      ) : (
        <div className="rounded-xl border border-border bg-canvas/35 px-3 py-6 text-center">
          <FolderOpen className="mx-auto size-5 text-faint" />
          <p className="mt-2 type-ui-sm text-muted">No local dashboard cards yet.</p>
        </div>
      )}

      {!canMutateConfig && cards.length > 0 && (
        <p className="mt-3 font-mono type-ui-xs leading-relaxed text-faint">
          Reordering is available when the dashboard server is local.
        </p>
      )}

      {orderError && (
        <div role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/[0.06] px-3 py-2">
          <p className="whitespace-pre-wrap font-mono type-ui-xs leading-relaxed text-danger">{orderError}</p>
          {retryOrder && (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={onRetry}
                className={cn(
                  "inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-border px-2 type-ui-xs text-fg transition-colors",
                  "hover:bg-fg/[0.06] disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent"
                )}
              >
                <RefreshCw className={cn("size-3.5", saving && "animate-spin")} />
                Retry
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={onReset}
                className={cn(
                  "inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-border px-2 type-ui-xs text-muted transition-colors",
                  "hover:bg-fg/[0.06] hover:text-fg disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted"
                )}
              >
                <RotateCcw className="size-3.5" />
                Reset
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
