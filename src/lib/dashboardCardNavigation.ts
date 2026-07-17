const CARD_SIGNAL_CLASS = "dashboard-card-command-target";
const CARD_SIGNAL_MS = 1800;
const cardSignalTimers = new WeakMap<HTMLElement, number[]>();

export function dashboardCardDomId(id: string): string {
  return `dashboard-card-${id}`;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scrolls only after App has mounted the owning dashboard tab. Keeping this
 * outside command search prevents cross-tab selection from racing React's
 * commit and signaling a card that is not in the DOM yet. */
export function scrollToDashboardCard(cardId: string): boolean {
  const target = document.getElementById(dashboardCardDomId(cardId));
  if (!target) return false;

  const reducedMotion = prefersReducedMotion();
  for (const timer of cardSignalTimers.get(target) ?? []) window.clearTimeout(timer);
  target.scrollIntoView({
    block: "center",
    behavior: reducedMotion ? "auto" : "smooth",
  });

  // Start the cue after the smooth scroll has mostly settled around the card.
  const startTimer = window.setTimeout(
    () => {
      target.classList.remove(CARD_SIGNAL_CLASS);
      // Force a fresh animation when the same card is selected repeatedly.
      void target.offsetWidth;
      target.classList.add(CARD_SIGNAL_CLASS);
      const removeTimer = window.setTimeout(() => {
        target.classList.remove(CARD_SIGNAL_CLASS);
        cardSignalTimers.delete(target);
      }, CARD_SIGNAL_MS);
      cardSignalTimers.set(target, [removeTimer]);
    },
    reducedMotion ? 0 : 300
  );
  cardSignalTimers.set(target, [startTimer]);
  return true;
}
