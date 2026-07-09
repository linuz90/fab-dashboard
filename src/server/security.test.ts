import { describe, expect, test } from "bun:test";
import { configMutationsAllowed, normalizeHostname, parseTrustedConfigOrigins, requestCanMutateConfig } from "./security";

function request(url: string, headers: HeadersInit = {}) {
  return new Request(url, { headers });
}

function canMutate(req: Request, options: { serverHost?: string; remoteAddress?: string | null; trustedOrigins?: readonly string[] } = {}) {
  return requestCanMutateConfig(req, {
    serverHost: options.serverHost ?? "127.0.0.1",
    remoteAddress: options.remoteAddress ?? "127.0.0.1",
    trustedOrigins: options.trustedOrigins,
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

  test("allows explicitly trusted origins through a local proxy", () => {
    const trustedOrigins = ["https://example.tailnet.ts.net"];
    expect(canMutate(request("https://example.tailnet.ts.net/api/dashboard", {
      Host: "example.tailnet.ts.net",
    }), { trustedOrigins })).toBe(true);
    expect(canMutate(request("https://example.tailnet.ts.net/api/dashboard", {
      Host: "example.tailnet.ts.net",
      Origin: "https://example.tailnet.ts.net",
    }), { trustedOrigins })).toBe(true);
    expect(canMutate(request("http://example.tailnet.ts.net/api/dashboard", {
      Host: "example.tailnet.ts.net",
      Origin: "https://example.tailnet.ts.net",
    }), { trustedOrigins })).toBe(true);
    expect(canMutate(request("https://example.tailnet.ts.net/api/dashboard", {
      Host: "example.tailnet.ts.net",
      Origin: "https://evil.example",
    }), { trustedOrigins })).toBe(false);
    expect(canMutate(request("https://example.tailnet.ts.net/api/dashboard", {
      Host: "example.tailnet.ts.net",
      Origin: "https://example.tailnet.ts.net",
    }), {
      remoteAddress: "203.0.113.10",
      trustedOrigins,
    })).toBe(false);
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

  test("parses trusted config origins from a comma-separated env value", () => {
    expect(parseTrustedConfigOrigins(" https://example.tailnet.ts.net/path,not a url,http://localhost:7893 "))
      .toEqual(["https://example.tailnet.ts.net", "http://localhost:7893"]);
  });
});
