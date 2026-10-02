import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchGrantsGovOpportunitySource,
  grantsGovOpportunityId,
} from "./grants-gov-opportunity.server";

afterEach(() => vi.restoreAllMocks());

describe("Grants.gov opportunity source", () => {
  it("recognizes detail URLs only", () => {
    expect(grantsGovOpportunityId("https://www.grants.gov/search-results-detail/358181")).toBe(
      358181,
    );
    expect(grantsGovOpportunityId("https://example.com/search-results-detail/358181")).toBeNull();
  });

  it("adds official eligibility without inventing unpublished amounts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          errorcode: 0,
          data: {
            synopsis: {
              synopsisDesc: "<p>Research funding opportunity.</p>",
              responseDate: "Nov 18, 2026 12:00:00 AM EST",
              awardCeiling: "none",
              awardFloor: "none",
              applicantEligibilityDesc: "Faith-based organizations may apply.",
              applicantTypes: [{ description: "Nonprofits having a 501(c)(3) status" }],
              fundingDescLinkUrl: "http://grants.nih.gov/example.html",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const result = await fetchGrantsGovOpportunitySource(
      "https://www.grants.gov/search-results-detail/358181",
    );
    expect(result?.markdown).toContain("Eligible applicants: Nonprofits");
    expect(result?.markdown).not.toContain("award funding");
    expect(result?.detailUrl).toBe("https://grants.nih.gov/example.html");
  });
});
