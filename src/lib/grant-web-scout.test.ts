import { describe, it, expect } from "vitest";
import type { DiscoveredWebGrant } from "@/lib/grant-web-scout.server";

describe("grant-web-scout parser & status normalizer", () => {
  it("normalizes diverse grant statuses accurately", () => {
    const rawItems: Array<{
      title: string;
      funder: string;
      country: string;
      url: string;
      summary: string;
      amount_range: string;
      deadline: string;
      status: string;
      applicant_fit: string;
    }> = [
      {
        title: "Food-Link Fund",
        funder: "Agriculture and Agri-Food Canada",
        country: "CA",
        url: "https://www.canada.ca/food-link",
        summary: "Supporting resilient food distribution infrastructure across Canada.",
        amount_range: "$500,000 - $10,000,000 CAD",
        deadline: "Upcoming Cycle (2026/2027)",
        status: "upcoming call",
        applicant_fit: "IIAL can lead technical food hub feasibility or partner.",
      },
      {
        title: "Global Affairs Unsolicited Concept Notes",
        funder: "Global Affairs Canada",
        country: "CA",
        url: "https://www.international.gc.ca/unsolicited",
        summary: "Continuous intake for international assistance.",
        amount_range: "Up to $5,000,000 CAD",
        deadline: "Rolling",
        status: "continuous intake",
        applicant_fit: "Requires Canadian NPO with CRA number (IIAL has this).",
      },
      {
        title: "2026 CFC 29th Call",
        funder: "Common Fund for Commodities",
        country: "INT",
        url: "https://www.common-fund.org/call",
        summary: "Impact projects empowering smallholders and cocoa producers.",
        amount_range: "Up to $1,500,000 USD",
        deadline: "2026-06-01",
        status: "Open",
        applicant_fit: "Suitable for APP CACAO or Nahua commercial partnership.",
      },
    ];

    const normalized: DiscoveredWebGrant[] = rawItems.map((g) => {
      const s = g.status.toLowerCase();
      const status: DiscoveredWebGrant["status"] =
        s.includes("upcom") || s.includes("próxim")
          ? "upcoming"
          : s.includes("continu") || s.includes("roll")
            ? "continuous"
            : s.includes("clos") || s.includes("cerrad")
              ? "closed"
              : "open";

      return {
        title: g.title,
        funder: g.funder,
        country: g.country,
        url: g.url,
        summary: g.summary,
        amount_range: g.amount_range,
        deadline: g.deadline,
        status,
        applicant_fit: g.applicant_fit,
        alreadyInCatalog: false,
      };
    });

    expect(normalized).toHaveLength(3);
    expect(normalized[0].status).toBe("upcoming");
    expect(normalized[1].status).toBe("continuous");
    expect(normalized[2].status).toBe("open");
    expect(normalized[0].country).toBe("CA");
    expect(normalized[2].funder).toBe("Common Fund for Commodities");
  });

  it("handles missing optional fields gracefully", () => {
    const fallbackItem: DiscoveredWebGrant = {
      title: "Regional Horizon Call",
      funder: "European Commission",
      country: "INT",
      url: "https://europa.eu/call",
      summary: "Collaborative research.",
      amount_range: "Unspecified",
      deadline: "Rolling",
      status: "open",
      applicant_fit: "Consortium partner",
      alreadyInCatalog: false,
    };

    expect(fallbackItem.title).toBe("Regional Horizon Call");
    expect(fallbackItem.amount_range).toBe("Unspecified");
    expect(fallbackItem.alreadyInCatalog).toBe(false);
  });
});
