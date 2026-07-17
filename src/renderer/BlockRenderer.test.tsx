import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CardInteractionModeProvider } from "../components/CardInteractionMode";
import { transientTabSelections } from "../components/TabPills";
import { Blocks } from "./BlockRenderer";

const originalLocalStorage = globalThis.localStorage;

function installStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  let reads = 0;
  let writes = 0;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        reads += 1;
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        writes += 1;
        values.set(key, value);
      },
    },
  });
  return {
    reads: () => reads,
    writes: () => writes,
  };
}

afterEach(() => {
  transientTabSelections.clear();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalLocalStorage });
});

function renderBlocks(blocks: unknown[], data: Record<string, unknown>) {
  return renderToStaticMarkup(<Blocks blocks={blocks} data={data} storageKey="test" />);
}

function tabsBlock({ defaultTab = "portfolio", persist = true }: { defaultTab?: string; persist?: boolean } = {}) {
  return {
    id: "finances",
    type: "tabs",
    defaultTab,
    persist,
    tabs: [
      { id: "portfolio", label: "Portfolio", blocks: [{ type: "text", text: "Portfolio summary" }] },
      { id: "money", label: "Money", blocks: [{ type: "text", text: "Sensitive balances" }] },
    ],
  };
}

describe("Blocks", () => {
  test("hidden blocks do not leave empty wrappers", () => {
    expect(renderBlocks([
      { type: "text", text: "Hidden", visibleWhen: { path: "demo.show", equals: true } },
    ], { demo: { show: false } })).toBe("");
  });

  test("rows support visibleWhen without hiding meaningful zero values", () => {
    const html = renderBlocks([
      {
        type: "rows",
        rows: [
          { label: "Focus", value: "Deep Work", visibleWhen: { path: "demo.showFocus", equals: true } },
          { label: "CPU", valuePath: "demo.cpu", progressPath: "demo.cpuPct" },
        ],
      },
    ], { demo: { showFocus: false, cpu: "0%", cpuPct: 0 } });

    expect(html).not.toContain("Focus");
    expect(html).toContain("CPU");
    expect(html).toContain("0%");
  });

  test("visibleWhen can combine existence with an exact value check", () => {
    const html = renderBlocks([
      { type: "text", text: "Shown", visibleWhen: { path: "demo.value", exists: true, equals: 0 } },
      { type: "text", text: "Hidden", visibleWhen: { path: "demo.missing", exists: true, equals: 0 } },
    ], { demo: { value: 0 } });

    expect(html).toContain("Shown");
    expect(html).not.toContain("Hidden");
  });

  test("status and rows can render state values as badges", () => {
    const html = renderBlocks([
      {
        type: "status",
        label: "VPS",
        tonePath: "demo.tone",
        messagePath: "demo.headline",
        valuePath: "demo.gateway",
        valueTonePath: "demo.gatewayTone",
        valueVariant: "badge",
      },
      {
        type: "rows",
        rows: [
          { label: "Gateway", valuePath: "demo.gateway", valueTonePath: "demo.gatewayTone", valueVariant: "badge" },
          { label: "Model", valuePath: "demo.model" },
        ],
      },
    ], { demo: { tone: "success", headline: "Calm", gateway: "online", gatewayTone: "success", model: "gpt-5.5" } });

    expect(html).toContain("online");
    expect(html).toContain("gpt-5.5");
    expect(html).toContain("bg-success-soft");
    expect(html).toContain("Model");
  });

  test("metrics keep display values separate from their units", () => {
    const html = renderBlocks([
      { type: "metric", label: "Latency", value: "82", unit: "ms" },
    ], {});

    expect(html).toContain('class="truncate font-display');
    expect(html).toContain('<span class="ml-1 font-mono text-base text-muted">ms</span>');
  });

  test("grouped list section labels have room before their rows", () => {
    const html = renderBlocks([
      {
        type: "list",
        variant: "check",
        path: "demo.tasks",
        titlePath: "title",
        sectionPath: "project",
      },
    ], {
      demo: {
        tasks: [
          { project: "Inbox", title: "One" },
          { project: "M2C", title: "Two" },
        ],
      },
    });

    expect(html).toContain("Inbox");
    expect(html).toContain("flex flex-col gap-2");
  });

  test("check lists can dim stale items without marking them complete", () => {
    const html = renderBlocks([
      {
        type: "list",
        variant: "check",
        path: "demo.tasks",
        titlePath: "title",
        checkedPath: "done",
        mutedPath: "stale",
      },
    ], {
      demo: {
        tasks: [
          { title: "Fresh", done: false, stale: false },
          { title: "Old", done: false, stale: true },
        ],
      },
    });

    expect(html).toContain("Old");
    expect(html).toContain("opacity-55");
    expect(html).not.toContain("line-through\">Old");
  });

  test("unregistered actions render disabled instead of implying a working handler", () => {
    const html = renderBlocks([
      { type: "action-row", actions: [{ id: "inspect", label: "Inspect", display: "text", capability: "readOnly", disabled: false }] },
    ], {});

    expect(html).toContain("Inspect");
    expect(html).toContain('disabled=""');
  });

  test("non-persisted tabs ignore storage and honor a non-first default", () => {
    const storage = installStorage({ "dashboard:tab:test:finances": "portfolio" });
    const html = renderBlocks([tabsBlock({ defaultTab: "money", persist: false })], {});

    expect(html).toContain("Sensitive balances");
    expect(html).not.toContain("Portfolio summary");
    expect(storage.reads()).toBe(0);
    expect(storage.writes()).toBe(0);
  });

  test("non-persisted tabs restore an in-page selection across card remounts", () => {
    const storage = installStorage({ "dashboard:tab:test:finances": "portfolio" });
    transientTabSelections.remember("test:finances", "money");
    const html = renderBlocks([tabsBlock({ persist: false })], {});

    expect(html).toContain("Sensitive balances");
    expect(html).not.toContain("Portfolio summary");
    expect(storage.reads()).toBe(0);
    expect(storage.writes()).toBe(0);
  });

  test("preview tabs ignore persisted and in-page sensitive selections", () => {
    const storage = installStorage({ "dashboard:tab:test:finances": "money" });
    transientTabSelections.remember("test:finances", "money");
    const html = renderToStaticMarkup(
      <CardInteractionModeProvider mode="preview">
        <Blocks blocks={[tabsBlock()]} data={{}} storageKey="test" />
      </CardInteractionModeProvider>,
    );

    expect(html).toContain("Portfolio summary");
    expect(html).not.toContain("Sensitive balances");
    expect(storage.reads()).toBe(0);
    expect(storage.writes()).toBe(0);
  });

  test("invalid tab defaults fall back to the first tab", () => {
    installStorage();
    const html = renderBlocks([tabsBlock({ defaultTab: "missing", persist: false })], {});

    expect(html).toContain("Portfolio summary");
    expect(html).not.toContain("Sensitive balances");
  });

  test("persisted dashboard tabs keep restoring a valid stored selection", () => {
    const storage = installStorage({ "dashboard:tab:test:finances": "money" });
    const html = renderBlocks([tabsBlock()], {});

    expect(html).toContain("Sensitive balances");
    expect(html).not.toContain("Portfolio summary");
    expect(storage.reads()).toBe(1);
  });
});
