import { describe, expect, test } from "bun:test";
import { commandSelectionAction, isTypeToSearchKey, shouldPreviewCommandResult } from "./CommandSearch";

function keyEvent(key: string, overrides: Partial<Parameters<typeof isTypeToSearchKey>[0]> = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    isComposing: false,
    key,
    metaKey: false,
    ...overrides,
  };
}

describe("type-to-search keyboard handling", () => {
  test("accepts unmodified letters and numbers in any script", () => {
    expect(isTypeToSearchKey(keyEvent("f"))).toBe(true);
    expect(isTypeToSearchKey(keyEvent("F"))).toBe(true);
    expect(isTypeToSearchKey(keyEvent("7"))).toBe(true);
    expect(isTypeToSearchKey(keyEvent("è"))).toBe(true);
    expect(isTypeToSearchKey(keyEvent("日"))).toBe(true);
  });

  test("ignores shortcuts, composition, and handled events", () => {
    expect(isTypeToSearchKey(keyEvent("f", { metaKey: true }))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("f", { ctrlKey: true }))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("f", { altKey: true }))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("f", { isComposing: true }))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("f", { defaultPrevented: true }))).toBe(false);
  });

  test("ignores navigation, whitespace, and punctuation", () => {
    expect(isTypeToSearchKey(keyEvent("Enter"))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("ArrowDown"))).toBe(false);
    expect(isTypeToSearchKey(keyEvent(" "))).toBe(false);
    expect(isTypeToSearchKey(keyEvent("/"))).toBe(false);
  });
});

describe("command result selection", () => {
  test("confirms a card while multiple results remain", () => {
    expect(commandSelectionAction("card", 3)).toBe("confirm-card");
    expect(shouldPreviewCommandResult("card", 3)).toBe(false);
  });

  test("selects and previews the sole card result", () => {
    expect(commandSelectionAction("card", 1)).toBe("select-card");
    expect(shouldPreviewCommandResult("card", 1)).toBe(true);
  });

  test("applies themes immediately without previewing them", () => {
    expect(commandSelectionAction("theme", 4)).toBe("apply-theme");
    expect(shouldPreviewCommandResult("theme", 1)).toBe(false);
  });
});
