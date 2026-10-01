// SOP Stage 3: Opportunity Brief generator (IIAL Grant Finding v2).
// Synthesizes a structured one-page brief for leadership go/no-go decision.
// Uses deterministic data (grant + org + fit_rules + rule engine) and a single
// LLM call for the narrative "Strategic Angle" + "Risks" + "Win Factors" sections.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOrgProfileForUser } from "@/lib/org-profile-query";
import { explainCheck, explainCondition } from "@/lib/eligibility-explain";
import {
  DEFAULT_RULES,
  evaluateRules,
  type FitRules,
  type GrantForRules,
} from "@/agents/fit-rules.server";

const PARTNER_TYPE_LABEL: Record<string, string> = {
  municipality: "a municipality (city or town)",
  first_nation: "a First Nation or Indigenous governing body",
  university: "an eligible university or postsecondary research institution",
  co_applicant: "a formal co-applicant partner",
  other: "a partner organization",
};

export type Brief = {
  program_snapshot: {
    funder: string | null;
    program: string;
    url: string | null;
    max_amount_cad: number | null;
    cost_share_pct_org: number | null;
    deadline: string | null;
    intake: "fixed" | "rolling" | "unknown";
    days_remaining?: number | null;
    runway_label?: string | null;
  };
  iial_role: "lead" | "partner" | "unknown";
  partner: {
    needed: boolean;
    type: "municipality" | "first_nation" | "university" | "co_applicant" | "other" | null;
    note: string;
    recommended_action?: string;
  };
  executive_summary?: string;
  strategic_angle: string;
  win_factors?: string[];
  mandatory_components: string[];
  application_checklist: string[];
  money: {
    request_amount: number | null;
    match_required_pct: number | null;
    estimated_match_cad?: number | null;
    estimated_total_cad?: number | null;
    in_kind_cap_pct: number | null;
    in_kind_allowed?: boolean | null;
    cash_match_verified: boolean;
    funding_uses?: string[];
  };
  risks: string[];
  recommendation: {
    verdict: "go" | "no_go" | "go_conditional";
    reason: string;
    conditions: string[];
  };
  filters: { id: string; label: string; status: string; hard: boolean; detail: string }[];
};

export const generateOpportunityBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ grantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { grantId } = data;
    const { supabase, userId } = context;

    const [{ data: g, error: gerr }, { data: rulesRow }, { data: org }] = await Promise.all([
      supabase
        .from("grants")
        .select(
          "id, title, summary, amount_cad_min, amount_cad_max, amount_min, amount_max, currency, deadline, deadline_kind, eligibility, eligibility_note, sectors, country, url, requirements, funding_uses, populations_served, applicant_types, eligible_applicant_types, historical_awards, funder:funders(name, website, country)",
        )
        .eq("id", grantId)
        .maybeSingle(),
      supabase.from("fit_rules").select("*").eq("user_id", userId).maybeSingle(),
      getOrgProfileForUser(supabase, userId),
    ]);
    if (gerr) throw new Error(gerr.message);
    if (!g) throw new Error("grant_not_found");

    const rules = (rulesRow as FitRules | null) ?? DEFAULT_RULES;
    const rr = evaluateRules(rules, g as GrantForRules);

    // Determine intake type
    const intake: "fixed" | "rolling" | "unknown" = rr.rolling_intake
      ? "rolling"
      : g.deadline
        ? "fixed"
        : "unknown";

    // Recommendation logic (tri-state per SOP Stage 4)
    const hardFails = rr.checks.filter((c) => c.status === "fail" && c.hard);
    const softFails = rr.checks.filter((c) => c.status === "fail" && !c.hard);
    const warnings = rr.checks.filter((c) => c.status === "warn");

    let verdict: "go" | "no_go" | "go_conditional";
    let reason: string;
    const conditions: string[] = [];

    if (hardFails.length > 0) {
      verdict = "no_go";
      reason = `Not recommended: ${[...new Set(hardFails.map(explainCheck))].join(" ")}`;
    } else if (softFails.length > 0 || warnings.length > 0) {
      verdict = "go_conditional";
      reason = "Worth pursuing once the operational points below are confirmed.";
      for (const c of [...softFails, ...warnings]) conditions.push(explainCondition(c));
    } else {
      verdict = "go";
      reason = "Recommended: Strong strategic alignment and satisfies all organization eligibility criteria.";
    }

    // Borderline score advisory
    if (verdict !== "no_go" && rr.rule_score < 80) {
      conditions.push(
        `Moderate alignment (${rr.rule_score}/100): Schedule a 15-minute concept call with the Program Officer to validate scope before writing.`,
      );
      if (verdict === "go") verdict = "go_conditional";
    }

    if (rr.cost_share_pct !== null && rr.cost_share_pct > 0 && rules.require_match_verification) {
      conditions.push(
        `Co-funding sign-off: Confirm internal or partner commitment for ~${rr.cost_share_pct}% matching contribution.`,
      );
      if (verdict === "go") verdict = "go_conditional";
    }

    const orgName = org?.org_name?.trim() || "your organization";
    const funderName = (g.funder as { name?: string } | null)?.name ?? null;

    // Timeline calculation
    let days_remaining: number | null = null;
    let runway_label: string | null = null;
    if (g.deadline) {
      const ms = new Date(g.deadline).getTime() - Date.now();
      days_remaining = Math.ceil(ms / (1000 * 60 * 60 * 24));
      if (days_remaining < 0) {
        runway_label = "Closed / Deadline passed";
      } else if (days_remaining <= 14) {
        runway_label = `Urgent: ${days_remaining}d remaining`;
      } else if (days_remaining <= 35) {
        runway_label = `Active: ${days_remaining}d remaining`;
      } else {
        runway_label = `Healthy runway: ${days_remaining}d remaining`;
      }
    } else if (rr.rolling_intake) {
      runway_label = "Continuous / Rolling intake";
    }

    // Financial math
    const max_amount_cad = (g.amount_cad_max ?? g.amount_cad_min ?? g.amount_max ?? null) as number | null;
    const match_required_pct = rr.cost_share_pct;
    const estimated_match_cad =
      max_amount_cad && match_required_pct !== null && match_required_pct > 0
        ? Math.round((max_amount_cad * match_required_pct) / 100)
        : null;
    const estimated_total_cad = max_amount_cad
      ? estimated_match_cad
        ? max_amount_cad + estimated_match_cad
        : max_amount_cad
      : null;

    // In-kind policy heuristic (Canadian innovation / tri-council standard allowance up to 50%)
    const in_kind_allowed = match_required_pct !== null && match_required_pct > 0;
    const in_kind_cap_pct = in_kind_allowed ? 50 : null;

    // Partner guidance
    let partnerNote = "";
    let recommendedPartnerAction = "No external partner required; eligible to submit directly as sole lead applicant.";
    if (rr.detected_role === "partner") {
      partnerNote = `You'll likely need to apply alongside ${PARTNER_TYPE_LABEL[rr.detected_partner_type ?? "other"]} — the eligibility text implies ${orgName} cannot apply as the sole lead entity.`;
      switch (rr.detected_partner_type) {
        case "university":
          recommendedPartnerAction =
            "Identify an eligible university/college research co-applicant. Request a formal Letter of Support and establish overhead/IP terms.";
          break;
        case "municipality":
          recommendedPartnerAction =
            "Engage local municipal leadership / economic development department to secure Council endorsement or CAO sponsor letter.";
          break;
        case "first_nation":
          recommendedPartnerAction =
            "Initiate Indigenous community consultation with Band/Tribal Council; secure formal Band Council Resolution (BCR).";
          break;
        case "co_applicant":
          recommendedPartnerAction =
            "Execute a bilateral MOU or partnership agreement defining budget split, IP allocation, and project governance.";
          break;
        default:
          recommendedPartnerAction =
            "Line up an eligible co-applicant organization and secure mutual commitment documentation.";
      }
    } else if (rr.detected_role === "lead") {
      partnerNote = `${orgName} qualifies to apply as the lead applicant directly without mandatory external institutional co-applicants.`;
    } else {
      partnerNote = "Applicant role is ambiguous in the official text — verify applicant classification with the funder prior to assembling the team.";
      recommendedPartnerAction = "Confirm directly with the funder program officer whether independent non-profit/SME applications are accepted.";
    }

    // Extract requirements from database or synthesize baseline if empty
    type RequirementRow = { requirement?: string; category?: string; isCritical?: boolean; value?: string };
    let rawRequirements = (
      Array.isArray((g as { requirements?: unknown }).requirements)
        ? ((g as { requirements: RequirementRow[] }).requirements ?? [])
        : []
    ).filter((r) => typeof r.requirement === "string" && r.requirement.trim());

    if (rawRequirements.length === 0) {
      const { synthesizeRequirementsForGrant } = await import(
        "@/agents/grant-requirements-analyzer.server"
      );
      rawRequirements = synthesizeRequirementsForGrant({
        title: g.title,
        summary: g.summary,
        eligibility_note: g.eligibility_note,
        eligibility: g.eligibility,
        funding_uses: g.funding_uses,
        amount_cad_max: max_amount_cad,
        cost_share_pct: rr.cost_share_pct,
        applicant_types: g.applicant_types,
        funder_name: funderName,
      });
      if (rawRequirements.length > 0) {
        supabase
          .from("grants")
          .update({ requirements: rawRequirements } as never)
          .eq("id", grantId)
          .then();
      }
    }

    const extractedRequirements = rawRequirements.map((r) =>
      r.isCritical ? `${r.requirement} (critical)` : r.requirement!,
    );

    // Narrative parts via LLM Strategist
    const { callLlm } = await import("@/agents/llm.server");
    const { newRunId } = await import("@/lib/otel");
    const runId = newRunId();

    let executive_summary =
      verdict === "go"
        ? `High-priority opportunity: Meets ${orgName}'s eligibility criteria and aligns with core capabilities.`
        : verdict === "go_conditional"
          ? `Viable opportunity with conditions: Satisfies thematic criteria, but requires fulfilling the pre-drafting action items above.`
          : `Not recommended for ${orgName}: Key eligibility barriers or strategic exclusions preclude a competitive application.`;

    let strategic_angle = "—";
    let mandatory_components: string[] = [];
    let risks: string[] = [];
    let win_factors: string[] = [
      "Explicitly quantify socio-economic and innovation impact for Canadian stakeholders.",
      "Provide verified letters of support from end-users or community beneficiaries.",
      "Clear milestone breakdown with realistic risk mitigation mechanisms.",
    ];

    try {
      const llm = await callLlm({
        agent: "strategist",
        runId,
        temperature: 0.2,
        responseFormat: "json",
        validate: (text) => {
          try {
            const v = JSON.parse(text) as Record<string, unknown>;
            return (
              typeof v.strategic_angle === "string" ||
              typeof v.executive_summary === "string" ||
              Array.isArray(v.mandatory_components) ||
              Array.isArray(v.risks)
            );
          } catch {
            return false;
          }
        },
        messages: [
          {
            role: "system",
            content:
              `You are the Senior Grant Strategist and Executive Proposal Director for ${orgName}. ` +
              "Your task is to write an incisive, realistic, and high-value Executive Brief for leadership. " +
              "NEVER use generic buzzwords or vague fluff. Provide grant-specific, commercially astute advice. " +
              "Output strict JSON with exact schema: " +
              "{\n" +
              '  "executive_summary": "1 punchy sentence delivering bottom-line assessment and main operational condition",\n' +
              '  "strategic_angle": "2-3 concrete sentences proposing the exact project narrative hook, how ' + orgName + '\'s unique capabilities win this call, and how to stand out to reviewers",\n' +
              '  "mandatory_components": ["3 to 5 explicit proposal deliverables, plans, or formal attachments required by this grant type (e.g. Detailed Gantt workplan, Knowledge Mobilization plan, EDI plan, Budget narrative & quotes, Letters of Support)"],\n' +
              '  "risks": ["3 to 5 real-world risks or traps (e.g. reimbursement cash-flow lag, intellectual property co-ownership, partner sign-off bureaucracy, matching audit compliance)"],\n' +
              '  "win_factors": ["2 to 3 tactical levers that will push this application into the top 5% of peer review scores"]\n' +
              "}",
          },
          {
            role: "user",
            content: JSON.stringify({
              grant: {
                title: g.title,
                funder: funderName,
                summary: g.summary,
                sectors: g.sectors,
                funding_uses: g.funding_uses,
                populations_served: g.populations_served,
                eligibility_note: g.eligibility_note,
                eligibility: g.eligibility,
                applicant_types: g.applicant_types,
                amount_cad_max: max_amount_cad,
                cost_share_pct: rr.cost_share_pct,
                deadline: g.deadline,
                extracted_requirements: extractedRequirements.slice(0, 10),
              },
              organization: {
                name: orgName,
                mission: org?.mission,
                sectors: org?.sectors,
                capabilities: rules.iial_capabilities,
              },
              preliminary_verdict: verdict,
              detected_partner: rr.detected_partner_type,
            }),
          },
        ],
      });

      const parsed = JSON.parse(llm.text) as {
        executive_summary?: string;
        strategic_angle?: string;
        mandatory_components?: string[];
        risks?: string[];
        win_factors?: string[];
      };

      if (parsed.executive_summary?.trim()) executive_summary = parsed.executive_summary.trim();
      if (parsed.strategic_angle?.trim()) strategic_angle = parsed.strategic_angle.trim();
      if (Array.isArray(parsed.mandatory_components) && parsed.mandatory_components.length > 0) {
        mandatory_components = parsed.mandatory_components.slice(0, 8);
      }
      if (Array.isArray(parsed.risks) && parsed.risks.length > 0) {
        risks = parsed.risks.slice(0, 8);
      }
      if (Array.isArray(parsed.win_factors) && parsed.win_factors.length > 0) {
        win_factors = parsed.win_factors.slice(0, 5);
      }
    } catch (e) {
      if (risks.length === 0) {
        risks.push(`Notice: Automated narrative refinement skipped (${e instanceof Error ? e.message : String(e)}). Baseline rules applied.`);
      }
    }

    // Merge extracted requirements with mandatory components into a clean deduplicated checklist
    const seenChecklist = new Set<string>();
    const application_checklist = [...extractedRequirements, ...mandatory_components].filter(
      (item) => {
        const key = item.toLowerCase().trim();
        if (!key || seenChecklist.has(key)) return false;
        seenChecklist.add(key);
        return true;
      },
    );

    const brief: Brief = {
      program_snapshot: {
        funder: funderName,
        program: g.title as string,
        url: (g as { url?: string | null }).url ?? null,
        max_amount_cad,
        cost_share_pct_org: rr.cost_share_pct,
        deadline: (g.deadline ?? null) as string | null,
        intake,
        days_remaining,
        runway_label,
      },
      iial_role: rr.detected_role,
      partner: {
        needed: rr.detected_role === "partner",
        type: rr.detected_partner_type,
        note: partnerNote,
        recommended_action: recommendedPartnerAction,
      },
      executive_summary,
      strategic_angle,
      win_factors,
      mandatory_components,
      application_checklist,
      money: {
        request_amount: max_amount_cad,
        match_required_pct: rr.cost_share_pct,
        estimated_match_cad,
        estimated_total_cad,
        in_kind_cap_pct,
        in_kind_allowed,
        cash_match_verified: rr.cost_share_pct === null || rr.cost_share_pct === 0,
        funding_uses: g.funding_uses ?? undefined,
      },
      risks,
      recommendation: { verdict, reason, conditions },
      filters: rr.checks.map((c) => ({
        id: c.id,
        label: c.label,
        status: c.status,
        hard: c.hard,
        detail: c.detail,
      })),
    };

    return { brief };
  });
