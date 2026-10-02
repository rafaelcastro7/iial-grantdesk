export const GRANT_REVIEW_CRITERIA_VERSION = "strict-v1";

export type CoverageGrant = {
  summary?: string | null;
  country?: string | null;
  deadline?: string | null;
  deadline_kind?: string | null;
  amount_cad_min?: number | null;
  amount_cad_max?: number | null;
  sectors?: string[] | null;
  eligibility?: unknown;
  eligible_applicant_types?: string[] | null;
  applicant_types?: string[] | null;
  requirements?: Array<{ requirement?: string; isCritical?: boolean }> | null;
  source_freshness_at?: string | null;
};

export type GrantCoverage = {
  pct: number;
  readyForDecision: boolean;
  missing: string[];
  criticalIssues: string[];
  checks: Record<string, boolean>;
};

function hasObjectValue(value: unknown): boolean {
  return !!value && typeof value === "object" && Object.keys(value as object).length > 0;
}

export function computeGrantCoverage(
  grant: CoverageGrant,
  evidenceFields: readonly string[],
  embeddingExists: boolean,
): GrantCoverage {
  const evidence = new Set(evidenceFields);
  const hasAmount = grant.amount_cad_min != null || grant.amount_cad_max != null;
  const hasDeadline = !!grant.deadline || grant.deadline_kind === "rolling";
  const hasApplicants =
    (grant.eligible_applicant_types?.length ?? 0) > 0 ||
    (grant.applicant_types?.length ?? 0) > 0 ||
    hasObjectValue(grant.eligibility);
  const requirementsReviewed = grant.requirements != null;
  const hasGroundedCore = [
    "summary",
    "deadline",
    "amount_cad_min",
    "amount_cad_max",
    "eligibility",
  ].some((field) => evidence.has(field));

  const checks = {
    official_source_checked: !!grant.source_freshness_at,
    summary: (grant.summary?.trim().length ?? 0) >= 40,
    jurisdiction: !!grant.country,
    deadline: hasDeadline,
    amount: hasAmount,
    sectors: (grant.sectors?.length ?? 0) > 0,
    applicants: hasApplicants,
    requirements_reviewed: requirementsReviewed,
    grounded_evidence: hasGroundedCore,
    searchable: embeddingExists,
  };
  const labels: Record<keyof typeof checks, string> = {
    official_source_checked: "official source has not been checked recently",
    summary: "program description is incomplete",
    jurisdiction: "applicant jurisdiction is unknown",
    deadline: "deadline or rolling intake is unverified",
    amount: "funding amount is unverified",
    sectors: "funding sectors are unverified",
    applicants: "eligible applicant types are unverified",
    requirements_reviewed: "application requirements have not been reviewed",
    grounded_evidence: "critical facts lack source evidence",
    searchable: "semantic search index is missing",
  };
  const entries = Object.entries(checks) as Array<[keyof typeof checks, boolean]>;
  const missing = entries.filter(([, ok]) => !ok).map(([key]) => labels[key]);
  const criticalIssues = (grant.requirements ?? [])
    .filter((item) => item.isCritical)
    .map((item) => item.requirement?.trim() || "Unresolved critical requirement");
  const pct = Math.round((entries.filter(([, ok]) => ok).length / entries.length) * 100);

  return {
    pct,
    readyForDecision: missing.length === 0 && criticalIssues.length === 0,
    missing,
    criticalIssues,
    checks,
  };
}
