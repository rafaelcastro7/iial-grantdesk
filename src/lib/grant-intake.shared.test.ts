import { describe, expect, it } from "vitest";
import {
  countryFromHost,
  isPrivateHost,
  normalizeGrantUrl,
  provisionalTitle,
  urlVariants,
} from "@/lib/grant-intake.shared";

describe("grant intake helpers", () => {
  it("normalizes scheme, www, hash, tracking params and trailing slash", () => {
    const url = normalizeGrantUrl("WWW.Example.ca/programs/fund/?utm_source=x&id=7#apply");
    expect(url.toString()).toBe("https://www.example.ca/programs/fund?id=7");
  });

  it("matches the same page however it was stored", () => {
    const variants = urlVariants(normalizeGrantUrl("https://example.ca/fund"));
    expect(variants).toContain("http://www.example.ca/fund/");
    expect(variants).toContain("https://example.ca/fund");
    expect(variants).not.toContain("https://example.ca");
  });

  it("rejects non-web and private addresses", () => {
    expect(() => normalizeGrantUrl("javascript:alert(1)")).toThrow();
    expect(() => normalizeGrantUrl("http://127.0.0.1/admin")).toThrow();
    expect(() => normalizeGrantUrl("http://169.254.169.254/latest")).toThrow();
    expect(isPrivateHost("intranet")).toBe(true);
    expect(isPrivateHost("nrc.canada.ca")).toBe(false);
  });

  it("guesses country and a readable title", () => {
    expect(countryFromHost("grants.gov")).toBe("US");
    expect(countryFromHost("fednor.canada.ca")).toBe("CA");
    expect(provisionalTitle(new URL("https://x.ca/en/youth-internship-guidelines.html"))).toBe(
      "Youth Internship Guidelines",
    );
    expect(provisionalTitle(new URL("https://x.ca/"))).toBe("Opportunity at x.ca");
  });
});
