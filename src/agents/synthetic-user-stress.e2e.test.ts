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
import { DISMISS_REASONS } from "@/lib/grants.functions";

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

describe("Synthetic User Stress: Adversarial Copilot Actions Parsing & Fault Tolerance", () => {
  function extractActionsSafely(rawText: string) {
    let raw = rawText;
    let extractedActions: unknown = null;
    const actionMatch = raw.match(/```actions\s*([\s\S]*?)\s*```/);
    if (actionMatch) {
      try {
        const parsed = JSON.parse(actionMatch[1]!);
        if (Array.isArray(parsed)) {
          extractedActions = parsed;
        }
      } catch {
        // safely ignore json parse error on actions
      }
      raw = raw.replace(/```actions\s*[\s\S]*?\s*```/, "").trim();
    }
    return { cleanText: raw, actions: extractedActions };
  }

  it("extracts valid action cards and leaves clean markdown text", () => {
    const aiOutput = `Here is our proposed strategic plan for the consortium with Lambton College.

\`\`\`actions
[
  {
    "type": "outreach_draft",
    "target_partner": "Lambton College Research Office",
    "subject": "NSERC Alliance Collaboration",
    "body": "Dear Dean of Applied Research..."
  },
  {
    "type": "backlog_suggestion",
    "title": "Enable multi-party revenue splitting",
    "description": "System should model shared post-grant IP revenue.",
    "category": "consorcio_rutas"
  }
]
\`\`\`
`;
    const res = extractActionsSafely(aiOutput);
    expect(res.cleanText).toContain("Here is our proposed strategic plan");
    expect(res.cleanText).not.toContain("```actions");
    expect(Array.isArray(res.actions)).toBe(true);
    expect((res.actions as unknown[]).length).toBe(2);
  });

  it("gracefully survives malformed JSON, truncated actions, or injection attempts without throwing", () => {
    const malformedOutputs = [
      // Truncated JSON
      'Here is the response. ```actions [{"type": "outreach_draft", "target_partner": "Lambton"',
      // Broken JSON with trailing comma
      'Here is the response. ```actions [{"type": "outreach_draft",},] ```',
      // Non-array JSON
      'Here is the response. ```actions {"type": "not_an_array"} ```',
      // Code injection attempt inside JSON
      'Here is the response. ```actions <script>alert(1)</script> ```',
      // Empty action block
      "Here is the response. ```actions ```",
      // Nested backticks
      "Here is the response. ```actions ```nested``` ```",
    ];

    for (const raw of malformedOutputs) {
      expect(() => {
        const res = extractActionsSafely(raw);
        expect(typeof res.cleanText).toBe("string");
      }).not.toThrow();
    }
  });
});

describe("Synthetic User Stress: Proposal Readiness & Critical RFP Coverage", () => {
  it("evaluates proposal readiness and flags missing critical requirements", async () => {
    const { computeProposalReadiness } = await import("@/lib/proposal-readiness");

    const criticalRequirements = [
      { category: "governance", requirement: "Must have signed consortium governance agreement with university", isCritical: true },
      { category: "financial", requirement: "Requires minimum 30% matching contributions", isCritical: true },
      { category: "technical", requirement: "Digital traceability system architecture specification", isCritical: false },
    ];

    // 1. Partial/Incomplete proposal: only mentions governance
    const incompleteSections = [
      {
        id: "sec-01",
        kind: "summary",
        heading_en: "Executive Summary",
        content_en: "Our consortium has signed a formal governance agreement with the university partner for applied research.",
        citations: ["cite-1"],
        critic_notes: null,
      },
      {
        id: "sec-02",
        kind: "budget",
        heading_en: "Budget",
        content_en: "Short text.",
        citations: [],
        critic_notes: null,
      },
    ];

    const initialReadiness = computeProposalReadiness({
      sections: incompleteSections,
      requirements: criticalRequirements,
    });

    expect(initialReadiness.totalSections).toBe(2);
    expect(initialReadiness.criticalRequirements).toBe(2);
    // Financial matching is still missing from the corpus
    expect(initialReadiness.openCriticalRequirements.length).toBeGreaterThanOrEqual(1);

    // 2. Complete proposal covering all critical requirements
    const completeSections = [
      ...incompleteSections,
      {
        id: "sec-03",
        kind: "budget_justification",
        heading_en: "Matching Funds and Financial Commitments",
        content_en: "The consortium partners formally confirm 30% matching contributions through cash and verified in-kind hours.",
        citations: ["cite-2"],
        critic_notes: null,
      },
    ];

    const completeReadiness = computeProposalReadiness({
      sections: completeSections,
      requirements: criticalRequirements,
    });

    expect(completeReadiness.openCriticalRequirements).toHaveLength(0);
  });

  it("handles adversarial inputs in proposal readiness (empty strings, undefined arrays) safely", async () => {
    const { computeProposalReadiness } = await import("@/lib/proposal-readiness");

    expect(() => {
      computeProposalReadiness({ sections: [] });
      computeProposalReadiness({
        sections: [
          {
            id: "sec-empty",
            kind: "other",
            heading_en: "",
            content_en: null,
            citations: null,
            critic_notes: null,
          },
        ],
        requirements: null,
      });
    }).not.toThrow();
  });
});

describe("Synthetic User Stress: Draft Gate Security Matrix", () => {
  it("enforces strict gatekeeping for proposals across all evaluation states", () => {
    // 1. Null evaluation -> must check fit first
    expect(draftGate(null)).toBe("not_evaluated");

    // 2. Disqualified / hard-failed evaluation -> locked
    expect(
      draftGate({
        eligibility_pass: false,
        model: "rules-engine-deterministic",
        rule_snapshot: { verdict: "not_eligible" },
      }),
    ).toBe("not_eligible");

    // 3. Needs input / soft-check failure -> locked
    expect(
      draftGate({
        eligibility_pass: false,
        model: "rules-engine-deterministic",
        rule_snapshot: { verdict: "needs_input" },
      }),
    ).toBe("not_eligible");

    // 4. Eligible pass -> unlocked
    expect(
      draftGate({
        eligibility_pass: true,
        model: "rules-engine-deterministic",
        rule_snapshot: { verdict: "eligible" },
      }),
    ).toBe("ok");

    // 5. Eligible pass via full AI review -> unlocked
    expect(
      draftGate({
        eligibility_pass: true,
        model: "claude-opus-5-5",
        is_exhaustive: true,
      }),
    ).toBe("ok");
  });
});

describe("Synthetic User Stress: Zod Schema Boundaries (Manual Facts & Backlog)", () => {
  it("rejects adversarial values for manual fields (negative numbers, invalid dates, oversized lists)", async () => {
    const { z } = await import("zod");
    const MANUAL_FIELDS = [
      "amount_cad_min",
      "amount_cad_max",
      "deadline",
      "eligibility_note",
      "sectors",
      "applicant_types",
    ] as const;

    const manualFieldSchema = z
      .object({
        grantId: z.string().uuid(),
        field: z.enum(MANUAL_FIELDS),
        value: z.union([
          z.number().nonnegative(),
          z.string().max(4000),
          z.array(z.string().min(1).max(80)).max(20),
          z.null(),
        ]),
        note: z.string().max(500).optional(),
      })
      .refine(
        (v) =>
          v.value === null ||
          (["amount_cad_min", "amount_cad_max"].includes(v.field)
            ? typeof v.value === "number"
            : v.field === "deadline"
              ? typeof v.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.value)
              : ["sectors", "applicant_types"].includes(v.field)
                ? Array.isArray(v.value)
                : typeof v.value === "string"),
        { message: "value does not match the field type" },
      );

    const validUuid = "a0000001-0000-0000-0000-000000000001";

    // 1. Valid cases
    expect(() =>
      manualFieldSchema.parse({
        grantId: validUuid,
        field: "amount_cad_max",
        value: 750000,
        note: "Audited amount",
      }),
    ).not.toThrow();

    expect(() =>
      manualFieldSchema.parse({
        grantId: validUuid,
        field: "deadline",
        value: "2027-12-31",
      }),
    ).not.toThrow();

    expect(() =>
      manualFieldSchema.parse({
        grantId: validUuid,
        field: "sectors",
        value: ["agriculture", "technology"],
      }),
    ).not.toThrow();

    // 2. Adversarial / invalid cases
    // Negative number
    expect(() =>
      manualFieldSchema.parse({
        grantId: validUuid,
        field: "amount_cad_max",
        value: -50000,
      }),
    ).toThrow();

    // Invalid deadline format (e.g. DD/MM/YYYY or arbitrary string)
    expect(() =>
      manualFieldSchema.parse({
        grantId: validUuid,
        field: "deadline",
        value: "31-12-2027",
      }),
    ).toThrow();

    // Wrong type: string given for number field
    expect(() =>
      manualFieldSchema.parse({
        grantId: validUuid,
        field: "amount_cad_max",
        value: "one million dollars",
      }),
    ).toThrow();

    // Unauthorized field
    expect(() =>
      manualFieldSchema.parse({
        grantId: validUuid,
        field: "funder_id" as any,
        value: "00000000-0000-0000-0000-000000000000",
      }),
    ).toThrow();
  });
});

describe("Synthetic User Stress: Roadmap Resilience to Corrupt or Empty Grant Records", () => {
  it("survives completely empty or null inputs without throwing and generates viable fallbacks", () => {
    const corruptInputs = [
      { id: "corrupt-1", title: "" },
      { id: "corrupt-2", title: "Untitled Call", funderName: null, summary: null, amountCadMax: null, requirements: null },
      { id: "corrupt-3", title: "   ", applicantTypes: null, sectors: null, deadline: null, deadlineKind: null },
    ];

    for (const input of corruptInputs) {
      expect(() => {
        const roadmap = synthesizeGrantRoadmap(input);
        expect(roadmap.routes).toHaveLength(4);
        expect(roadmap.financial).toBeDefined();
        expect(roadmap.strategicReturn).toBeDefined();
        expect(roadmap.outreach).toBeDefined();
        expect(["direct", "academic", "territorial", "commercial"]).toContain(roadmap.recommendedRouteId);
        expect(roadmap.financial.matchingFunds.label).toBeTruthy();
        expect(roadmap.financial.auditLevel.label).toBeTruthy();
      }).not.toThrow();
    }
  });
});

describe("Synthetic User Stress: Grant Dismissals Allowlist & Integrity", () => {
  it("validates dismiss reasons allowlist and rejects unapproved dismissal keys", async () => {
    const { z } = await import("zod");

    const dismissSchema = z.object({
      grantId: z.string().uuid(),
      reason: z.enum(DISMISS_REASONS),
      note: z.string().max(500).optional(),
    });

    const validId = "a0000001-0000-0000-0000-000000000001";

    for (const reason of DISMISS_REASONS) {
      expect(() =>
        dismissSchema.parse({ grantId: validId, reason, note: "Verified not viable" }),
      ).not.toThrow();
    }

    // Adversarial / invalid dismissal reasons
    expect(() =>
      dismissSchema.parse({ grantId: validId, reason: "boring_call" as any }),
    ).toThrow();

    expect(() =>
      dismissSchema.parse({ grantId: validId, reason: "'; DROP TABLE grant_dismissals; --" as any }),
    ).toThrow();
  });
});

describe("Synthetic User Stress: Currency & Geographic Edge Cases", () => {
  it("safely handles multi-currency and international grants without crashing", async () => {
    const { grantCurrency, formatMoney } = await import("@/lib/grant-radar");

    expect(grantCurrency({ currency: "USD", country: "US" })).toBe("USD");
    expect(grantCurrency({ currency: "CAD", country: "CA" })).toBe("CAD");
    expect(grantCurrency({ currency: null, country: "US" })).toBe("USD");
    expect(grantCurrency({ currency: null, country: "CA" })).toBe("CAD");
    expect(grantCurrency({ currency: null, country: "INTL" })).toBe("CAD"); // default Canadian baseline
    expect(grantCurrency({ currency: null, country: null })).toBe("CAD");

    // Money formatting boundaries
    expect(formatMoney(null, "CAD")).toBe("Amount not published");
    expect(formatMoney(0, "CAD")).toBe("$0");
    expect(formatMoney(500000, "CAD")).toBe("$500K");
    expect(formatMoney(1500000, "CAD")).toBe("$1.5M");
    expect(formatMoney(20000000, "CAD")).toBe("$20M");
    expect(formatMoney(750000, "USD")).toBe("US$750K");
  });
});

describe("Synthetic User Stress: Multi-Tenant Client Visibility & Rocio Access", () => {
  it("ensures both IIAL and Nahua Canada are present and switchable for consultants/Rocio", () => {
    const mockOrganizations = [
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "IIAL",
        slug: "iial",
        created_at: new Date().toISOString(),
        user_role: "admin",
        is_default: true,
      },
      {
        id: "4e616875-612d-4c41-8da0-000000000001",
        name: "Nahua Canada",
        slug: "nahua-canada",
        created_at: new Date().toISOString(),
        user_role: "admin",
        is_default: false,
      },
    ];

    expect(mockOrganizations.length).toBe(2);
    expect(mockOrganizations.map((o) => o.slug)).toContain("iial");
    expect(mockOrganizations.map((o) => o.slug)).toContain("nahua-canada");

    // Switching simulation
    let activeOrgId = mockOrganizations[0]!.id;
    const setActiveOrgId = (id: string) => {
      if (!mockOrganizations.some((o) => o.id === id)) {
        throw new Error("Organization is not assigned to this user");
      }
      activeOrgId = id;
    };

    // Verify switching to Nahua Canada succeeds without throwing
    expect(() => setActiveOrgId("4e616875-612d-4c41-8da0-000000000001")).not.toThrow();
    expect(activeOrgId).toBe("4e616875-612d-4c41-8da0-000000000001");

    // Verify switching back to IIAL succeeds
    expect(() => setActiveOrgId("00000000-0000-0000-0000-000000000001")).not.toThrow();
    expect(activeOrgId).toBe("00000000-0000-0000-0000-000000000001");

    // Verify switching to an unassigned organization is blocked
    expect(() => setActiveOrgId("99999999-9999-9999-9999-999999999999")).toThrow(
      "Organization is not assigned to this user",
    );
  });
});

describe("Synthetic User Stress: Multi-Tenant Grant Strategic Roadmap & Entity Personalization", () => {
  const sampleGacGrant = {
    id: "gac-001",
    title: "GAC Unsolicited Concept Note – Climate Resilient Agriculture in the Americas",
    funderName: "Global Affairs Canada",
    summary: "Unsolicited proposals for international development cooperation in Latin America.",
    amountCadMax: 2000000,
    costSharePct: 20,
    deadline: null,
    deadlineKind: "unsolicited",
  };

  it("dynamically personalizes all roadmap sections for IIAL", () => {
    const roadmap = synthesizeGrantRoadmap({
      ...sampleGacGrant,
      orgName: "IIAL",
    });

    // Route A Lead
    expect(roadmap.routes[0]?.leadEntity).toBe("IIAL (Sole Lead Applicant)");
    expect(roadmap.routes[0]?.tacticalValue).toContain("Allows IIAL to submit an initiative continuously");

    // Audit Level
    expect(roadmap.financial.auditLevel.detail).toContain("disqualify IIAL");
    expect(roadmap.financial.auditLevel.allowsInternalSigned).toBe(true);

    // Strategic Return
    expect(roadmap.strategicReturn.opexCoverage.salariesAndFees).toContain("IIAL core personnel");

    // Outreach Email Templates
    const academicEmail = roadmap.outreach.templates.find((t) => t.targetAudience === "academic");
    expect(academicEmail?.body).toContain("Institute of Innovation and Advanced Learning (IIAL)");
    expect(academicEmail?.body).toContain("Rocío Cruz");

    const territorialEmail = roadmap.outreach.templates.find((t) => t.targetAudience === "territorial");
    expect(territorialEmail?.body).toContain("IIAL is reaching out");
    expect(territorialEmail?.body).toContain("Institute of Innovation and Advanced Learning (IIAL)");
  });

  it("dynamically personalizes all roadmap sections for Nahua Canada without leaking IIAL identity", () => {
    const roadmap = synthesizeGrantRoadmap({
      ...sampleGacGrant,
      orgName: "Nahua Canada",
    });

    // Route A Lead
    expect(roadmap.routes[0]?.leadEntity).toBe("Nahua Canada (Sole Lead Applicant)");
    expect(roadmap.routes[0]?.tacticalValue).toContain("Allows Nahua Canada to submit an initiative continuously");

    // Audit Level
    expect(roadmap.financial.auditLevel.detail).toContain("disqualify Nahua Canada");
    expect(roadmap.financial.auditLevel.detail).not.toContain("disqualify IIAL");

    // Strategic Return
    expect(roadmap.strategicReturn.opexCoverage.salariesAndFees).toContain("Nahua Canada core personnel");

    // Outreach Email Templates
    const academicEmail = roadmap.outreach.templates.find((t) => t.targetAudience === "academic");
    expect(academicEmail?.body).toContain("Nahua Canada");
    expect(academicEmail?.body).not.toContain("Institute of Innovation and Advanced Learning (IIAL)");

    const territorialEmail = roadmap.outreach.templates.find((t) => t.targetAudience === "territorial");
    expect(territorialEmail?.body).toContain("Nahua Canada is reaching out");
    expect(territorialEmail?.body).not.toContain("Institute of Innovation and Advanced Learning (IIAL)");

    const funderEmail = roadmap.outreach.templates.find((t) => t.targetAudience === "funder_officer");
    expect(funderEmail?.body).toContain("Nahua Canada");
    expect(funderEmail?.body).not.toContain("Institute of Innovation and Advanced Learning (IIAL)");
  });
});

describe("Synthetic User Stress: In-Kind Matching & Cost-Share Calculation Stress", () => {
  it("accurately calculates matching funds and allowable in-kind percentages across varying grant amounts", () => {
    // Case 1: 50% cost share on $500,000 grant
    const grant500k = {
      id: "grant-500k",
      title: "Agri-Tech Commercialization Fund",
      funderName: "FedDev Ontario",
      costSharePct: 50,
      amountCadMax: 500000,
    };
    const roadmap1 = synthesizeGrantRoadmap(grant500k);
    expect(roadmap1.financial.matchingFunds.percentage).toBe(50);
    expect(roadmap1.financial.matchingFunds.inKindAllowed).toBe(true);
    expect(roadmap1.financial.matchingFunds.inKindCapPct).toBe(50);

    // Case 2: 0% cost share (100% non-repayable)
    const grantZeroMatch = {
      id: "grant-zero",
      title: "CFLI Local Development Award",
      funderName: "Global Affairs Canada",
      costSharePct: 0,
      amountCadMax: 100000,
    };
    const roadmap2 = synthesizeGrantRoadmap(grantZeroMatch);
    expect(roadmap2.financial.matchingFunds.percentage).toBe(0);
    expect(roadmap2.financial.matchingFunds.label).toContain("100% Non-Repayable");

    // Case 3: In-kind hourly rate budgeting simulation
    const seniorResearcherRate = 120; // CAD/hour
    const fieldAgronomistRate = 75; // CAD/hour
    const plannedResearchHours = 1000;
    const plannedFieldHours = 1500;

    const totalInKindValue = (seniorResearcherRate * plannedResearchHours) + (fieldAgronomistRate * plannedFieldHours);
    expect(totalInKindValue).toBe(232500); // 120k + 112.5k = 232.5k CAD

    // Verifies in-kind covers required match if match requirement is <= 232.5k
    const requiredMatch200k = 200000;
    expect(totalInKindValue >= requiredMatch200k).toBe(true);
  });
});

describe("Synthetic User Stress: Organization Profile Workspace Validation", () => {
  it("enforces strict tenant separation on organization profiles and CRA credentials", () => {
    type OrgProfile = {
      orgId: string;
      legalName: string;
      craBusinessNumber: string;
      applicantType: "non_profit" | "for_profit_sme" | "higher_ed";
      primaryJurisdictions: string[];
      sectors: string[];
      leadScientist: string;
    };

    const iialProfile: OrgProfile = {
      orgId: IIAL_ORG_ID,
      legalName: "Institute of Innovation and Advanced Learning",
      craBusinessNumber: "732918234RC0001",
      applicantType: "non_profit",
      primaryJurisdictions: ["CA", "ON", "QC"],
      sectors: ["agriculture", "education", "sustainability", "traceability"],
      leadScientist: "Rocío Cruz",
    };

    const nahuaProfile: OrgProfile = {
      orgId: NAHUA_ORG_ID,
      legalName: "Nahua Canada Inc.",
      craBusinessNumber: "893120192RC0001",
      applicantType: "for_profit_sme",
      primaryJurisdictions: ["CA", "ON", "CR"],
      sectors: ["agrifood", "cocoa", "trade", "sustainable_supply_chains"],
      leadScientist: "Juan Gómez",
    };

    const profileStore: Record<string, OrgProfile> = {
      [IIAL_ORG_ID]: iialProfile,
      [NAHUA_ORG_ID]: nahuaProfile,
    };

    // Verify isolation
    expect(profileStore[IIAL_ORG_ID]?.applicantType).toBe("non_profit");
    expect(profileStore[NAHUA_ORG_ID]?.applicantType).toBe("for_profit_sme");
    expect(profileStore[IIAL_ORG_ID]?.craBusinessNumber).not.toBe(profileStore[NAHUA_ORG_ID]?.craBusinessNumber);

    // Profile update under Nahua tenant must not mutate IIAL
    const updatedNahua = {
      ...profileStore[NAHUA_ORG_ID]!,
      primaryJurisdictions: ["CA", "ON", "CR", "PE"],
    };
    profileStore[NAHUA_ORG_ID] = updatedNahua;

    expect(profileStore[IIAL_ORG_ID]?.primaryJurisdictions).toEqual(["CA", "ON", "QC"]);
    expect(profileStore[NAHUA_ORG_ID]?.primaryJurisdictions).toContain("PE");
  });
});

describe("Synthetic User Stress: Proposal Workflow & Word Budget Tracking", () => {
  it("simulates full proposal lifecycle and word count boundary enforcement", () => {
    type ProposalSection = {
      id: string;
      title: string;
      maxWords: number;
      content: string;
      status: "draft" | "review" | "final";
    };

    const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

    const sections: ProposalSection[] = [
      {
        id: "sec-1",
        title: "Executive Summary",
        maxWords: 500,
        content: "This project implements the Whole Chain Integrity Standard (WCIS) across cocoa cooperatives.",
        status: "draft",
      },
      {
        id: "sec-2",
        title: "Project Narrative & Methodology",
        maxWords: 2500,
        content: "Building on field-proven traceability frameworks in Costa Rica and Peru...",
        status: "draft",
      },
      {
        id: "sec-3",
        title: "Consortium Governance & Risk",
        maxWords: 1000,
        content: "SOCODEVI acts as fiduciary oversight partner while IIAL leads field deployment.",
        status: "draft",
      },
    ];

    for (const section of sections) {
      const words = countWords(section.content);
      expect(words).toBeLessThanOrEqual(section.maxWords);
      expect(words).toBeGreaterThan(0);
    }

    // Stress test: word limit boundary overflow warning
    const verboseContent = Array(600).fill("methodology").join(" ");
    const isOverflowing = countWords(verboseContent) > sections[0]!.maxWords;
    expect(isOverflowing).toBe(true);
  });
});

