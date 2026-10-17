import { describe, expect, it } from "vitest";
import { formatAmount, newForWatch, shouldSearchWeb, webOrigin, withoutDismissed } from "./agent-rules.shared";

describe("grant agent rules", () => {
  it("web results without an exact citation stay unverified", () => {
    expect(webOrigin(undefined)).toBe("web_unverified");
    expect(webOrigin("unverified")).toBe("web_unverified");
    expect(webOrigin("grounded")).toBe("web_verified");
  });
  it("catalog first: web only when the catalog brings fewer than 3 or the user asks for new", () => {
    expect(shouldSearchWeb(5, false)).toBe(false);
    expect(shouldSearchWeb(2, false)).toBe(true);
    expect(shouldSearchWeb(5, true)).toBe(true);
  });
  it("unknown amounts are 'No publicado', never invented", () => {
    expect(formatAmount(null, null, "CAD", "es")).toBe("No publicado");
    expect(formatAmount(null, 50000, "CAD", "en")).toBe("Up to 50,000 CAD");
  });
  it("dismissed grants are never suggested again", () => {
    expect(withoutDismissed([{ id: "a" }, { id: "b" }, { id: null }], new Set(["a"]))).toEqual([{ id: "b" }, { id: null }]);
  });
  it("a watch only reports grants it has not reported before", () => {
    expect(newForWatch(["a", "b", "b", "c"], ["a"])).toEqual(["b", "c"]);
  });
});
