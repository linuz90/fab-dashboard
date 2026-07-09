import { useEffect, useRef, type RefObject } from "react";

export const MOBILE_COMMAND_PULL_THRESHOLD_PX = 72;
export const MOBILE_COMMAND_PULL_MEDIA = "(hover: none) and (pointer: coarse)";

const TOP_TOLERANCE_PX = 2;
const INTERACTIVE_PULL_TARGET_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[role='button']",
  "[role='dialog']",
  "[role='link']",
  "[role='menu']",
  "[role='menuitem']",
  "[role='menuitemradio']",
  "[role='tab']",
  ".dashboard-settings-backdrop",
  ".dashboard-command-overlay",
  ".dashboard-command-dialog",
].join(",");

type PullState = {
  tracking: boolean;
  armed: boolean;
  startX: number;
  startY: number;
};

export function shouldOpenMobileCommandPull(deltaX: number, deltaY: number, thresholdPx = MOBILE_COMMAND_PULL_THRESHOLD_PX): boolean {
  if (deltaY < thresholdPx) return false;
  return deltaY > Math.abs(deltaX) * 1.25;
}

export function isInteractivePullTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined") return false;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(INTERACTIVE_PULL_TARGET_SELECTOR));
}

export function isMobileCommandPullAtTop(scrollTop: number, tolerancePx = TOP_TOLERANCE_PX): boolean {
  return scrollTop <= tolerancePx;
}

function isScrollSurfaceAtTop(scrollContainer: HTMLElement | null): boolean {
  if (scrollContainer) return isMobileCommandPullAtTop(scrollContainer.scrollTop);
  const rootTop = document.scrollingElement?.scrollTop ?? document.documentElement.scrollTop;
  return isMobileCommandPullAtTop(Math.max(window.scrollY, rootTop, document.body.scrollTop));
}

export function useMobileCommandPull({
  enabled,
  open,
  onOpen,
  scrollContainerRef,
}: {
  enabled: boolean;
  open: boolean;
  onOpen: () => void;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}) {
  const state = useRef<PullState>({ tracking: false, armed: false, startX: 0, startY: 0 });
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    if (!enabled || open) return;

    const supportsMobilePull = () => typeof window.matchMedia !== "function" || window.matchMedia(MOBILE_COMMAND_PULL_MEDIA).matches;
    const reset = () => {
      state.current = { tracking: false, armed: false, startX: 0, startY: 0 };
    };
    const isAtTop = () => isScrollSurfaceAtTop(scrollContainerRef?.current ?? null);

    const onTouchStart = (event: TouchEvent) => {
      if (
        !supportsMobilePull() ||
        event.touches.length !== 1 ||
        document.body.style.overflow === "hidden" ||
        isInteractivePullTarget(event.target)
      ) {
        reset();
        return;
      }

      const touch = event.touches[0];
      if (!touch) return;
      state.current = {
        tracking: true,
        armed: isAtTop(),
        startX: touch.clientX,
        startY: touch.clientY,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const current = state.current;
      if (!current.tracking || event.touches.length !== 1) return;

      const touch = event.touches[0];
      if (!touch) return;

      if (!current.armed) {
        // Arm at the moment the page reaches the top so a normal scroll-to-top
        // can continue into the pull gesture without reopening during mid-page scrolls.
        if (!isAtTop()) return;
        current.armed = true;
        current.startX = touch.clientX;
        current.startY = touch.clientY;
      }

      const deltaX = touch.clientX - current.startX;
      const deltaY = touch.clientY - current.startY;
      if (deltaY < -8 || (Math.abs(deltaX) > 36 && Math.abs(deltaX) > deltaY)) {
        reset();
        return;
      }

      if (shouldOpenMobileCommandPull(deltaX, deltaY)) {
        reset();
        onOpenRef.current();
      }
    };

    const touchOptions: AddEventListenerOptions = { passive: true };
    window.addEventListener("touchstart", onTouchStart, touchOptions);
    window.addEventListener("touchmove", onTouchMove, touchOptions);
    window.addEventListener("touchend", reset, touchOptions);
    window.addEventListener("touchcancel", reset, touchOptions);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", reset);
      window.removeEventListener("touchcancel", reset);
    };
  }, [enabled, open, scrollContainerRef]);
}
