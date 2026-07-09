import { describe, expect, test } from "bun:test";
import { MOBILE_COMMAND_PULL_THRESHOLD_PX, isMobileCommandPullAtTop, shouldOpenMobileCommandPull } from "./useMobileCommandPull";

describe("mobile command pull gesture", () => {
  test("opens after a mostly vertical pull crosses the threshold", () => {
    expect(shouldOpenMobileCommandPull(12, MOBILE_COMMAND_PULL_THRESHOLD_PX)).toBe(true);
  });

  test("does not open before the threshold", () => {
    expect(shouldOpenMobileCommandPull(0, MOBILE_COMMAND_PULL_THRESHOLD_PX - 1)).toBe(false);
  });

  test("does not open for mostly horizontal gestures", () => {
    expect(shouldOpenMobileCommandPull(80, MOBILE_COMMAND_PULL_THRESHOLD_PX)).toBe(false);
  });

  test("treats tiny scroll offsets as still being at the top", () => {
    expect(isMobileCommandPullAtTop(0)).toBe(true);
    expect(isMobileCommandPullAtTop(2)).toBe(true);
    expect(isMobileCommandPullAtTop(3)).toBe(false);
  });
});
