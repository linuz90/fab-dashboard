import { useEffect, useRef, type MouseEvent } from "react";
import type { DashboardTab } from "../shared/schemas";

function shouldHandleNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.currentTarget.target !== "_blank"
  );
}

export function DashboardTabs({
  tabs,
  activeTabId,
  hrefForTab,
  onNavigate,
}: {
  tabs: readonly DashboardTab[];
  activeTabId: string;
  hrefForTab: (tabId: string) => string;
  onNavigate: (tabId: string) => void;
}) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const activeLink = nav?.querySelector<HTMLElement>(`[data-dashboard-tab-id="${activeTabId}"]`);
    if (!nav || !activeLink) return;

    const linkLeft = activeLink.offsetLeft;
    const linkRight = linkLeft + activeLink.offsetWidth;
    const visibleLeft = nav.scrollLeft;
    const visibleRight = visibleLeft + nav.clientWidth;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (linkLeft < visibleLeft) nav.scrollTo({ left: Math.max(0, linkLeft - 8), behavior });
    else if (linkRight > visibleRight) nav.scrollTo({ left: linkRight - nav.clientWidth + 8, behavior });
  }, [activeTabId]);

  return (
    <nav ref={navRef} aria-label="Dashboard views" className="dashboard-tabs">
      {tabs.map((tab) => (
        <a
          key={tab.id}
          href={hrefForTab(tab.id)}
          aria-current={tab.id === activeTabId ? "page" : undefined}
          data-dashboard-tab-id={tab.id}
          className="dashboard-tab-link"
          title={tab.label}
          onClick={(event) => {
            if (!shouldHandleNavigation(event)) return;
            event.preventDefault();
            onNavigate(tab.id);
          }}
        >
          <span className="dashboard-tab-label">{tab.label}</span>
        </a>
      ))}
    </nav>
  );
}
