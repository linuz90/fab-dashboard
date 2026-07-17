import type { DashboardTab } from "../shared/schemas";

export interface DashboardTabUrlSelection {
  activeTabId: string | null;
  canonicalUrl: URL;
  shouldReplace: boolean;
}

function cloneUrl(url: URL | string): URL {
  return new URL(url.toString());
}

/** Builds a same-page dashboard view URL while preserving unrelated query
 * parameters and the hash. The first tab is canonical at the parameter-free
 * URL, and invalid targets fall back to that first tab. */
export function dashboardTabUrl(
  currentUrl: URL | string,
  tabs: readonly Pick<DashboardTab, "id">[] | null | undefined,
  requestedTabId: string | null | undefined,
): URL {
  const nextUrl = cloneUrl(currentUrl);
  const defaultTabId = tabs?.[0]?.id ?? null;
  const requestedIsKnown = Boolean(requestedTabId && tabs?.some((tab) => tab.id === requestedTabId));
  const activeTabId = requestedIsKnown ? requestedTabId : defaultTabId;

  if (!activeTabId || activeTabId === defaultTabId) {
    nextUrl.searchParams.delete("tab");
  } else {
    nextUrl.searchParams.set("tab", activeTabId);
  }
  return nextUrl;
}

/** Resolves the active dashboard view from the URL and returns its canonical
 * form. Consumers can use shouldReplace with history.replaceState so default,
 * invalid, duplicate, or stale tab parameters never add a history entry. */
export function resolveDashboardTabUrl(
  currentUrl: URL | string,
  tabs: readonly Pick<DashboardTab, "id">[] | null | undefined,
): DashboardTabUrlSelection {
  const sourceUrl = cloneUrl(currentUrl);
  const defaultTabId = tabs?.[0]?.id ?? null;
  const requestedTabId = sourceUrl.searchParams.get("tab");
  const activeTabId = requestedTabId && tabs?.some((tab) => tab.id === requestedTabId)
    ? requestedTabId
    : defaultTabId;
  const canonicalUrl = dashboardTabUrl(sourceUrl, tabs, activeTabId);

  return {
    activeTabId,
    canonicalUrl,
    shouldReplace: canonicalUrl.href !== sourceUrl.href,
  };
}

function assertUnique(label: string, ids: readonly string[]): void {
  if (new Set(ids).size !== ids.length) throw new Error(`${label} must contain unique card ids`);
}

/** Reorders one tab inside the dashboard's flat source order. Slots occupied by
 * every other tab stay fixed, which lets the existing exact-permutation API
 * persist grouped settings without introducing a second ordering model. */
export function mergeWithinTabCardOrder(
  dashboardOrder: readonly string[],
  currentTabOrder: readonly string[],
  nextTabOrder: readonly string[],
): string[] {
  assertUnique("dashboardOrder", dashboardOrder);
  assertUnique("currentTabOrder", currentTabOrder);
  assertUnique("nextTabOrder", nextTabOrder);

  const dashboardIds = new Set(dashboardOrder);
  for (const id of currentTabOrder) {
    if (!dashboardIds.has(id)) throw new Error(`currentTabOrder contains unknown card id "${id}"`);
  }

  const currentTabIds = new Set(currentTabOrder);
  if (
    nextTabOrder.length !== currentTabOrder.length ||
    nextTabOrder.some((id) => !currentTabIds.has(id))
  ) {
    throw new Error("nextTabOrder must be an exact permutation of currentTabOrder");
  }

  let nextIndex = 0;
  return dashboardOrder.map((id) => currentTabIds.has(id) ? nextTabOrder[nextIndex++]! : id);
}
