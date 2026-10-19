import { describe, expect, it } from "vitest";
import { isProviderFailure, ProviderRest, retryAfterMs } from "./rescue.shared";

describe("retryAfterMs", () => {
  it("parses Groq's wait hints", () => {
    expect(retryAfterMs("Please try again in 3m20.016s. Need more tokens?")).toBe(200_016);
    expect(retryAfterMs("try again in 45s")).toBe(45_000);
    expect(retryAfterMs("no hint")).toBeNull();
  });
});

describe("isProviderFailure", () => {
  it("switches on quota and server errors but not bad requests", () => {
    expect(isProviderFailure({ statusCode: 429 })).toBe(true);
    expect(isProviderFailure({ statusCode: 503 })).toBe(true);
    expect(isProviderFailure({ statusCode: 400 })).toBe(false);
    expect(isProviderFailure(new Error("Rate limit reached for model"))).toBe(true);
  });
});

describe("ProviderRest", () => {
  it("moves a rate-limited provider to the back until its wait ends", () => {
    let now = 0;
    const rest = new ProviderRest(() => now);
    const ps = [{ name: "groq" }, { name: "cerebras" }, { name: "gemini" }];
    rest.rest("groq", new Error("try again in 1m"));
    expect(rest.order(ps).map((p) => p.name)).toEqual(["cerebras", "gemini", "groq"]);
    now = 61_000;
    expect(rest.order(ps).map((p) => p.name)).toEqual(["groq", "cerebras", "gemini"]);
  });
});
