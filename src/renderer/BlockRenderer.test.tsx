import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Blocks } from "./BlockRenderer";

function renderBlocks(blocks: unknown[], data: Record<string, unknown>) {
  return renderToStaticMarkup(<Blocks blocks={blocks} data={data} storageKey="test" onRefresh={() => undefined} />);
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

  test("refresh-only action rows are promoted out of content", () => {
    expect(renderBlocks([
      { type: "action-row", actions: [{ id: "refresh", label: "Refresh", icon: "refresh-cw", display: "icon", capability: "readOnly", disabled: false }] },
    ], {})).toBe("");
  });
});
