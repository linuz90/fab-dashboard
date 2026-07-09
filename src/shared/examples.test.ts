import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePath } from "../renderer/dataPath";
import { cardDefinitionSchema, connectorManifestSchema, dashboardConfigSchema } from "./schemas";

const root = process.cwd();
const publicDemoDenylist = [
  /\/Users\/linuz90/,
  /linuz90/i,
  /Typefully/i,
  /Lisbon/i,
  /Slack/i,
  /Bouncy Bouncy/i,
  /Todd Terje/i,
  /Cocteau Twins/i,
  /Kavinsky/i,
  /LCD Soundsystem/i,
  /Four Tet/i,
  /images\.unsplash\.com/i,
];

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function exampleJsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return exampleJsonFiles(path);
    return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
  });
}

function expectDataPath(context: Record<string, unknown>, path: unknown, owner: string) {
  if (typeof path !== "string") return;
  expect(resolvePath(context, path), `${owner} -> ${path}`).not.toBeUndefined();
}

function validateBlockPaths(block: Record<string, unknown>, data: Record<string, unknown>, owner: string) {
  expectDataPath(data, asRecord(block.visibleWhen).path, `${owner}.visibleWhen`);

  switch (block.type) {
    case "text":
      expectDataPath(data, block.path, `${owner}.text`);
      break;
    case "metric":
      for (const key of ["valuePath", "pillPath", "deltaPath", "sparklinePath", "tonePath"]) {
        expectDataPath(data, block[key], `${owner}.${key}`);
      }
      break;
    case "rows":
      if (Array.isArray(block.rows)) {
        for (const [index, row] of block.rows.map(asRecord).entries()) {
          expectDataPath(data, asRecord(row.visibleWhen).path, `${owner}.rows[${index}].visibleWhen`);
          for (const key of ["valuePath", "tonePath", "valueTonePath", "hintPath", "progressPath", "sparklinePath"]) {
            expectDataPath(data, row[key], `${owner}.rows[${index}].${key}`);
          }
        }
      }
      break;
    case "allocation": {
      expectDataPath(data, block.path, `${owner}.path`);
      const items = typeof block.path === "string" ? resolvePath(data, block.path) : [];
      expect(Array.isArray(items), `${owner}.path must resolve to an array`).toBe(true);
      if (Array.isArray(items)) {
        for (const [index, item] of items.map(asRecord).entries()) {
          for (const key of ["keyPath", "labelPath", "valuePath", "valueLabelPath", "metaPath", "tonePath"]) {
            expectDataPath(item, block[key], `${owner}.items[${index}].${key}`);
          }
        }
      }
      break;
    }
    case "leaderboard": {
      expectDataPath(data, block.path, `${owner}.path`);
      const items = typeof block.path === "string" ? resolvePath(data, block.path) : [];
      expect(Array.isArray(items), `${owner}.path must resolve to an array`).toBe(true);
      if (Array.isArray(items)) {
        for (const [index, item] of items.map(asRecord).entries()) {
          for (const key of ["rankPath", "titlePath", "subtitlePath", "valuePath", "deltaPath", "colorKeyPath", "progressPath"]) {
            expectDataPath(item, block[key], `${owner}.items[${index}].${key}`);
          }
        }
      }
      break;
    }
    case "list": {
      expectDataPath(data, block.path, `${owner}.path`);
      const items = typeof block.path === "string" ? resolvePath(data, block.path) : [];
      expect(Array.isArray(items), `${owner}.path must resolve to an array`).toBe(true);
      if (Array.isArray(items)) {
        for (const [index, item] of items.map(asRecord).entries()) {
          expectDataPath(item, block.titlePath, `${owner}.items[${index}].titlePath`);
        }

        for (const key of [
          "metaPath",
          "textPath",
          "hrefPath",
          "sectionPath",
          "iconPath",
          "tonePath",
          "checkedPath",
          "mutedPath",
          "imagePath",
          "chipsPath",
          "countPath",
          "progressPath",
        ]) {
          if (typeof block[key] !== "string") continue;
          const hasPath = items.map(asRecord).some((item) => resolvePath(item, block[key] as string) !== undefined);
          if (!hasPath) {
            expectDataPath(items.map(asRecord)[0] ?? {}, block[key], `${owner}.items.*.${key}`);
          }
        }
      }
      break;
    }
    case "status":
      for (const key of ["tonePath", "messagePath", "valuePath"]) {
        expectDataPath(data, block[key], `${owner}.${key}`);
      }
      break;
    case "sparkline":
      expectDataPath(data, block.path, `${owner}.path`);
      break;
    case "group":
      if (Array.isArray(block.blocks)) {
        for (const [index, child] of block.blocks.map(asRecord).entries()) {
          validateBlockPaths(child, data, `${owner}.blocks[${index}]`);
        }
      }
      break;
    case "tabs":
      if (Array.isArray(block.tabs)) {
        for (const tab of block.tabs.map(asRecord)) {
          const tabId = typeof tab.id === "string" ? tab.id : "tab";
          if (!Array.isArray(tab.blocks)) continue;
          for (const [index, child] of tab.blocks.map(asRecord).entries()) {
            validateBlockPaths(child, data, `${owner}.tabs.${tabId}[${index}]`);
          }
        }
      }
      break;
  }
}

describe("example fixtures", () => {
  test("card templates stay schema-valid", () => {
    for (const file of exampleJsonFiles(join(root, "templates/cards"))) {
      cardDefinitionSchema.parse(readJson(file));
    }
  });

  test("card data paths resolve against example connector payloads", () => {
    const connectorData: Record<string, unknown> = {};
    for (const file of exampleJsonFiles(join(root, "examples/connectors"))) {
      const connector = connectorManifestSchema.parse(readJson(file));
      if (connector.kind === "static") connectorData[connector.id] = connector.data;
    }

    for (const file of exampleJsonFiles(join(root, "examples/cards"))) {
      const card = cardDefinitionSchema.parse(readJson(file));
      for (const connectorId of card.connectors) {
        expect(connectorData[connectorId], `${file} connector ${connectorId}`).not.toBeUndefined();
      }

      const data = Object.fromEntries(card.connectors.map((id) => [id, connectorData[id]]));
      for (const [index, block] of card.blocks.map(asRecord).entries()) {
        validateBlockPaths(block, data, `${file}.blocks[${index}]`);
      }
    }

    const dashboard = dashboardConfigSchema.parse(readJson(join(root, "examples/dashboard.demo.json")));
    for (const [index, widget] of dashboard.header.widgets.entries()) {
      expect(connectorData[widget.connector], `header widget ${widget.id} connector ${widget.connector}`).not.toBeUndefined();
      const data = { [widget.connector]: connectorData[widget.connector] };
      if (widget.kind === "weather") {
        expectDataPath(data, widget.path, `header.widgets[${index}].path`);
        continue;
      }
      for (const key of ["labelPath", "tooltipPath", "tonePath", "hrefPath"] as const) {
        expectDataPath(data, widget[key], `header.widgets[${index}].${key}`);
      }
    }
  });

  test("public examples stay free of private-looking demo data", () => {
    for (const file of exampleJsonFiles(join(root, "examples"))) {
      const source = JSON.stringify(readJson(file));
      for (const pattern of publicDemoDenylist) {
        expect(source, file).not.toMatch(pattern);
      }
    }
  });
});
