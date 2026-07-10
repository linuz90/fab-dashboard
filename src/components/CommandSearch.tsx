import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { setTheme } from "../lib/theme";
import { MOBILE_COMMAND_PULL_MEDIA } from "../lib/useMobileCommandPull";
import type { DashboardResponse, ResolvedCard } from "../shared/schemas";
import { resolveSelectableThemes, themeLabel, themeSearchText, type ThemeId } from "../shared/themes";
import { CardInteractionModeProvider } from "./CardInteractionMode";
import { DashboardCard } from "./DashboardCard";

const CARD_SIGNAL_CLASS = "dashboard-card-command-target";
const CARD_SIGNAL_MS = 1800;
const cardSignalTimers = new WeakMap<HTMLElement, number[]>();

type TypeToSearchKeyEvent = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "defaultPrevented" | "isComposing" | "key" | "metaKey">;

function isUnmodifiedCharacterKey(event: TypeToSearchKeyEvent): boolean {
  if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return false;
  return Array.from(event.key).length === 1;
}

export function isTypeToSearchKey(event: TypeToSearchKeyEvent): boolean {
  return isUnmodifiedCharacterKey(event) && /^[\p{L}\p{N}]$/u.test(event.key);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="searchbox"], [cmdk-input]'
    )
  );
}

function supportsDesktopTypeToSearch(): boolean {
  return typeof window.matchMedia !== "function" || !window.matchMedia(MOBILE_COMMAND_PULL_MEDIA).matches;
}

function canOpenFromTyping(event: KeyboardEvent): boolean {
  return supportsDesktopTypeToSearch() && isTypeToSearchKey(event) && !isEditableTarget(event.target);
}

function canAppendWhileOpening(event: KeyboardEvent): boolean {
  return isUnmodifiedCharacterKey(event) && !isEditableTarget(event.target);
}

function hasBlockingDashboardSurface(): boolean {
  return Boolean(document.querySelector(".dashboard-settings-panel"));
}

export function dashboardCardDomId(id: string): string {
  return `dashboard-card-${id}`;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToDashboardCard(cardId: string) {
  const target = document.getElementById(dashboardCardDomId(cardId));
  if (!target) return;
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
}

type CommandResult =
  | {
      kind: "card";
      value: string;
      title: string;
      detail: "card";
      card: ResolvedCard;
    }
  | {
      kind: "theme";
      value: string;
      title: string;
      detail: "theme";
      theme: ThemeId;
    };

export function commandSelectionAction(kind: CommandResult["kind"], resultCount: number): "apply-theme" | "confirm-card" | "select-card" {
  if (kind === "theme") return "apply-theme";
  return resultCount === 1 ? "select-card" : "confirm-card";
}

export function shouldPreviewCommandResult(kind: CommandResult["kind"] | null, resultCount: number): boolean {
  return kind === "card" && resultCount === 1;
}

function PreviewCard({ card, now }: { card: ResolvedCard; now: number }) {
  return (
    <div className="dashboard-command-preview">
      <div className="dashboard-command-preview-content" inert aria-hidden="true">
        <CardInteractionModeProvider mode="preview">
          <DashboardCard card={card} now={now} />
        </CardInteractionModeProvider>
      </div>
    </div>
  );
}

export function CommandSearch({
  resp,
  now,
  open,
  onOpenChange,
}: {
  resp: DashboardResponse | null;
  now: number;
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
}) {
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const [confirmedCardId, setConfirmedCardId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The next character can arrive before React re-renders with open=true.
  const openRef = useRef(open);
  const queryResetTimerRef = useRef<number | null>(null);
  const selectionQueryRef = useRef<string | null>(null);
  const enabled = Boolean(resp);
  const cards = resp?.cards ?? [];
  const themes = useMemo(() => resolveSelectableThemes(resp?.config.appearance), [resp?.config.appearance]);
  const normalizedQuery = query.trim().toLowerCase();
  const allResults = useMemo<CommandResult[]>(() => {
    const matches = (value: string) => value.toLowerCase().includes(normalizedQuery);
    return [
      ...cards
        .filter((card) =>
          matches(
            [card.instance.title, card.instance.id, card.instance.type, ...card.instance.keywords, ...card.definition?.keywords ?? []].join(" ")
          )
        )
        .map((card) => ({
          kind: "card" as const,
          value: `card-${card.instance.id}`,
          title: card.instance.title,
          detail: "card" as const,
          card,
        })),
      ...themes.filter((theme) => matches(themeSearchText(theme))).map((theme) => ({
        kind: "theme" as const,
        value: `theme-${theme}`,
        title: themeLabel(theme),
        detail: "theme" as const,
        theme,
      })),
    ];
  }, [cards, normalizedQuery, themes]);
  const confirmedResult = confirmedCardId
    ? (allResults.find((result) => result.kind === "card" && result.card.instance.id === confirmedCardId) ?? null)
    : null;
  const results = confirmedResult ? [confirmedResult] : allResults;
  const selectedResult = results.find((result) => result.value === selectedValue) ?? results[0] ?? null;
  const previewCard = shouldPreviewCommandResult(results[0]?.kind ?? null, results.length) && results[0]?.kind === "card" ? results[0].card : null;

  const moveCaretToEnd = useCallback(() => {
    window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }, []);

  const changeOpen = useCallback(
    (nextOpen: boolean) => {
      openRef.current = nextOpen;
      if (nextOpen && queryResetTimerRef.current !== null) {
        window.clearTimeout(queryResetTimerRef.current);
        queryResetTimerRef.current = null;
        setQuery("");
      }
      if (!nextOpen) {
        selectionQueryRef.current = null;
        setConfirmedCardId(null);
        setSelectedValue("");
        if (queryResetTimerRef.current !== null) window.clearTimeout(queryResetTimerRef.current);
        queryResetTimerRef.current = window.setTimeout(() => {
          setQuery("");
          queryResetTimerRef.current = null;
        }, 140);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!enabled) return;

      if (!openRef.current && hasBlockingDashboardSurface()) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        changeOpen(!openRef.current);
        return;
      }

      if (openRef.current) {
        if (!canAppendWhileOpening(event)) return;
        event.preventDefault();
        setConfirmedCardId(null);
        setQuery((current) => current + event.key);
        return;
      }

      if (!canOpenFromTyping(event)) return;
      event.preventDefault();
      if (queryResetTimerRef.current !== null) {
        window.clearTimeout(queryResetTimerRef.current);
        queryResetTimerRef.current = null;
      }
      openRef.current = true;
      setConfirmedCardId(null);
      setSelectedValue("");
      setQuery(event.key);
      changeOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [changeOpen, enabled]);

  useEffect(() => {
    if (!open) return;
    const firstValue = results[0]?.value ?? "";
    if (selectionQueryRef.current !== query) {
      selectionQueryRef.current = query;
      setSelectedValue(firstValue);
      return;
    }
    if (!results.some((result) => result.value === selectedValue)) setSelectedValue(firstValue);
  }, [open, query, results, selectedValue]);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      if (queryResetTimerRef.current !== null) {
        window.clearTimeout(queryResetTimerRef.current);
        queryResetTimerRef.current = null;
        setQuery("");
      }
      // Chrome can select the seeded character while cmdk moves focus, causing
      // the second typed character to replace the first one.
      moveCaretToEnd();
    }
  }, [moveCaretToEnd, open]);

  useEffect(() => {
    return () => {
      if (queryResetTimerRef.current !== null) window.clearTimeout(queryResetTimerRef.current);
    };
  }, []);

  function closeCommand() {
    changeOpen(false);
  }

  function selectCard(id: string) {
    closeCommand();
    window.requestAnimationFrame(() => scrollToDashboardCard(id));
  }

  function pickTheme(theme: ThemeId) {
    setTheme(theme);
    closeCommand();
  }

  function confirmOrSelectResult(value: string) {
    const result = results.find((candidate) => candidate.value === value);
    if (!result) return;
    const action = commandSelectionAction(result.kind, results.length);

    if (action === "apply-theme" && result.kind === "theme") {
      pickTheme(result.theme);
      return;
    }
    if (result.kind !== "card") return;

    const cardId = result.card.instance.id;
    if (action === "select-card") {
      selectCard(cardId);
      return;
    }

    setConfirmedCardId(cardId);
    setSelectedValue(result.value);
    setQuery(result.card.instance.title);
    moveCaretToEnd();
  }

  if (!resp) return null;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={changeOpen}
      label="Search dashboard cards and themes"
      shouldFilter={false}
      loop
      value={selectedResult?.value ?? ""}
      onValueChange={setSelectedValue}
      overlayClassName="dashboard-command-overlay"
      contentClassName="dashboard-command-dialog"
      className="dashboard-command-root"
    >
      <div className="dashboard-command-input-wrap">
        <Search className="dashboard-command-search-icon" aria-hidden="true" />
        <Command.Input
          ref={inputRef}
          value={query}
          onValueChange={(nextQuery) => {
            setConfirmedCardId(null);
            setQuery(nextQuery);
          }}
          autoFocus
          placeholder="Search cards or themes"
          className="dashboard-command-input"
        />
      </div>

      <Command.List className="dashboard-command-list" label="Dashboard commands">
        {results.map((result) => (
          <Command.Item
            key={result.value}
            value={result.value}
            onSelect={() => confirmOrSelectResult(result.value)}
            className="dashboard-command-item"
          >
            <span className="dashboard-command-item-title">{result.title}</span>
            <span className="dashboard-command-item-detail">{result.detail}</span>
          </Command.Item>
        ))}
        <Command.Empty className="dashboard-command-empty">No commands</Command.Empty>
      </Command.List>

      {previewCard && (
        <>
          <span className="sr-only" role="status" aria-live="polite">
            {previewCard.instance.title} card preview. Press Enter to go to this card, or keep typing to search again.
          </span>
          <PreviewCard key={previewCard.instance.id} card={previewCard} now={now} />
        </>
      )}
    </Command.Dialog>
  );
}
