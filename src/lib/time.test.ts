import { describe, expect, test } from "bun:test";
import { agoLabel } from "./time";

describe("agoLabel", () => {
  const now = Date.UTC(2026, 6, 8, 18, 0, 0);

  test("keeps recent times compact", () => {
    expect(agoLabel(now - 12_000, now)).toBe("12s ago");
    expect(agoLabel(now - 35 * 60_000, now)).toBe("35 min ago");
    expect(agoLabel(now - 3 * 60 * 60_000, now)).toBe("3h ago");
  });

  test("rolls long hour ranges into larger units", () => {
    expect(agoLabel(now - 161 * 60 * 60_000, now)).toBe("7d ago");
    expect(agoLabel(now - 418 * 60 * 60_000, now)).toBe("17d ago");
    expect(agoLabel(now - 45 * 24 * 60 * 60_000, now)).toBe("2mo ago");
    expect(agoLabel(now - 440 * 24 * 60 * 60_000, now)).toBe("1y ago");
  });
});
