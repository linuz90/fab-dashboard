import { describe, expect, test } from "bun:test";
import { configMutationsAllowed, normalizeHostname, requestCanMutateConfig } from "./security";

function request(url: string, headers: HeadersInit = {}) {
  return new Request(url, { headers });
}

function canMutate(req: Request, options: { serverHost?: string; remoteAddress?: string | null } = {}) {
  return requestCanMutateConfig(req, {
    serverHost: options.serverHost ?? "127.0.0.1",
    remoteAddress: options.remoteAddress ?? "127.0.0.1",
  });
}

describe("requestCanMutateConfig", () => {
  test("normalizes configured hosts before deciding whether server writes are local-only", () => {
    expect(normalizeHostname("127.0.0.1:7893")).toBe("127.0.0.1");
    expect(normalizeHostname("[::1]:7893")).toBe("::1");
    expect(normalizeHostname("::1")).toBe("::1");

    expect(configMutationsAllowed("127.0.0.1")).toBe(true);
    expect(configMutationsAllowed("localhost")).toBe(true);
    expect(configMutationsAllowed("::1")).toBe(true);
    expect(configMutationsAllowed("0.0.0.0")).toBe(false);
  });

  test("allows local dashboard requests", () => {
    expect(canMutate(request("http://127.0.0.1:7893/api/dashboard", { Host: "127.0.0.1:7893" }))).toBe(true);
    expect(canMutate(request("http://127.0.0.1:7893/api/dashboard", {
      Host: "127.0.0.1:7893",
      Origin: "http://127.0.0.1:5193",
    }))).toBe(true);
  });

  test("rejects reverse-proxied or public requests", () => {
    expect(canMutate(request("http://127.0.0.1:7893/api/dashboard"), {
      serverHost: "0.0.0.0",
    })).toBe(false);
    expect(canMutate(request("http://127.0.0.1:7893/api/dashboard"), {
      remoteAddress: "203.0.113.10",
    })).toBe(false);
    expect(canMutate(request("http://127.0.0.1:7893/api/dashboard", {
      Origin: "https://dashboard.example.com",
    }))).toBe(false);
    expect(canMutate(request("https://dashboard.example.com/api/dashboard", {
      Host: "dashboard.example.com",
      Origin: "https://dashboard.example.com",
    }))).toBe(false);
  });

  test("rejects spoofed local Host headers on non-local requests", () => {
    expect(canMutate(request("https://dashboard.example.com/api/dashboard", {
      Host: "127.0.0.1:7893",
    }), {
      serverHost: "0.0.0.0",
      remoteAddress: "203.0.113.10",
    })).toBe(false);
    expect(canMutate(request("http://127.0.0.1:7893/api/dashboard", {
      Host: "dashboard.example.com",
      Origin: "https://dashboard.example.com",
    }), {
      remoteAddress: "203.0.113.10",
    })).toBe(false);
  });
});
