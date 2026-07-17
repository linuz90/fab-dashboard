import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { DASHBOARD_QUERY_KEY, DashboardApiError, reorderDashboardCardsAction, updateDashboardLayoutAction } from "../lib/dashboardApi";
import type { DashboardResponse } from "../shared/schemas";
import { DashboardCardOrderSettingsSection } from "./DashboardCardOrderSettingsSection";
import {
  DashboardLayoutSettingsSection,
  layoutSelectionFromConfig,
  sameLayoutSelection,
  type DashboardLayoutSelection,
} from "./DashboardLayoutSettingsSection";
import { DashboardThemeSettingsSection } from "./DashboardThemeSettingsSection";
import type { SortableCardOrderItem } from "./SortableCardOrderList";

const MODAL_EXIT_MS = 120;

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function cardsToOrderItems(resp: DashboardResponse | null): SortableCardOrderItem[] {
  return (resp?.cards ?? []).map((card) => ({
    id: card.instance.id,
    title: card.instance.title,
    type: card.instance.type,
    size: card.instance.size,
    tab: card.instance.tab,
  }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function DashboardSettings({ resp }: { resp: DashboardResponse | null }) {
  const queryClient = useQueryClient();
  const serverLayout = useMemo(() => layoutSelectionFromConfig(resp?.config.appearance.layout), [resp?.config.appearance.layout]);
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [layoutSelection, setLayoutSelection] = useState<DashboardLayoutSelection>(serverLayout);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [baseOrder, setBaseOrder] = useState<string[]>([]);
  const [retryOrder, setRetryOrder] = useState<string[] | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const cards = useMemo(() => cardsToOrderItems(resp), [resp]);
  const canMutateConfig = resp?.capabilities.canMutateConfig ?? false;
  const serverOrder = useMemo(() => cards.map((card) => card.id), [cards]);
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card] as const)), [cards]);

  const syncOrderFromServer = useCallback(() => {
    setOrderIds(serverOrder);
    setBaseOrder(serverOrder);
    setRetryOrder(null);
    setOrderError(null);
  }, [serverOrder]);

  const syncLayoutFromServer = useCallback(() => {
    setLayoutSelection(serverLayout);
    setLayoutError(null);
  }, [serverLayout]);

  const reorderMutation = useMutation({
    mutationFn: reorderDashboardCardsAction,
    onSuccess: async (_result, variables) => {
      setRetryOrder(null);
      setOrderError(null);
      await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      setBaseOrder(variables.order);
    },
    onError: (error, variables) => {
      if (error instanceof DashboardApiError && error.status === 409) {
        setOrderIds(baseOrder);
        setRetryOrder(null);
        setOrderError(`${error.message} Reloaded the latest dashboard order.`);
        void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
        return;
      }
      setRetryOrder(variables.order);
      setOrderError(errorMessage(error));
    },
  });

  const layoutMutation = useMutation({
    mutationFn: updateDashboardLayoutAction,
    onSuccess: async (_result, variables) => {
      setLayoutError(null);
      setLayoutSelection(layoutSelectionFromConfig(variables.layout));
      await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    },
    onError: (error) => {
      setLayoutSelection(serverLayout);
      setLayoutError(errorMessage(error));
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    },
  });
  const orderSaving = reorderMutation.isPending;
  const layoutSaving = layoutMutation.isPending;
  const pinnedLocalOrder = dragging || orderSaving || retryOrder !== null;

  const orderedCards = useMemo(() => {
    if (orderIds.length === 0) return cards;
    const ordered = orderIds.map((id) => cardsById.get(id)).filter((card): card is SortableCardOrderItem => Boolean(card));
    return ordered.length === cards.length ? ordered : cards;
  }, [cards, cardsById, orderIds]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const openSettings = useCallback(() => {
    clearCloseTimer();
    syncOrderFromServer();
    syncLayoutFromServer();
    setRendered(true);
    setOpen(true);
  }, [clearCloseTimer, syncLayoutFromServer, syncOrderFromServer]);

  const closeSettings = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      setRendered(false);
      triggerRef.current?.focus({ preventScroll: true });
      closeTimerRef.current = null;
    }, MODAL_EXIT_MS);
  }, [clearCloseTimer]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  useEffect(() => {
    if (!rendered) return;
    const previousOverflow = document.body.style.overflow;
    const appScroll = document.querySelector<HTMLElement>(".app-scroll");
    const previousAppOverflowY = appScroll?.style.overflowY ?? "";
    document.body.style.overflow = "hidden";
    // The dashboard owns scrolling in .app-scroll rather than body. Lock both
    // so an exhausted settings scroller cannot move the obscured dashboard.
    if (appScroll) appScroll.style.overflowY = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (appScroll) appScroll.style.overflowY = previousAppOverflowY;
    };
  }, [rendered]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (draggingRef.current) return;
        event.preventDefault();
        closeSettings();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeSettings, open]);

  useEffect(() => {
    if (!open || pinnedLocalOrder) return;
    if (sameOrder(serverOrder, baseOrder) && sameOrder(orderIds, serverOrder)) return;
    setOrderIds(serverOrder);
    setBaseOrder(serverOrder);
  }, [baseOrder, open, orderIds, pinnedLocalOrder, serverOrder]);

  useEffect(() => {
    if (!open || layoutSaving) return;
    setLayoutSelection(serverLayout);
  }, [layoutSaving, open, serverLayout]);

  const saveLayout = useCallback((nextLayout: DashboardLayoutSelection) => {
    const nextSelection = layoutSelectionFromConfig(nextLayout);
    setLayoutSelection(nextSelection);
    setLayoutError(null);
    if (sameLayoutSelection(nextSelection, serverLayout)) return;
    layoutMutation.mutate({ baseLayout: serverLayout, layout: nextSelection });
  }, [layoutMutation, serverLayout]);

  const saveOrder = useCallback((nextOrder: string[]) => {
    if (sameOrder(nextOrder, baseOrder)) {
      setOrderIds(nextOrder);
      return;
    }
    setOrderIds(nextOrder);
    setOrderError(null);
    setRetryOrder(null);
    reorderMutation.mutate({ baseOrder, order: nextOrder });
  }, [baseOrder, reorderMutation]);

  const retrySave = useCallback(() => {
    if (!retryOrder) return;
    setOrderError(null);
    reorderMutation.mutate({ baseOrder, order: retryOrder });
  }, [baseOrder, reorderMutation, retryOrder]);

  const resetAttempt = useCallback(() => {
    setOrderIds(baseOrder);
    setRetryOrder(null);
    setOrderError(null);
  }, [baseOrder]);

  const setDragActive = useCallback((active: boolean) => {
    draggingRef.current = active;
    setDragging(active);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Dashboard settings"
        title="Dashboard settings"
        onClick={openSettings}
        className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-header-border text-header-faint transition-colors hover:text-header-fg"
      >
        <Settings className="size-3.5" />
      </button>
      {rendered && (
        <div
          data-state={open ? "open" : "closed"}
          className="dashboard-settings-backdrop fixed inset-0 z-[70] flex items-stretch justify-center bg-canvas/70 p-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
          onPointerDown={(event) => {
            if (!dragging && event.target === event.currentTarget) closeSettings();
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="dashboard-settings-panel flex h-dvh min-h-0 w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-card pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] text-fg shadow-none sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:max-w-[28rem] sm:rounded-xl sm:border sm:border-border sm:p-4 sm:shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b-[0.5px] border-border pb-3">
              <div className="min-w-0">
                <h2 id={titleId} className="type-ui-md font-medium">
                  Dashboard settings
                </h2>
                <p className="font-mono type-ui-xs text-faint">{cards.length} cards</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close settings"
                title="Close"
                onClick={closeSettings}
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-faint transition-colors hover:bg-fg/[0.06] hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="dashboard-settings-content mt-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1">
              <DashboardThemeSettingsSection appearance={resp?.config.appearance} />

              <DashboardLayoutSettingsSection
                value={layoutSelection}
                disabled={!canMutateConfig || layoutSaving}
                readOnly={!canMutateConfig}
                saving={layoutSaving}
                error={layoutError}
                onChange={saveLayout}
              />

              <DashboardCardOrderSettingsSection
                cards={cards}
                orderedCards={orderedCards}
                tabs={resp?.config.tabs}
                canMutateConfig={canMutateConfig}
                saving={orderSaving}
                orderError={orderError}
                retryOrder={retryOrder}
                onOrderChange={saveOrder}
                onDragStateChange={setDragActive}
                onRetry={retrySave}
                onReset={resetAttempt}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
