import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { setTheme } from "../lib/theme";
import type { DashboardResponse } from "../shared/schemas";
import { resolveSelectableThemes, themeLabel, themeSearchText, type ThemeId } from "../shared/themes";

export function dashboardCardDomId(id: string): string {
  return `dashboard-card-${id}`;
}

export function CommandSearch({
  resp,
  open,
  onOpenChange,
}: {
  resp: DashboardResponse | null;
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
}) {
  const [query, setQuery] = useState("");
  const queryResetTimerRef = useRef<number | null>(null);
  const cards = resp?.cards ?? [];
  const themes = useMemo(() => resolveSelectableThemes(resp?.config.appearance), [resp?.config.appearance]);
  const normalizedQuery = query.trim().toLowerCase();
  const cardItems = useMemo(
    () =>
      cards.map((card) => ({
        id: card.instance.id,
        title: card.instance.title,
        search: [card.instance.title, card.instance.id, card.instance.type, ...card.instance.keywords, ...card.definition?.keywords ?? []].join(" "),
      })),
    [cards]
  );
  const results = useMemo(() => {
    const matches = (value: string) => value.toLowerCase().includes(normalizedQuery);
    return [
      ...cardItems
        .filter((item) => matches(item.search))
        .map((item) => ({
          value: `card-${item.id}`,
          title: item.title,
          detail: "card",
          onSelect: () => goToCard(item.id),
        })),
      ...themes.filter((theme) => matches(themeSearchText(theme))).map((theme) => ({
        value: `theme-${theme}`,
        title: themeLabel(theme),
        detail: "theme",
        onSelect: () => pickTheme(theme),
      })),
    ];
  }, [cardItems, normalizedQuery, themes]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  useEffect(() => {
    return () => {
      if (queryResetTimerRef.current !== null) window.clearTimeout(queryResetTimerRef.current);
    };
  }, []);

  function closeAfterSelection() {
    onOpenChange(false);
    if (queryResetTimerRef.current !== null) window.clearTimeout(queryResetTimerRef.current);
    queryResetTimerRef.current = window.setTimeout(() => {
      setQuery("");
      queryResetTimerRef.current = null;
    }, 140);
  }

  function goToCard(id: string) {
    closeAfterSelection();
    document.getElementById(dashboardCardDomId(id))?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function pickTheme(theme: ThemeId) {
    setTheme(theme);
    closeAfterSelection();
  }

  if (!resp) return null;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search dashboard cards and themes"
      shouldFilter={false}
      loop
      overlayClassName="dashboard-command-overlay"
      contentClassName="dashboard-command-dialog"
      className="dashboard-command-root"
    >
      <div className="dashboard-command-input-wrap">
        <Search className="dashboard-command-search-icon" aria-hidden="true" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          autoFocus
          placeholder="Search cards or themes"
          className="dashboard-command-input"
        />
      </div>

      <Command.List className="dashboard-command-list" label="Dashboard commands">
        {results.map((result) => (
          <Command.Item key={result.value} value={result.value} onSelect={result.onSelect} className="dashboard-command-item">
            <span className="dashboard-command-item-title">{result.title}</span>
            <span className="dashboard-command-item-detail">{result.detail}</span>
          </Command.Item>
        ))}
        <Command.Empty className="dashboard-command-empty">No commands</Command.Empty>
      </Command.List>
    </Command.Dialog>
  );
}
