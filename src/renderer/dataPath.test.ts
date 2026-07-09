import { describe, expect, test } from "bun:test";
import { safeHref, safeSrc } from "./dataPath";

describe("safeHref", () => {
  test("allows web, mail, relative, and explicitly allowlisted app URLs", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("http://example.com")).toBe("http://example.com");
    expect(safeHref("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(safeHref("/local/path", "http://127.0.0.1")).toBe("/local/path");
    expect(safeHref("things:///show?id=1")).toBe("things:///show?id=1");
  });

  test("rejects unsafe or surprising protocols", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,hello")).toBeNull();
    expect(safeHref("file:///tmp/example-secret")).toBeNull();
  });
});

describe("safeSrc", () => {
  test("allows http, https, and relative media URLs", () => {
    expect(safeSrc("https://images.example.com/art.jpg")).toBe("https://images.example.com/art.jpg");
    expect(safeSrc("http://images.example.com/art.jpg")).toBe("http://images.example.com/art.jpg");
    expect(safeSrc("/assets/art.jpg", "http://127.0.0.1")).toBe("/assets/art.jpg");
  });

  test("rejects non-media protocols", () => {
    expect(safeSrc("mailto:hello@example.com")).toBeNull();
    expect(safeSrc("javascript:alert(1)")).toBeNull();
    expect(safeSrc("data:image/svg+xml,<svg></svg>")).toBeNull();
    expect(safeSrc("file:///tmp/example-secret.jpg")).toBeNull();
  });
});
