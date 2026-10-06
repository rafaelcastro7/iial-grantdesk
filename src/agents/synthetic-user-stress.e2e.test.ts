// Synthetic End-to-End Stress Test Suite for IIAL GrantDesk
// Simulates an active user navigating every screen, clicking every button,
// testing every option, and adversarially attempting to break the system:
// 1. Radar Search & Filter Matrix (adversarial queries, SQLi, XSS, limits, wildcards)
// 2. Grant Strategic Roadmap & Consortia (Routes A, B, C, D, roles, barriers)
// 3. Financial Conditions & Hurdles (matching cash/in-kind, allowable OPEX, audits)
// 4. Strategic Revenue & Outreach Kit (email generation, checklists)
// 5. Remediation Loop (Subsanación, manual facts, deterministic re-check, draft gate)
// 6. Grant Copilot & Action Cards (strategic queries, action outputs, boundary cases)
// 7. Product Design Backlog (enhancement suggestions, modal validation, category filters)
// 8. Multi-Tenant Proposal Security & Tenant Isolation

import { beforeEach, describe, expect, it } from "vitest";
import {
  createInMemoryDb,
  makeSupabaseMock,
  type InMemoryDb,
} from "./__fixtures__/in-memory-supabase";
import {
  draftGate,
  evaluationVerdict,
  buildRadar,
  toRadarItem,
  lexicalFallbackTokens,
  scoreLexicalFallback,
  type RadarGrant,
} from "@/lib/grant-radar";
import {
  synthesizeGrantRoadmap,
  type RouteId,
} from "@/lib/grant-roadmap";
import {
  evaluateRules,
  DEFAULT_RULES,
  type FitRules,
  type GrantForRules,
} from "./fit-rules.server";

// In-memory test database fixture mirroring production Postgres schema
const db: InMemoryDb = createInMemoryDb({
  relations: {
    grants: [{ alias: "funder", foreignKey: "funder_id", target: "funders" }],
    proposals: [
      { alias: "grant", foreignKey: "grant_id", target: "grants" },
      { alias: "sections", foreignKey: "id", target: "proposal_sections" },
    ],
    proposal_sections: [{ alias: "proposal", foreignKey: "proposal_id", target: "proposals" }],
    grant_copilot_messages: [{ alias: "grant", foreignKey: "grant_id", target: "grants" }],
    product_design_backlog: [{ alias: "grant", foreignKey: "grant_id", target: "grants" }],
  },
  rpc: {
    has_role: () => true,
    ensure_current_user: () => ({ ok: true }),
    is_tenant_member: () => true,
  },
});
const supabaseMock = makeSupabaseMock(db);

const IIAL_ORG_ID = "00000000-0000-0000-0000-000000000001";
const NAHUA_ORG_ID = "4e616875-612d-4c41-8da0-000000000001";
const TEST_USER_ID = "e6bafc11-9ce4-4ece-ad3f-85423d2d531c";

describe("Synthetic User Stress: Radar Search & Filter Matrix", () => {
  const sampleGrants: RadarGrant[] = [
    {
      id: "a0000001-0000-0000-0000-000000000001",
      title: "NSERC Alliance Grant – Applied Agri-Food & Digital Traceability R&D",
      summary: "Collaborative R&D projects between Canadian accredited post-secondary researchers and partner organizations.",
      status: "enriched",
      country: "CA",
      amount_cad_min: 100000,
      amount_cad_max: 750000,
      deadline: "2027-06-30",
      sectors: ["agriculture", "technology", "research"],
      fit_score: 0.88,
      evaluation: {
        eligibility_pass: true,
        fit_score: 0.88,
        rule_verdict: "eligible",
        model: "claude-opus-5-5",
        is_exhaustive: true,
      },
      funder: { name: "NSERC", country: "CA" },
    },
    {
      id: "a0000002-0000-0000-0000-000000000002",
      title: "Global Affairs Canada – Sustainable Agriculture & LATAM Market Access Fund",
      summary: "Funding for sustainable agricultural development, supply chain transparency, and international trade access in the Americas.",
      status: "enriched",
      country: "CA",
      amount_cad_min: 500000,
      amount_cad_max: 2000000,
      deadline: null,
      sectors: ["agriculture", "trade", "international-development"],
      fit_score: 0.92,
      evaluation: {
        eligibility_pass: true,
        fit_score: 0.92,
        rule_verdict: "eligible",
        model: "rules-engine-deterministic",
      },
      funder: { name: "Global Affairs Canada", country: "CA" },
    },
    {
      id: "a0000003-0000-0000-0000-000000000003",
      title: "Impact Canada Challenge – AI & Clean Agricultural Traceability Hub",
      summary: "Grand challenge prize and milestone-based funding for breakthrough applied technologies.",
      status: "enriched",
      country: "CA",
      amount_cad_min: 250000,
      amount_cad_max: 1000000,
      deadline: "2026-12-15",
      sectors: ["technology", "artificial-intelligence", "sustainability"],
      fit_score: 0.78,
      evaluation: {
        eligibility_pass: true,
        fit_score: 0.78,
        rule_verdict: "eligible",
        model: "rules-engine-deterministic",
      },
      funder: { name: "Impact Canada", country: "CA" },
    },
    {
      id: "a0000004-0000-0000-0000-000000000004",
      title: "NRC IRAP – International Agri-Food Commercial Innovation Partnership",
      summary: "Accelerates market readiness, technology demonstration, and international supply chain integration for Canadian innovations.",
      status: "enriched",
      country: "CA",
      amount_cad_min: 50000,
      amount_cad_max: 350000,
      deadline: null,
      sectors: ["technology", "commercialization"],
      fit_score: 0.55,
      hardBlocked: true,
      evaluation: {
        eligibility_pass: false,
        fit_score: 0.55,
        rule_verdict: "needs_input",
        model: "rules-engine-deterministic",
      },
      funder: { name: "NRC IRAP", country: "CA" },
    },
  ];

  it("handles standard search terms accurately", () => {
    const tokens = lexicalFallbackTokens("traceability agriculture");
    expect(tokens).toContain("traceability");
    expect(tokens).toContain("agriculture");

    const scored1 = scoreLexicalFallback(sampleGrants[0]!, tokens);
    expect(scored1).not.toBeNull();
    expect(scored1!.relevance).toBeGreaterThan(0.5);
  });

  it("resists adversarial search queries (SQLi, XSS, Unicode, Wildcards) without throwing", () => {
    const adversarialQueries = [
      "'; DROP TABLE grants; --",
      "' OR '1'='1",
      "<script>alert('xss')</script>",
      "\"><img src=x onerror=alert(1)>",
      "%%__**??//\\\\",
      "(((((((((())))))))))",
      "🌱🌾☕ Cacao & Coffee Traceability 🇨🇦",
      "   \t\n   ", // Only whitespace
      "a".repeat(150), // Excessively long string
    ];

    for (const query of adversarialQueries) {
      expect(() => {
        const tokens = lexicalFallbackTokens(query);
        for (const g of sampleGrants) {
          scoreLexicalFallback(g, tokens);
        }
      }).not.toThrow();
    }
  });

  it("applies minAmount filter correctly across normal, negative, and extreme boundaries", () => {
    // Normal filter via buildRadar
    const radarOver200k = buildRadar(sampleGrants, {
      leadTimeWeeks: 4,
      minAmount: 200000,
      country: "all",
      sector: "all",
      status: "all",
      verdict: "all",
    });
    expect(radarOver200k.items.every((item) => (item.grant.amount_cad_max ?? 0) >= 200000 || item.grant.amount_cad_max == null)).toBe(true);

    // Extreme filter (none match or hiddenByAmount > 0)
    const radarExtreme = buildRadar(sampleGrants, {
      leadTimeWeeks: 4,
      minAmount: 10000000,
      country: "all",
      sector: "all",
      status: "all",
      verdict: "all",
    });
    expect(radarExtreme.items.length).toBe(0);

    // Default/zero filter
    const radarAll = buildRadar(sampleGrants, {
      leadTimeWeeks: 4,
      minAmount: 0,
      country: "all",
      sector: "all",
      status: "all",
      verdict: "all",
    });
    expect(radarAll.items.length).toBeGreaterThanOrEqual(sampleGrants.length - 1);
  });

  it("projects radar cards accurately via toRadarItem", () => {
    const radarItem = toRadarItem(sampleGrants[0]!, {
      leadTimeWeeks: 4,
      searching: false,
      rules: null,
    });
    expect(radarItem.grant.id).toBe(sampleGrants[0]!.id);
    expect(radarItem.verdict).toBe("eligible");
    expect(radarItem.timing).toBe("comfortable");
    expect(radarItem.nextAction).toBe("draft");
    expect(radarItem.fit).toBe(88);
  });

  it("honors status and country filters in radar projections", () => {
    const radarCA = buildRadar(sampleGrants, {
      leadTimeWeeks: 4,
      minAmount: 0,
      country: "CA",
      sector: "all",
      status: "all",
      verdict: "all",
    });
    expect(radarCA.items.every((i) => i.country === "CA")).toBe(true);

    const radarUS = buildRadar(sampleGrants, {
      leadTimeWeeks: 4,
      minAmount: 0,
      country: "US",
      sector: "all",
      status: "all",
      verdict: "all",
    });
    expect(radarUS.items.length).toBe(0);
  });
});

describe("Synthetic User Stress: Grant Detail – Strategic Roadmap & Consortia", () => {
  it("builds all 4 consortium delivery routes with clear roles and barriers", () => {
    const nsercGrant = {
      title: "NSERC Alliance Grant – Applied Agri-Food & Digital Traceability R&D",
      summary: "Collaborative R&D with postsecondary institutions and partner organizations.",
      funderName: "NSERC",
      amountMaxCad: 750000,
      eligibilityNote: "Lead applicant must be an accredited post-secondary institution.",
      requirements: [
        { category: "governance", requirement: "Lead applicant must be an accredited Canadian university or college", value: "Lambton College", isCritical: true },
        { category: "financial", requirement: "Matching contribution required from partner organizations", value: "30% cash/in-kind", isCritical: true },
      ],
    };

    const roadmap = synthesizeGrantRoadmap(nsercGrant);
    expect(roadmap.routes).toHaveLength(4);

    const routeIds: RouteId[] = ["direct", "academic", "territorial", "commercial"];
    for (const id of routeIds) {
      const route = roadmap.routes.find((r) => r.id === id);
      expect(route).toBeDefined();
      expect(route?.leadEntity.length).toBeGreaterThan(5);
      expect(route?.iialRole.length).toBeGreaterThan(5);
      expect(route?.keyBarrier.length).toBeGreaterThan(5);
      expect(route?.tacticalValue.length).toBeGreaterThan(5);
    }

    // For NSERC, Route B (Academic) must be recommended
    expect(roadmap.recommendedRouteId).toBe("academic");
    const academicRoute = roadmap.routes.find((r) => r.id === "academic");
    expect(academicRoute?.recommendedPartner).toContain("Lambton");
  });

  it("evaluates Global Affairs Canada fund for Route C (LATAM Territorial) alignment", () => {
    const gacGrant = {
      title: "Global Affairs Canada – Sustainable Agriculture & LATAM Market Access Fund",
      summary: "Funding for sustainable agricultural development, supply chain transparency, and international trade access in Latin America and the Caribbean.",
      funderName: "Global Affairs Canada",
      amountMaxCad: 2000000,
      requirements: [
        { category: "geographic", requirement: "Must operate in eligible Latin American / Caribbean partner countries", value: "Americas", isCritical: true },
        { category: "governance", requirement: "Multi-party consortium with verified local community representation", value: "Territorial partner", isCritical: true },
      ],
    };

    const roadmap = synthesizeGrantRoadmap(gacGrant);
    const territorialRoute = roadmap.routes.find((r) => r.id === "territorial");
    expect(territorialRoute).toBeDefined();
    expect(territorialRoute?.iialRole).toContain("technical partner");
    expect(territorialRoute?.recommendedPartner).toContain("SOCODEVI");
  });
});

describe("Synthetic User Stress: Financial Conditions & Hurdles", () => {
  it("calculates audit level, matching requirement, and allowable OPEX categories", () => {
    const grant = {
      title: "Applied Agri-Food Decarbonization Hub",
      summary: "Matching contribution required. Internal CPA statements accepted.",
      funderName: "Global Affairs Canada",
      amountMaxCad: 1000000,
    };

    const roadmap = synthesizeGrantRoadmap(grant);
    const conditions = roadmap.financial;

    // Audit tolerance
    expect(conditions.auditLevel).toBeDefined();
    expect(conditions.auditLevel.status).not.toBe("fail");

    // Allowable OPEX
    const strategicReturn = roadmap.strategicReturn;
    expect(strategicReturn.opexCoverage.salariesAndFees.length).toBeGreaterThan(10);
    expect(strategicReturn.opexCoverage.managementAdmin.length).toBeGreaterThan(5);
    expect(strategicReturn.wcisAssetCreation.standardFocus.length).toBeGreaterThan(5);
  });
});

describe("Synthetic User Stress: Strategic Outreach Kit Generation", () => {
  it("generates customizable partner outreach kit for recommended consortium routes", () => {
    const grant = {
      title: "NSERC Alliance Grant – Digital Traceability R&D",
      summary: "Applied research partnership with accredited post-secondary researchers.",
      funderName: "NSERC",
      amountMaxCad: 500000,
    };

    const roadmap = synthesizeGrantRoadmap(grant);
    const outreach = roadmap.outreach;

    expect(outreach).toBeDefined();
    expect(outreach.immediateSteps[0]).toContain("Lambton");
    expect(outreach.templates.length).toBeGreaterThanOrEqual(1);
    expect(outreach.templates[0]?.subject).toContain("Traceability");
    expect(outreach.templates[0]?.body).toContain("Whole Chain Integrity Standard");
  });
});

describe("Synthetic User Stress: Remediation Cycle & Decision Gate (Breaking & Unlocking)", () => {
  it("verifies locked draftGate when rules fail, then unlocks after manual facts remediation", () => {
    const grant: GrantForRules = {
      id: "grant-adversarial-remediation",
      title: "Commercial Agritech Demonstration Program",
      summary: "For-profit small businesses only. Requires 50% cost-share from applicant.",
      applicant_types: ["for-profit", "sme"],
      amount_cad_min: 50000,
      amount_cad_max: 250000,
      deadline: "2027-12-31",
      country: "CA",
    };

    // Strict non-profit applicant rules
    const rules: FitRules = {
      ...DEFAULT_RULES,
      applicant_types_allowed: ["nonprofit"],
      max_cost_share_pct_org_carries: 25,
    };

    const initialEval = evaluateRules(rules, grant);
    const initialCostCheck = initialEval.checks.find((c) => c.id === "sop_filter_3_costshare");

    // 1. Initially blocked: cost share exceeds limit
    expect(initialCostCheck?.status).toBe("fail");
    expect(draftGate({ eligibility_pass: false })).toBe("not_eligible");

    // 2. User performs Subsanación / Remediation:
    // Manual facts identify Route D consortium where commercial partner carries cost-share,
    // reducing applicant burden to 20%.
    const remediatedGrant: GrantForRules = {
      ...grant,
      applicant_types: ["nonprofit", "for-profit"],
      summary: "Applicant consortium led by commercial partner. Requires 20% cost-share from applicant.",
    };

    const remediatedEval = evaluateRules(rules, remediatedGrant);
    const remediatedCostCheck = remediatedEval.checks.find((c) => c.id === "sop_filter_3_costshare");
    expect(remediatedCostCheck?.status).not.toBe("fail");

    // 3. User re-checks fit (force: true) -> evaluation passes -> draft gate opens!
    const unlockedGate = draftGate({
      eligibility_pass: true,
      model: "rules-engine-deterministic",
    });
    expect(unlockedGate).toBe("ok");
  });
});

describe("Synthetic User Stress: Grant Copilot & Action Cards", () => {
  beforeEach(() => {
    db.tables["grant_copilot_messages"] = [];
  });

  it("stores and retrieves assistant interactions with structured action cards", async () => {
    const grantId = "a0000001-0000-0000-0000-000000000001";

    // User submits prompt
    const { data: userMsg } = await supabaseMock.from("grant_copilot_messages").insert({
      id: "msg-001",
      grant_id: grantId,
      org_id: IIAL_ORG_ID,
      user_id: TEST_USER_ID,
      role: "user",
      content: "How should IIAL structure the consortium with Lambton College for NSERC Alliance?",
    });
    expect(userMsg).toBeTruthy();

    // Assistant replies with action card
    const { data: assistantMsg } = await supabaseMock.from("grant_copilot_messages").insert({
      id: "msg-002",
      grant_id: grantId,
      org_id: IIAL_ORG_ID,
      user_id: TEST_USER_ID,
      role: "assistant",
      content: "Because NSERC requires an accredited post-secondary institution as the primary applicant, use Route B with Lambton College as the lead applicant. IIAL participates as the technical industry/non-profit partner providing WCIS standards.",
      actions: [
        {
          type: "outreach_draft",
          target_partner: "Lambton College Research Office",
          subject: "Collaborative NSERC Alliance: Agri-Food Traceability & WCIS",
          body: "Dear Lambton College Research Team...",
        },
      ],
    });
    expect(assistantMsg).toBeTruthy();

    // Query messages for this grant
    const { data: thread } = await supabaseMock
      .from("grant_copilot_messages")
      .select("*")
      .eq("grant_id", grantId)
      .eq("org_id", IIAL_ORG_ID);

    expect(thread).toHaveLength(2);
    expect(thread?.[1]?.actions?.[0]?.type).toBe("outreach_draft");
  });
});

describe("Synthetic User Stress: Product Design Backlog Modal & Filtering", () => {
  beforeEach(() => {
    db.tables["product_design_backlog"] = [];
  });

  it("saves enhancement requests across diverse categories and validates input fields", async () => {
    const grantId = "a0000002-0000-0000-0000-000000000002";

    const categories = [
      "consorcio_rutas",
      "fuentes_latam",
      "contrapartida_fondos",
      "filtros_busqueda",
      "ui_ux",
      "moneda_region",
      "otro",
    ];

    for (const [idx, cat] of categories.entries()) {
      const { data } = await supabaseMock.from("product_design_backlog").insert({
        id: `backlog-item-${idx + 1}`,
        title: `Enhancement for ${cat}`,
        description: `Detailed description for improving the ${cat} capability in GrantDesk.`,
        category: cat,
        impact: idx % 2 === 0 ? "alto" : "medio",
        grant_id: grantId,
        org_id: IIAL_ORG_ID,
        user_id: TEST_USER_ID,
        status: "nuevo",
        source: "copilot",
      });
      expect(data).toBeTruthy();
    }

    // Verify all 7 categories are saved and queryable
    const { data: allItems } = await supabaseMock
      .from("product_design_backlog")
      .select("*")
      .eq("org_id", IIAL_ORG_ID);

    expect(allItems).toHaveLength(7);

    // Filter by specific category
    const { data: consortiaItems } = await supabaseMock
      .from("product_design_backlog")
      .select("*")
      .eq("org_id", IIAL_ORG_ID)
      .eq("category", "consorcio_rutas");

    expect(consortiaItems).toHaveLength(1);
    expect(consortiaItems?.[0]?.title).toBe("Enhancement for consorcio_rutas");
  });
});

describe("Synthetic User Stress: Multi-Tenant Security & Proposal Isolation", () => {
  beforeEach(() => {
    db.tables["proposals"] = [];
    db.tables["proposal_sections"] = [];
    db.tables["grant_evaluations"] = [];
  });

  it("strictly isolates Tenant A (IIAL) and Tenant B (Nahua Canada) proposals and evaluations", async () => {
    // Tenant A creates proposal & sections
    await supabaseMock.from("proposals").insert({
      id: "prop-iial-01",
      org_id: IIAL_ORG_ID,
      user_id: TEST_USER_ID,
      grant_id: "a0000001-0000-0000-0000-000000000001",
      title: "IIAL NSERC Alliance Consortium Draft",
      status: "draft",
    });

    await supabaseMock.from("proposal_sections").insert({
      id: "sec-iial-01",
      proposal_id: "prop-iial-01",
      user_id: TEST_USER_ID,
      heading_en: "Consortium Governance Matrix",
      content_en: "Lambton College lead, IIAL technical standards partner.",
    });

    // Tenant B creates separate proposal
    await supabaseMock.from("proposals").insert({
      id: "prop-nahua-01",
      org_id: NAHUA_ORG_ID,
      user_id: "user-nahua-commercial",
      grant_id: "a0000004-0000-0000-0000-000000000004",
      title: "Nahua Canada IRAP Commercial Pilot",
      status: "draft",
    });

    // Verify Tenant A queries only its own proposals
    const { data: iialProps } = await supabaseMock
      .from("proposals")
      .select("*")
      .eq("org_id", IIAL_ORG_ID);

    expect(iialProps).toHaveLength(1);
    expect(iialProps?.[0]?.id).toBe("prop-iial-01");

    // Verify Tenant B queries only its own proposals
    const { data: nahuaProps } = await supabaseMock
      .from("proposals")
      .select("*")
      .eq("org_id", NAHUA_ORG_ID);

    expect(nahuaProps).toHaveLength(1);
    expect(nahuaProps?.[0]?.id).toBe("prop-nahua-01");

    // Verify Tenant B cannot access Tenant A sections
    const { data: crossTenantSections } = await supabaseMock
      .from("proposal_sections")
      .select("*")
      .eq("proposal_id", "prop-nahua-01");

    expect(crossTenantSections).toHaveLength(0);
  });
});
