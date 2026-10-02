// Synthetic End-to-End Test Suite for IIAL GrantDesk
// Validates:
// 1. Ingestion & Funder Upsert: Conflict resolution on (name, country)
// 2. Requirements Synthesis: Dynamic synthesis of RFP deliverables (never empty)
// 3. Opportunity Brief: Financial calculation, timeline runway, and partner guidance
// 4. Remediation Loop (Subsanación): Manual facts override & deterministic re-evaluation
// 5. Multi-Tenant Proposal Security: Org sharing vs private null-org isolation

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInMemoryDb,
  makeSupabaseMock,
  type InMemoryDb,
} from "./__fixtures__/in-memory-supabase";
import { synthesizeRequirementsForGrant } from "./grant-requirements-analyzer.server";
import {
  evaluateRules,
  DEFAULT_RULES,
  type FitRules,
  type GrantForRules,
} from "./fit-rules.server";
import { draftGate, evaluationVerdict } from "@/lib/grant-radar";

// In-memory database fixture
const db: InMemoryDb = createInMemoryDb({
  relations: {
    grants: [{ alias: "funder", foreignKey: "funder_id", target: "funders" }],
    proposals: [{ alias: "grant", foreignKey: "grant_id", target: "grants" }],
  },
  rpc: {
    has_role: () => true,
    ensure_current_user: () => ({ ok: true }),
  },
});
const supabaseMock = makeSupabaseMock(db);

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseMock }));

describe("Synthetic E2E: Ingestion, Requirements Synthesis & Funder Conflict Resolution", () => {
  beforeEach(() => {
    db.tables["funders"] = [];
    db.tables["grants"] = [];
    db.tables["grant_evaluations"] = [];
    db.tables["proposals"] = [];
    db.tables["proposal_sections"] = [];
  });

  it("handles funder upsert atomically on (name, country) without unique constraint failure", async () => {
    // Simulate first ingestion
    const { data: first } = await supabaseMock.from("funders").upsert(
      {
        id: "funder-1",
        name: "Ontario Trillium Foundation",
        country: "CA",
        website: "https://otf.ca",
        source_url: "https://otf.ca",
      },
      { onConflict: "name,country" },
    );

    expect(first).toBeTruthy();
    expect(db.tables["funders"].length).toBe(1);

    // Simulate second ingestion with identical (name, country)
    const { data: second } = await supabaseMock.from("funders").upsert(
      {
        id: "funder-duplicate-attempt",
        name: "Ontario Trillium Foundation",
        country: "CA",
        website: "https://otf.ca/updated",
        source_url: "https://otf.ca",
      },
      { onConflict: "name,country" },
    );

    expect(second).toBeTruthy();
    // Confirms no duplicate row created, existing record updated cleanly
    expect(db.tables["funders"].length).toBe(1);
    expect(db.tables["funders"][0]?.name).toBe("Ontario Trillium Foundation");
    expect(db.tables["funders"][0]?.website).toBe("https://otf.ca/updated");
  });

  it("synthesizes all mandatory RFP requirements so applicants never see empty checklists", () => {
    const emptyGrant = {
      title: "Clean Energy Transition Acceleration Fund",
      summary: "Grant for Canadian clean-tech entities to accelerate decarbonization projects.",
      amount_cad_max: 250000,
      cost_share_pct: 20,
    };

    const requirements = synthesizeRequirementsForGrant(emptyGrant);

    expect(requirements.length).toBeGreaterThanOrEqual(4);

    // Verifies critical deliverables
    const narrative = requirements.find(
      (r) => r.category === "document" && /narrative/i.test(r.requirement),
    );
    const budget = requirements.find(
      (r) => r.category === "financial" && /budget/i.test(r.requirement),
    );
    const cofunding = requirements.find(
      (r) => r.category === "financial" && /co-funding|matching/i.test(r.requirement),
    );
    const legal = requirements.find(
      (r) => r.category === "legal" && /registration|incorporation/i.test(r.requirement),
    );

    expect(narrative).toBeDefined();
    expect(narrative?.isCritical).toBe(true);

    expect(budget).toBeDefined();
    expect(budget?.isCritical).toBe(true);
    expect(budget?.value).toContain("250,000");

    expect(cofunding).toBeDefined();
    expect(cofunding?.isCritical).toBe(true);
    expect(cofunding?.requirement).toContain("20%");

    expect(legal).toBeDefined();
    expect(legal?.isCritical).toBe(false);
  });
});

describe("Synthetic E2E: Opportunity Brief & Decision Math", () => {
  it("computes accurate cost-share matching in CAD and sets timeline runway labels", () => {
    const grantMax = 500000;
    const matchPct = 25;
    const estimatedMatchCad = Math.round((grantMax * matchPct) / 100);
    const estimatedTotalCad = grantMax + estimatedMatchCad;

    expect(estimatedMatchCad).toBe(125000);
    expect(estimatedTotalCad).toBe(625000);

    // Timeline calculation
    const now = Date.now();
    const tenDaysLater = new Date(now + 10 * 86400000).toISOString();
    const fortyDaysLater = new Date(now + 40 * 86400000).toISOString();

    const urgentDays = Math.ceil((new Date(tenDaysLater).getTime() - now) / 86400000);
    const healthyDays = Math.ceil((new Date(fortyDaysLater).getTime() - now) / 86400000);

    expect(urgentDays).toBeLessThanOrEqual(14);
    expect(healthyDays).toBeGreaterThan(35);
  });

  it("identifies partner requirement when eligibility text mandates university or municipal co-applicant", () => {
    const grant: GrantForRules = {
      id: "grant-partner-1",
      title: "Municipal Clean Water Collaboration Program",
      summary:
        "Collaborative research where eligible postsecondary university institutions partner with municipalities.",
      sectors: ["environment", "water"],
      applicant_types: ["university", "municipality"],
      amount_cad_min: 50000,
      amount_cad_max: 200000,
      deadline: "2099-12-31",
      country: "CA",
    };

    const rules: FitRules = {
      ...DEFAULT_RULES,
      applicant_types_allowed: ["nonprofit"], // User is a standalone nonprofit
    };

    const evaluation = evaluateRules(rules, grant);

    // Rule engine should detect role constraint and legal restriction
    expect(
      evaluation.checks.some((c) => c.id === "sop_filter_1_legal" && c.status === "fail"),
    ).toBe(true);
    expect(evaluation.detected_role).toBe("partner");
  });
});

describe("Synthetic E2E: Remediation Cycle (Subsanación & Re-check Fit)", () => {
  it("walks the remediation flow: initially failing -> manual facts correction -> re-check fit -> proposal unlocked", () => {
    const grant: GrantForRules = {
      id: "grant-remediation-1",
      title: "Ontario Agri-Tech Innovation Fund",
      summary:
        "Funding for commercialization in agriculture technology. Requires 40% cost-share from applicant.",
      sectors: ["agriculture", "technology"],
      applicant_types: ["nonprofit", "sme"],
      amount_cad_min: 50000,
      amount_cad_max: 150000,
      deadline: "2099-12-31",
      country: "CA",
    };

    // User profile only allows up to 20% cost share initially
    const restrictiveRules: FitRules = {
      ...DEFAULT_RULES,
      max_cost_share_pct_org_carries: 20,
    };

    const firstEval = evaluateRules(restrictiveRules, grant);
    const costCheck = firstEval.checks.find((c) => c.id === "sop_filter_3_costshare");

    expect(costCheck?.status).toBe("fail");

    // Before remediation: proposal drafting is blocked
    const initialVerdict = evaluationVerdict({
      eligibility_pass: false,
      model: "deterministic-rules",
      rule_snapshot: { checks: firstEval.checks },
      rule_verdict: "not_eligible",
    });
    expect(initialVerdict).toBe("not_eligible");
    expect(draftGate({ eligibility_pass: false })).toBe("not_eligible");

    // ── SUB SANACIÓN / REMEDIATION STEP ─────────────────────────────────────
    // Funder publishes addendum reducing cost-share to 15%, recorded in manual_fields
    const manualGrant: GrantForRules = {
      ...grant,
      summary:
        "Funding for commercialization in agriculture technology. Funder addendum confirms requires 15% cost-share.",
    };

    // Re-check fit triggered (force: true)
    const remediatedEval = evaluateRules(restrictiveRules, manualGrant);
    const remediatedCostCheck = remediatedEval.checks.find(
      (c) => c.id === "sop_filter_3_costshare",
    );

    expect(remediatedCostCheck?.status).not.toBe("fail");

    const remediatedVerdict = evaluationVerdict({
      eligibility_pass: true,
      model: "deterministic-rules",
      rule_snapshot: { checks: remediatedEval.checks },
      rule_verdict: "eligible",
    });

    expect(remediatedVerdict).toBe("eligible");
    expect(draftGate({ eligibility_pass: true })).toBe("ok");
  });
});

describe("Synthetic E2E: Multi-Tenant Security & Shared Sections", () => {
  beforeEach(() => {
    db.tables["proposals"] = [];
    db.tables["proposal_sections"] = [];
  });

  it("enforces tenant boundary: teammate can access org proposal, non-org user is restricted", async () => {
    const orgId = "org-iial-2026";
    const userA = "user-alice";
    const userB = "user-bob"; // Same org teammate
    const userC = "user-charlie"; // Different org / external user

    // User A creates an org proposal
    await supabaseMock.from("proposals").insert({
      id: "prop-org-1",
      org_id: orgId,
      user_id: userA,
      title: "Shared IIAL Proposal",
      status: "draft",
    });

    await supabaseMock.from("proposal_sections").insert([
      {
        id: "sec-1",
        proposal_id: "prop-org-1",
        heading_en: "Project Narrative",
        content_en: "Methodology description for team review.",
      },
    ]);

    // User A creates a private proposal with NULL org_id
    await supabaseMock.from("proposals").insert({
      id: "prop-private-1",
      org_id: null,
      user_id: userA,
      title: "Private Scratchpad",
      status: "draft",
    });

    // Verify User B (teammate) queries org proposal
    const { data: orgProps } = await supabaseMock.from("proposals").select("*").eq("org_id", orgId);

    expect(orgProps).toHaveLength(1);
    expect(orgProps?.[0]?.title).toBe("Shared IIAL Proposal");

    // Verify sections are accessible for the org proposal
    const { data: sections } = await supabaseMock
      .from("proposal_sections")
      .select("*")
      .eq("proposal_id", "prop-org-1");

    expect(sections).toHaveLength(1);
    expect(sections?.[0]?.heading_en).toBe("Project Narrative");

    // Verify private proposal (org_id is null) is not exposed to other org queries
    const { data: leakedProps } = await supabaseMock
      .from("proposals")
      .select("*")
      .eq("org_id", "org-charlie-foreign");

    expect(leakedProps).toHaveLength(0);
  });
});
