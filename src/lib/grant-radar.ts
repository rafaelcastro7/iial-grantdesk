// Grant Radar — single, pure source of truth for how the radar classifies,
// filters, prioritises and groups grants. No React, no I/O: every rule here is
// deterministic and unit-tested (src/lib/grant-radar.test.ts).
//
// The verdict is read from the stored deterministic evaluation; nothing here
// asks a model or guesses. "needs_input" is a real answer, not a failure.
//
// When a client profile is supplied, every grant is first run through the
// deterministic rules engine (src/lib/eligibility.ts) — that verdict wins
// over any stored model evaluation, and ineligible grants are pre-filtered
// out of the list (counted, and one toggle away).

import { decideEligibility } from "@/lib/eligibility";

export type RadarVerdict = "eligible" | "needs_input" | "not_eligible";
export type RadarTiming = "closed" | "too_soon" | "urgent" | "comfortable" | "open_ended";
export type RadarNextAction = "enrich" | "evaluate" | "draft" | "open";
export type RadarStatusFilter = "active" | "new" | "pursuing" | "closed" | "all";
export type RadarVerdictFilter = "all" | RadarVerdict;

export type RadarGrant = {
  id: string;
  title?: string | null;
  status: string;
  country?: string | null;
  deadline?: string | null;
  amount_cad_min?: number | null;
  amount_cad_max?: number | null;
  sectors?: string[] | null;
  enriched_at?: string | null;
  fit_score?: number | null;
  hardBlocked?: boolean;
  combinedRelevance?: number;
  funder?:
    | { name?: string | null; country?: string | null }
    | Array<{ name?: string | null; country?: string | null }>
    | null;
  evaluation?: { eligibility_pass: boolean; fit_score?: number | null } | null;
  summary?: string | null;
  amount_min?: number | null;
  amount_max?: number | null;
  currency?: string | null;
  eligible_applicant_types?: string[] | null;
  eligibility_note?: string | null;
};

/** The client the radar checks every grant against. */
export type RadarRulesProfile = {
  jurisdictions: string[];
  stage: string | null;
  annualBudget: number | null;
  currency: string | null;
  leadTimeWeeks: number | null;
};

export type RadarItem<T extends RadarGrant> = {
  grant: T;
  verdict: RadarVerdict;
  timing: RadarTiming;
  daysLeft: number | null;
  amount: number | null;
  fit: number | null;
  country: string;
  /** One sentence from the rules engine explaining the verdict. */
  reason: string | null;
  /** True when the verdict came from the deterministic rules engine. */
  ruled: boolean;
  nextAction: RadarNextAction;
  /** Parked items are shown after everything actionable (closed, no time, not eligible). */
  parked: boolean;
  priority: number;
};

export type RadarOptions = {
  now?: number;
  leadTimeWeeks: number;
  /** Minimum award. Grants with no published amount are kept (can't verify). */
  minAmount: number;
  country: string; // "all" or ISO code
  sector: string; // "all" or sector value
  status: RadarStatusFilter;
  verdict: RadarVerdictFilter;
  /** Local text filter (server search already ranked results when active). */
  text?: string;
  /** True when results come from a ranked server search. */
  searching?: boolean;
  /** Client profile to check against. Omitted = use stored evaluations only. */
  rules?: RadarRulesProfile | null;
  /** Pre-filter grants the rules rule out (default true). */
  hideIneligible?: boolean;
};

export type RadarGroup<T extends RadarGrant> = {
  country: string;
  items: RadarItem<T>[];
};

export type RadarResult<T extends RadarGrant> = {
  items: RadarItem<T>[];
  groups: RadarGroup<T>[];
  hiddenByAmount: number;
  hiddenByFilters: number;
  /** Grants the eligibility rules ruled out and the pre-filter removed. */
  hiddenByRules: number;
  counts: {
    eligible: number;
    needsInput: number;
    notEligible: number;
    closingSoon: number;
    pipelineValue: number;
  };
  next: RadarItem<T> | null;
};

const DAY_MS = 86_400_000;
const NEW_STATUSES = new Set(["discovered", "enriched", "scored"]);
const PURSUING_STATUSES = new Set(["shortlisted", "in_proposal", "submitted"]);
/** Outcomes the radar no longer needs to act on. */
const FINISHED_STATUSES = new Set(["won", "lost", "expired", "archived"]);

function funderOf(g: RadarGrant) {
  return Array.isArray(g.funder) ? (g.funder[0] ?? null) : (g.funder ?? null);
}

export function grantCountry(g: RadarGrant): string {
  return (g.country ?? funderOf(g)?.country ?? "").toUpperCase() || "INTL";
}

export function grantAmount(g: RadarGrant): number | null {
  return g.amount_cad_max ?? g.amount_cad_min ?? null;
}

export function verdictOf(g: RadarGrant): RadarVerdict {
  if (g.evaluation) return g.evaluation.eligibility_pass ? "eligible" : "not_eligible";
  if (g.hardBlocked) return "not_eligible";
  return "needs_input";
}

export function ruleDecision(
  g: RadarGrant,
  rules: RadarRulesProfile,
  now: number,
): { verdict: RadarVerdict; reason: string } {
  const d = decideEligibility({
    grant: {
      country: grantCountry(g),
      deadline: g.deadline ?? null,
      // Pipeline stages are not call availability; only "expired" means closed.
      status: g.status === "expired" ? "closed" : "open",
      eligibleApplicantTypes: g.eligible_applicant_types ?? null,
      amountMin: g.amount_min ?? g.amount_cad_min ?? null,
      amountMax: g.amount_max ?? g.amount_cad_max ?? null,
      currency: g.currency ?? (g.amount_min == null && g.amount_cad_min != null ? "CAD" : null),
      eligibilityNote: g.eligibility_note ?? null,
      summary: g.summary ?? null,
    },
    client: rules,
    today: new Date(now),
  });
  return {
    verdict: d.verdict === "ineligible" ? "not_eligible" : d.verdict,
    reason: d.headline,
  };
}

export function daysUntil(deadline: string | null | undefined, now: number): number | null {
  if (!deadline) return null;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now) / DAY_MS);
}

export function timingOf(daysLeft: number | null, leadTimeWeeks: number): RadarTiming {
  if (daysLeft == null) return "open_ended";
  if (daysLeft < 0) return "closed";
  const lead = Math.max(0, leadTimeWeeks) * 7;
  if (daysLeft < lead) return "too_soon";
  if (daysLeft <= lead + 14) return "urgent";
  return "comfortable";
}

export function nextActionOf(g: RadarGrant, verdict: RadarVerdict): RadarNextAction {
  if (g.status === "discovered" && !g.enriched_at) return "enrich";
  if (!g.evaluation) return "evaluate";
  if (verdict === "eligible" && ["enriched", "scored", "shortlisted"].includes(g.status)) {
    return "draft";
  }
  return "open";
}

const TIMING_POINTS: Record<RadarTiming, number> = {
  urgent: 22,
  comfortable: 16,
  open_ended: 10,
  too_soon: 0,
  closed: 0,
};
const VERDICT_POINTS: Record<RadarVerdict, number> = {
  eligible: 40,
  needs_input: 22,
  not_eligible: 0,
};

/** 0–100 score of "how worth your time is this today". */
export function priorityOf(input: {
  verdict: RadarVerdict;
  timing: RadarTiming;
  fit: number | null;
  amount: number | null;
  relevance?: number;
  searching?: boolean;
}): number {
  let score = VERDICT_POINTS[input.verdict] + TIMING_POINTS[input.timing];
  score += input.fit != null ? Math.max(0, Math.min(100, input.fit)) * 0.25 : 8;
  if (input.amount != null && input.amount > 0) {
    // log scale: $10K ≈ 0, $1M ≈ 13
    score += Math.max(0, Math.min(13, (Math.log10(input.amount) - 4) * 6.5));
  }
  if (input.searching && input.relevance != null) {
    score += Math.max(0, Math.min(1, input.relevance)) * 25;
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function toRadarItem<T extends RadarGrant>(
  g: T,
  opts: Pick<RadarOptions, "leadTimeWeeks" | "searching" | "rules"> & { now: number },
): RadarItem<T> {
  const ruled = opts.rules ? ruleDecision(g, opts.rules, opts.now) : null;
  const verdict = ruled?.verdict ?? verdictOf(g);
  const daysLeft = daysUntil(g.deadline, opts.now);
  const timing = timingOf(daysLeft, opts.leadTimeWeeks);
  const amount = grantAmount(g);
  const fit = g.evaluation?.fit_score ?? g.fit_score ?? null;
  const parked = timing === "closed" || timing === "too_soon" || verdict === "not_eligible";
  return {
    grant: g,
    verdict,
    timing,
    daysLeft,
    amount,
    fit,
    country: grantCountry(g),
    reason: ruled?.reason ?? null,
    ruled: ruled != null,
    nextAction: nextActionOf(g, verdict),
    parked,
    priority: priorityOf({
      verdict,
      timing,
      fit,
      amount,
      relevance: g.combinedRelevance,
      searching: opts.searching,
    }),
  };
}

function matchesStatus(status: string, filter: RadarStatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "new":
      return NEW_STATUSES.has(status);
    case "pursuing":
      return PURSUING_STATUSES.has(status);
    case "closed":
      return FINISHED_STATUSES.has(status);
    case "active":
    default:
      return !FINISHED_STATUSES.has(status);
  }
}

export function compareRadarItems<T extends RadarGrant>(a: RadarItem<T>, b: RadarItem<T>): number {
  if (a.parked !== b.parked) return a.parked ? 1 : -1;
  if (b.priority !== a.priority) return b.priority - a.priority;
  const ad = a.daysLeft ?? Number.POSITIVE_INFINITY;
  const bd = b.daysLeft ?? Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;
  return (a.grant.title ?? "").localeCompare(b.grant.title ?? "");
}

export function buildRadar<T extends RadarGrant>(grants: T[], opts: RadarOptions): RadarResult<T> {
  const now = opts.now ?? Date.now();
  const text = (opts.searching ? "" : (opts.text ?? "")).trim().toLowerCase();
  const sector = opts.sector.toLowerCase();

  let hiddenByAmount = 0;
  let hiddenByFilters = 0;
  let hiddenByRules = 0;
  const hideIneligible = opts.hideIneligible ?? true;
  const items: RadarItem<T>[] = [];

  for (const g of grants) {
    if (!matchesStatus(g.status, opts.status)) {
      hiddenByFilters++;
      continue;
    }
    const item = toRadarItem(g, {
      now,
      leadTimeWeeks: opts.leadTimeWeeks,
      searching: opts.searching,
      rules: opts.rules,
    });
    if (hideIneligible && item.ruled && item.verdict === "not_eligible" && opts.verdict !== "not_eligible") {
      hiddenByRules++;
      continue;
    }
    if (opts.country !== "all" && item.country !== opts.country.toUpperCase()) {
      hiddenByFilters++;
      continue;
    }
    if (sector !== "all" && !(g.sectors ?? []).some((s) => s.toLowerCase() === sector)) {
      hiddenByFilters++;
      continue;
    }
    if (opts.verdict !== "all" && item.verdict !== opts.verdict) {
      hiddenByFilters++;
      continue;
    }
    if (text) {
      const hay = `${g.title ?? ""} ${funderOf(g)?.name ?? ""}`.toLowerCase();
      if (!hay.includes(text)) {
        hiddenByFilters++;
        continue;
      }
    }
    if (opts.minAmount > 0 && item.amount != null && item.amount < opts.minAmount) {
      hiddenByAmount++;
      continue;
    }
    items.push(item);
  }

  items.sort(compareRadarItems);

  const byCountry = new Map<string, RadarItem<T>[]>();
  for (const item of items) {
    const list = byCountry.get(item.country) ?? [];
    list.push(item);
    byCountry.set(item.country, list);
  }
  const groups = [...byCountry.entries()]
    .map(([country, list]) => ({ country, items: list }))
    .sort((a, b) => {
      const aTop = a.items.filter((i) => !i.parked).length;
      const bTop = b.items.filter((i) => !i.parked).length;
      if (bTop !== aTop) return bTop - aTop;
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return a.country.localeCompare(b.country);
    });

  const counts = {
    eligible: 0,
    needsInput: 0,
    notEligible: 0,
    closingSoon: 0,
    pipelineValue: 0,
  };
  for (const item of items) {
    if (item.verdict === "eligible") counts.eligible++;
    else if (item.verdict === "needs_input") counts.needsInput++;
    else counts.notEligible++;
    if (item.timing === "urgent") counts.closingSoon++;
    if (!item.parked) counts.pipelineValue += item.amount ?? 0;
  }

  return {
    items,
    groups,
    hiddenByAmount,
    hiddenByFilters,
    hiddenByRules,
    counts,
    next: items.find((i) => !i.parked) ?? null,
  };
}

export function countryName(code: string): string {
  if (code === "INTL") return "International";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatMoney(value: number | null): string {
  if (value == null) return "Amount not published";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

export function timingLabel(item: Pick<RadarItem<RadarGrant>, "timing" | "daysLeft">): string {
  const d = item.daysLeft;
  switch (item.timing) {
    case "closed":
      return "Closed";
    case "open_ended":
      return "No fixed deadline";
    case "too_soon":
      return d === 0 ? "Closes today · not enough time" : `Closes in ${d} days · not enough time`;
    default:
      return d === 1 ? "Closes tomorrow" : `Closes in ${d} days`;
  }
}

export const VERDICT_LABELS: Record<RadarVerdict, string> = {
  eligible: "You can apply",
  needs_input: "Needs a check",
  not_eligible: "Not a fit",
};

export const NEXT_ACTION_LABELS: Record<RadarNextAction, string> = {
  enrich: "Read the source",
  evaluate: "Check eligibility",
  draft: "Start the draft",
  open: "Open",
};
