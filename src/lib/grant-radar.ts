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
import { humanizeRationale } from "@/lib/eligibility-explain";

/** Interface language for the texts this module writes (default English). */
export type RadarLang = "en" | "es";
const pickLang = (lang: RadarLang | undefined, en: string, es: string) => (lang === "es" ? es : en);

export type RadarVerdict = "eligible" | "needs_input" | "not_eligible";
export type RadarTiming = "closed" | "too_soon" | "urgent" | "comfortable" | "open_ended";
export type RadarNextAction = "enrich" | "evaluate" | "draft" | "open";
export type RadarStatusFilter = "active" | "new" | "pursuing" | "upcoming" | "closed" | "all";
export type RadarVerdictFilter = "all" | RadarVerdict;

export type RadarGrant = {
  id: string;
  title?: string | null;
  status: string;
  country?: string | null;
  deadline?: string | null;
  deadline_kind?: string | null;
  next_expected_deadline?: string | null;
  call_status?: string | null;
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
  evaluation?: {
    eligibility_pass: boolean;
    fit_score?: number | null;
    /** Rules engine verdict stored with the evaluation ("needs_input" = unclear, not a no). */
    rule_verdict?: string | null;
    model?: string | null;
    is_exhaustive?: boolean | null;
  } | null;
  summary?: string | null;
  amount_min?: number | null;
  amount_max?: number | null;
  currency?: string | null;
  eligible_applicant_types?: string[] | null;
  eligibility_note?: string | null;
  requirements?: Array<{
    category?: string;
    requirement?: string;
    value?: string;
    isCritical?: boolean;
  }> | null;
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
  /** Language of the reasons written here (default English). */
  lang?: RadarLang;
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

/**
 * The single reading of a stored evaluation, shared by the radar, the grant
 * detail and the dashboard so they never disagree. A verdict the rules engine
 * marked "needs_input" (the call does not state who can apply or where) is
 * unclear, not a rejection.
 */
export function evaluationVerdict(ev: {
  eligibility_pass: boolean;
  rule_verdict?: string | null;
  model?: string | null;
  is_exhaustive?: boolean | null;
  rule_snapshot?: unknown;
}): RadarVerdict {
  if (ev.eligibility_pass) return "eligible";
  // An AI "no" is final only when the rules also found a blocking problem.
  // Without one, the "no" is usually "not as lead" — the organization can
  // still take part as a partner (university-led, local-lead, consortium) —
  // so it is a question for the consultant, not a closed door.
  if (isFullReview(ev)) {
    const snap = (ev.rule_snapshot ?? null) as {
      hard_fail?: boolean | string | null;
      verdict?: string | null;
    } | null;
    const ruled = (v: unknown) => v === "ineligible" || v === "not_eligible";
    const hard =
      snap?.hard_fail === true ||
      snap?.hard_fail === "true" ||
      ruled(snap?.verdict) ||
      ruled(ev.rule_verdict);
    return hard || snap == null ? "not_eligible" : "needs_input";
  }
  return ev.rule_verdict === "needs_input" ? "needs_input" : "not_eligible";
}

/**
 * Whether a proposal may be drafted for this user's evaluation. The one rule
 * shared by the Draft button and the strategist on the server.
 */
export function draftGate(
  ev:
    | {
        eligibility_pass: boolean;
        model?: string | null;
        rule_snapshot?: unknown;
        rule_verdict?: string | null;
      }
    | null
    | undefined,
): "ok" | "not_evaluated" | "not_eligible" {
  if (!ev) return "not_evaluated";
  const rule_verdict =
    ev.rule_verdict ?? (ev.rule_snapshot as { verdict?: string } | null)?.verdict ?? null;
  return evaluationVerdict({ ...ev, rule_verdict }) === "eligible" ? "ok" : "not_eligible";
}

/**
 * True when the verdict comes from the AI review (or a hard rule failure,
 * which needs no AI). A rules-only pre-check has no real fit score: with few
 * evaluable rules it reads 100/100, so callers hide the score until then.
 */
export function isFullReview(ev: {
  model?: string | null;
  is_exhaustive?: boolean | null;
  rule_snapshot?: unknown;
}): boolean {
  if (ev.is_exhaustive === true) return true;
  const snap = ev.rule_snapshot as { is_exhaustive?: boolean; hard_fail?: boolean } | null;
  if (snap?.is_exhaustive === true || snap?.hard_fail === true) return true;
  return ev.model != null && ev.model !== "rules-engine-deterministic";
}

/**
 * The fit score to show, 0..100, or null while only the rules pre-check has
 * run. Every screen (radar, dashboard, detail, report) reads it through this.
 */
export function realFit(
  ev:
    | {
        fit_score?: number | null;
        model?: string | null;
        is_exhaustive?: boolean | null;
        rule_snapshot?: unknown;
      }
    | null
    | undefined,
): number | null {
  if (!ev || !isFullReview(ev) || ev.fit_score == null) return null;
  const f = Number(ev.fit_score);
  return Math.round(f <= 1 ? f * 100 : f);
}

export function verdictOf(g: RadarGrant): RadarVerdict {
  if (g.evaluation) return evaluationVerdict(g.evaluation);
  if (g.hardBlocked) return "not_eligible";
  return "needs_input";
}

export function ruleDecision(
  g: RadarGrant,
  rules: RadarRulesProfile,
  now: number,
  lang: RadarLang = "en",
): { verdict: RadarVerdict; reason: string } {
  const d = decideEligibility({
    grant: {
      country: grantCountry(g),
      deadline: g.deadline ?? null,
      // Pipeline stages are not call availability; only "expired" means closed.
      status: g.status === "expired" || (daysUntil(g.deadline, now) ?? 0) < 0 ? "closed" : "open",
      eligibleApplicantTypes: g.eligible_applicant_types ?? null,
      amountMin: g.amount_min ?? g.amount_cad_min ?? null,
      amountMax: g.amount_max ?? g.amount_cad_max ?? null,
      currency: g.currency ?? (g.amount_min == null && g.amount_cad_min != null ? "CAD" : null),
      eligibilityNote: g.eligibility_note ?? null,
      summary: g.summary ?? null,
      criticalRequirements: (g.requirements ?? [])
        .filter((requirement) => requirement.isCritical)
        .map((requirement) => requirement.requirement ?? "Critical requirement"),
    },
    client: rules,
    today: new Date(now),
  });
  return {
    verdict: d.verdict === "ineligible" ? "not_eligible" : d.verdict,
    reason: translateRuleText(d.headline, lang),
  };
}

type RuleOut = string | ((...m: string[]) => string);

// Spanish for the rules engine's sentences (src/lib/eligibility.ts). Values
// inside them (codes, dates, amounts, applicant types) are kept as written.
const RULE_TEXT_ES: Array<[RegExp, RuleOut]> = [
  [/^Meets every published requirement\.$/, "Cumple todos los requisitos publicados."],
  [
    /^Meets the published requirements, but: ([\s\S]+)$/,
    (_, rest) => `Cumple los requisitos publicados, pero: ${translateRuleText(rest, "es")}`,
  ],
  [
    /^Meets every published requirement we can check\. ([\s\S]+)$/,
    (_, rest) =>
      `Cumple todos los requisitos publicados que podemos verificar. ${translateRuleText(rest, "es")}`,
  ],
  [
    /^This funder is multilateral and does not restrict applicants to one country\.$/,
    "Este financiador es multilateral y no limita a los postulantes a un solo país.",
  ],
  [
    /^We do not know where this client operates, so we cannot check where it may apply\.$/,
    "No sabemos dónde opera este cliente, así que no podemos verificar dónde puede postular.",
  ],
  [
    /^Open to applicants in (.+), where this client operates\.$/,
    (_, c) => `Abierto a postulantes en ${c}, donde opera este cliente.`,
  ],
  [
    /^Based in (.+), but its own terms say foreign applicants are eligible — confirm this client qualifies before drafting\.$/,
    (_, c) =>
      `Con sede en ${c}, pero sus bases admiten postulantes extranjeros: confirma que este cliente califica antes de redactar.`,
  ],
  [
    /^Restricted to (.+); this client operates in (.+)\.$/,
    (_, a, b) => `Restringido a ${a}; este cliente opera en ${b}.`,
  ],
  [
    /^This call is (.+), so it is no longer accepting applications\.$/,
    (_, st) => `Esta convocatoria figura como "${st}" y ya no recibe postulaciones.`,
  ],
  [
    /^No closing date published — this funder accepts applications continuously\.$/,
    "No publica fecha de cierre: este financiador recibe postulaciones de forma continua.",
  ],
  [
    /^We could not read the published closing date \((.+)\)\.$/,
    (_, d) => `No pudimos leer la fecha de cierre publicada (${d}).`,
  ],
  [/^Closed on (.+)\.$/, (_, d) => `Cerró el ${d}.`],
  [/^Closes on (.+) — (\d+) days left\.$/, (_, d, n) => `Cierra el ${d}: quedan ${n} días.`],
  [/^Closes on (.+)\.$/, (_, d) => `Cierra el ${d}.`],
  [
    /^This funder does not publish a machine-readable applicant list — read their terms\.$/,
    "Este financiador no publica una lista legible de postulantes elegibles: revisa sus bases.",
  ],
  [
    /^Open to (.+)\. We do not know this client's legal form\.$/,
    (_, t) => `Abierto a ${t}. No conocemos la forma jurídica de este cliente.`,
  ],
  [
    /^Open to (.+), which is what this client is\.$/,
    (_, t) => `Abierto a ${t}, que corresponde a este cliente.`,
  ],
  [
    /^Open to (.+) only; this client is (.+)\.$/,
    (_, a, b) => `Solo abierto a ${a}; este cliente es ${b}.`,
  ],
  [
    /^No critical pre-application requirement has been extracted\.$/,
    "No se ha extraído ningún requisito crítico previo a la postulación.",
  ],
  [/^Resolve before drafting: ([\s\S]+)\.$/, (_, r) => `Resolver antes de redactar: ${r}.`],
  [
    /^Not enough figures published to compare this award against the client's budget\.$/,
    "No hay cifras suficientes publicadas para comparar este monto con el presupuesto del cliente.",
  ],
  [
    /^The smallest award here \((.+?)\) is more than twice this client's annual budget — winnable, but a stretch\.$/,
    (_, a) =>
      `El monto mínimo aquí (${a}) supera el doble del presupuesto anual de este cliente: se puede ganar, pero es exigente.`,
  ],
  [
    /^The smallest award here \((.+?)\) is ([\d.]+)x this client's annual budget/,
    (_, a, r) =>
      `El monto mínimo aquí (${a}) equivale a ${r} veces el presupuesto anual de este cliente: probablemente excede lo que puede gestionar.`,
  ],
  [
    /^Award size fits an organization of this client's scale, though the most it pays \((.+?)\)/,
    (_, a) =>
      `El monto se ajusta a una organización de la escala de este cliente, aunque el máximo que paga (${a}) es menos del 2% del presupuesto anual.`,
  ],
  [
    /^Award size fits an organization of this client's scale\.$/,
    "El monto se ajusta a una organización de la escala de este cliente.",
  ],
  [
    /^This call does not say whether the applicant must contribute anything\.$/,
    "Esta convocatoria no indica si el postulante debe aportar algo.",
  ],
  [/^The funder covers the full cost\.$/, "El financiador cubre el costo total."],
  [
    /^The applicant is expected to carry about (\d+)% of the cost\. Confirm that before drafting\.$/,
    (_, n) =>
      `Se espera que el postulante cubra cerca del ${n}% del costo. Confírmalo antes de redactar.`,
  ],
  [
    /^No closing date, so there is no deadline to race\.$/,
    "Sin fecha de cierre, así que no hay plazo que apure.",
  ],
  [
    /^We could not read the closing date, so we cannot say whether there is time\.$/,
    "No pudimos leer la fecha de cierre, así que no sabemos si hay tiempo.",
  ],
  [/^This call has closed\.$/, "Esta convocatoria ya cerró."],
  [
    /^(\d+) days? left, against the (\d+) weeks this client usually needs\. Winnable only if much of it is already written\.$/,
    (_, d, w) =>
      `Quedan ${d} días, frente a las ${w} semanas que este cliente suele necesitar. Solo es viable si buena parte ya está escrita.`,
  ],
  [/^(\d+) weeks to the deadline\.$/, (_, w) => `${w} semanas hasta el cierre.`],
];

/** The rules engine's sentence in the interface language (unknown text stays as is). */
export function translateRuleText(text: string, lang: RadarLang = "en"): string {
  if (lang !== "es" || !text) return text;
  for (const [re, out] of RULE_TEXT_ES) {
    const m = text.match(re);
    if (m) return typeof out === "string" ? out : out(...(m as unknown as string[]));
  }
  return text;
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

// Words an explanation uses when it actually gives a reason for "no".
const NEGATIVE_CUE =
  /\b(not|no|cannot|can't|isn't|ineligible|excluded?|only|however|but|lacks?|missing|closed|outside|restricted|requires?|fail(?:ed|s)?|unmet)\b/i;

export function toRadarItem<T extends RadarGrant>(
  g: T,
  opts: Pick<RadarOptions, "leadTimeWeeks" | "searching" | "rules" | "lang"> & { now: number },
): RadarItem<T> {
  const lang = opts.lang ?? "en";
  const ruled = opts.rules ? ruleDecision(g, opts.rules, opts.now, lang) : null;

  // Authoritative completed evaluation takes precedence over preliminary rules
  let verdict: RadarVerdict;
  let reason: string | null = null;
  let isRuled = false;

  if (g.evaluation) {
    verdict = evaluationVerdict(g.evaluation);
    const rationale = humanizeRationale(
      (g.evaluation as { rationale_en?: string }).rationale_en,
      lang,
    );
    if (verdict === "not_eligible" && ruled?.verdict === "not_eligible" && ruled.reason) {
      // The rules give the concrete, verifiable reason.
      reason = ruled.reason;
    } else if (verdict === "not_eligible" && rationale && !NEGATIVE_CUE.test(rationale)) {
      // The saved "no" stays, but its explanation argues the opposite: say so.
      reason = pickLang(
        lang,
        "The review said no, but its explanation gives no reason. Open the grant and re-check fit.",
        "La revisión dijo que no, pero su explicación no da un motivo. Abre el grant y vuelve a verificar el encaje.",
      );
    } else {
      reason = rationale ?? ruled?.reason ?? null;
    }
    isRuled = true;
  } else if (g.hardBlocked) {
    verdict = "not_eligible";
    reason = pickLang(
      lang,
      "Excluded by institutional eligibility rules.",
      "Excluido por las reglas institucionales de elegibilidad.",
    );
    isRuled = true;
  } else if (ruled) {
    // A preliminary rules pass is not a confirmed fit: the full evaluation can
    // still rule the grant out, and listing it under "You can apply" was
    // contradicted by the grant detail. Only an evaluation confirms eligibility.
    if (ruled.verdict === "eligible") {
      verdict = "needs_input";
      reason = pickLang(
        lang,
        "Passes the preliminary check — the eligibility check runs automatically.",
        "Pasa la verificación preliminar: la verificación de elegibilidad se ejecuta automáticamente.",
      );
    } else {
      verdict = ruled.verdict;
      reason = ruled.reason;
    }
    isRuled = true;
  } else {
    verdict = "needs_input";
    reason = null;
    isRuled = false;
  }

  const daysLeft = daysUntil(g.deadline, opts.now);
  const timing = timingOf(daysLeft, opts.leadTimeWeeks);
  const amount = grantAmount(g);
  // Per-user only: grants.fit_score is a global column (another member's
  // last score), so an unevaluated grant shows no fit rather than theirs.
  const fit = realFit(g.evaluation);
  const parked = timing === "closed" || timing === "too_soon" || verdict === "not_eligible";
  return {
    grant: g,
    verdict,
    timing,
    daysLeft,
    amount,
    fit,
    country: grantCountry(g),
    reason,
    ruled: isRuled,
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

function matchesStatus(
  status: string,
  filter: RadarStatusFilter,
  grant?: RadarGrant,
  now?: number,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "new":
      return NEW_STATUSES.has(status);
    case "pursuing":
      return PURSUING_STATUSES.has(status);
    case "closed":
      return FINISHED_STATUSES.has(status);
    case "upcoming": {
      const g = grant as
        | (RadarGrant & {
            deadline_kind?: string | null;
            next_expected_deadline?: string | null;
            call_status?: string | null;
          })
        | undefined;
      const dk = (g?.deadline_kind ?? "").toLowerCase();
      const cs = (g?.call_status ?? "").toLowerCase();
      const dl = g?.deadline ? daysUntil(g.deadline, now ?? Date.now()) : null;
      return (
        status === "upcoming" ||
        dk === "upcoming" ||
        dk === "closed_next_cycle" ||
        cs === "upcoming" ||
        cs === "closed_next_cycle" ||
        Boolean(g?.next_expected_deadline) ||
        (dl != null && dl > 60)
      );
    }
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
    if (!matchesStatus(g.status, opts.status, g, now)) {
      hiddenByFilters++;
      continue;
    }
    const item = toRadarItem(g, {
      now,
      leadTimeWeeks: opts.leadTimeWeeks,
      searching: opts.searching,
      rules: opts.rules,
      lang: opts.lang,
    });
    if (
      !opts.searching &&
      hideIneligible &&
      item.ruled &&
      item.verdict === "not_eligible" &&
      opts.verdict !== "not_eligible"
    ) {
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
    if (
      !opts.searching &&
      opts.minAmount > 0 &&
      item.amount != null &&
      item.amount < opts.minAmount
    ) {
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

export function countryName(code: string, lang: RadarLang = "en"): string {
  const c = (code ?? "").toUpperCase();
  if (c === "INTL" || c === "INT") return pickLang(lang, "International", "Internacional");
  if (c === "LATAM" || c === "LAC")
    return pickLang(lang, "Latin America & Caribbean", "América Latina y el Caribe");
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(c) ?? code;
  } catch {
    return code;
  }
}

/**
 * Countries always offered in the country filter, even with no grant in the
 * catalog yet (choosing one shows the empty state, which offers the web search).
 */
export const RADAR_BASE_COUNTRIES = [
  "CA",
  "US",
  "MX",
  "PE",
  "CO",
  "CR",
  "EC",
  "BO",
  "CL",
  "AR",
  "BR",
  "GT",
  "HN",
  "LATAM",
  "INTL",
] as const;

const canonicalCountry = (c: string) => {
  const u = c.trim().toUpperCase();
  return u === "INT" ? "INTL" : u === "LAC" ? "LATAM" : u;
};

/** The fixed list followed by any other country present in the catalog. */
export function radarCountryOptions(catalog: string[], selected?: string | null): string[] {
  const out: string[] = [...RADAR_BASE_COUNTRIES];
  const seen = new Set<string>(out);
  const extra = [...(catalog ?? []), ...(selected && selected !== "all" ? [selected] : [])];
  for (const raw of extra) {
    if (!raw || raw === "all") continue;
    const canon = canonicalCountry(raw);
    if (seen.has(canon)) continue;
    seen.add(canon);
    out.push(raw.trim().toUpperCase());
  }
  return out;
}

const COUNTRY_ALIASES: Record<string, string> = {
  canada: "CA",
  canadá: "CA",
  "united states": "US",
  usa: "US",
  "estados unidos": "US",
  eeuu: "US",
  mexico: "MX",
  méxico: "MX",
  peru: "PE",
  perú: "PE",
  colombia: "CO",
  "costa rica": "CR",
  ecuador: "EC",
  bolivia: "BO",
  chile: "CL",
  argentina: "AR",
  brazil: "BR",
  brasil: "BR",
  guatemala: "GT",
  honduras: "HN",
  "latin america": "LATAM",
  "latin america & caribbean": "LATAM",
  latinoamérica: "LATAM",
  latinoamerica: "LATAM",
  "américa latina": "LATAM",
  "america latina": "LATAM",
  latam: "LATAM",
  lac: "LATAM",
  international: "INTL",
  internacional: "INTL",
  multilateral: "INTL",
  intl: "INTL",
  int: "INTL",
};

/** Code for a free-text country ("Perú", "PE", "Peru (Cusco)"), or null. */
export function countryCodeOf(text: string | null | undefined): string | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower];
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const head = lower.split(/[(,/-]/)[0].trim();
  if (COUNTRY_ALIASES[head]) return COUNTRY_ALIASES[head];
  for (const [name, code] of Object.entries(COUNTRY_ALIASES)) {
    if (name.length > 3 && lower.includes(name)) return code;
  }
  return null;
}

export type RadarFocus = {
  /** Country codes, most frequent first (grant countries and partner countries). */
  countries: string[];
  /** Sector values, most frequent first. */
  sectors: string[];
};

type FocusRow = {
  workspace?: {
    priority?: string | null;
    partners?: Array<{ country?: string | null }> | null;
  } | null;
  grant?: { country?: string | null; sectors?: string[] | null } | null;
};

/**
 * What the organization cares about, read from the grants it is working on
 * (pipeline): their countries, their sectors and the partners' countries.
 * Deterministic; discarded grants are ignored.
 */
export function focusFromWorkspaces(rows: FocusRow[], limit = 6): RadarFocus {
  const countries = new Map<string, number>();
  const sectors = new Map<string, { label: string; n: number }>();
  const bump = (code: string | null) => {
    if (code) countries.set(code, (countries.get(code) ?? 0) + 1);
  };
  for (const r of rows ?? []) {
    if (r.workspace?.priority === "discard") continue;
    bump(countryCodeOf(r.grant?.country));
    for (const p of r.workspace?.partners ?? []) bump(countryCodeOf(p?.country));
    for (const s of r.grant?.sectors ?? []) {
      const key = (s ?? "").trim().toLowerCase();
      if (!key) continue;
      const cur = sectors.get(key);
      sectors.set(key, { label: cur?.label ?? s.trim(), n: (cur?.n ?? 0) + 1 });
    }
  }
  return {
    countries: [...countries.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([c]) => c),
    sectors: [...sectors.entries()]
      .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([, v]) => v.label),
  };
}

/**
 * Currency the grant's amounts are in. Amounts are stored in the funder's
 * currency (US federal calls are in USD even in the amount_cad_* columns),
 * so a US grant must never be labelled CAD.
 */
export function grantCurrency(g: {
  currency?: string | null;
  country?: string | null;
}): "CAD" | "USD" {
  const c = (g.currency ?? "").toUpperCase();
  if (c === "USD" || c === "CAD") return c;
  return (g.country ?? "").toUpperCase() === "US" ? "USD" : "CAD";
}

export function formatMoney(
  value: number | null,
  currency: "CAD" | "USD" = "CAD",
  lang: RadarLang = "en",
): string {
  if (value == null) return pickLang(lang, "Amount not published", "Monto no publicado");
  const sign = currency === "USD" ? "US$" : "$";
  if (value >= 1_000_000)
    return `${sign}${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${sign}${Math.round(value / 1_000)}K`;
  return `${sign}${value}`;
}

export function timingLabel(
  item: Pick<RadarItem<RadarGrant>, "timing" | "daysLeft">,
  lang: RadarLang = "en",
): string {
  const d = item.daysLeft;
  if (lang === "es") {
    switch (item.timing) {
      case "closed":
        return "Cerrado";
      case "open_ended":
        return "Sin fecha límite fija";
      case "too_soon":
        return d === 0
          ? "Cierra hoy · no alcanza el tiempo"
          : `Cierra en ${d} días · no alcanza el tiempo`;
      default:
        return d === 1 ? "Cierra mañana" : `Cierra en ${d} días`;
    }
  }
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

export const VERDICT_LABELS_ES: Record<RadarVerdict, string> = {
  eligible: "Puedes postular",
  needs_input: "Requiere revisión",
  not_eligible: "No encaja",
};

export function verdictLabel(v: RadarVerdict, lang: RadarLang = "en"): string {
  return lang === "es" ? VERDICT_LABELS_ES[v] : VERDICT_LABELS[v];
}

export const NEXT_ACTION_LABELS_ES: Record<RadarNextAction, string> = {
  enrich: "Leer la fuente",
  evaluate: "Verificar elegibilidad",
  draft: "Iniciar el borrador",
  open: "Abrir",
};

export function nextActionLabel(a: RadarNextAction, lang: RadarLang = "en"): string {
  return lang === "es" ? NEXT_ACTION_LABELS_ES[a] : NEXT_ACTION_LABELS[a];
}

export const NEXT_ACTION_LABELS: Record<RadarNextAction, string> = {
  enrich: "Read the source",
  evaluate: "Check eligibility",
  draft: "Start the draft",
  open: "Open",
};

// ---- Lexical fallback scoring (used when hybrid search returns few hits) ----

const FALLBACK_STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "into",
  "des",
  "les",
  "pour",
  "and/or",
  "grant",
  "grants",
  "funding",
  "fund",
  "program",
  "programs",
]);

/** Search tokens safe for a PostgREST .or() filter: no , ( ) % * and no stop words. */
export function lexicalFallbackTokens(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .replace(/[,()%*]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !FALLBACK_STOP_WORDS.has(t));
  return Array.from(new Set(tokens)).slice(0, 8);
}

/**
 * Relevance in 0.4..0.8 by the share of query tokens a grant contains; a
 * title hit counts double. Grants matching under half the tokens of a
 * multi-word query are dropped (they matched on one generic word).
 */
export function scoreLexicalFallback(
  grant: { title?: string | null; summary?: string | null; eligibility_note?: string | null },
  tokens: string[],
): { relevance: number; matched: string[] } | null {
  if (tokens.length === 0) return null;
  const title = (grant.title ?? "").toLowerCase();
  const body = `${grant.summary ?? ""} ${grant.eligibility_note ?? ""}`.toLowerCase();
  const matched = tokens.filter((t) => title.includes(t) || body.includes(t));
  if (matched.length === 0) return null;
  if (tokens.length > 1 && matched.length / tokens.length < 0.5) return null;
  const titleHits = matched.filter((t) => title.includes(t)).length;
  const weight = (matched.length + titleHits) / (tokens.length * 2);
  return { relevance: Math.round((0.4 + 0.4 * weight) * 1000) / 1000, matched };
}

// ---- Funding instrument (grant vs loan vs tax credit) ----

export type FundingKind = "grant" | "loan" | "tax_credit";

const LOAN =
  /\b(?:loans?|line of credit|repayable contribution|interest[- ]bearing|financing program|equipment financing)\b/i;
const NON_REPAYABLE = /\bnon[- ]repayable\b/i;
const TAX_CREDIT = /\btax (?:credits?|incentives?|deductions?)\b/i;

/**
 * What kind of money this is, from the title and summary. Loans must be paid
 * back and tax credits reduce taxes, so consultants should not read them as
 * grants. Non-repayable contributions stay grants.
 */
export function fundingKindOf(g: { title?: string | null; summary?: string | null }): FundingKind {
  const text = `${g.title ?? ""} ${g.summary ?? ""}`;
  if (TAX_CREDIT.test(text) && !/\bgrants?\b/i.test(g.title ?? "")) return "tax_credit";
  if (LOAN.test(g.title ?? "")) return "loan";
  if (LOAN.test(text) && !NON_REPAYABLE.test(text)) return "loan";
  return "grant";
}

export const FUNDING_KIND_LABEL: Record<FundingKind, string> = {
  grant: "Grant",
  loan: "Loan",
  tax_credit: "Tax credit",
};

export function fundingKindLabel(k: FundingKind, lang: RadarLang = "en"): string {
  if (lang !== "es") return FUNDING_KIND_LABEL[k];
  return { grant: "Grant", loan: "Préstamo", tax_credit: "Crédito fiscal" }[k];
}
