// Grant dossier: the consultant's full analysis of one call, the way a senior
// grant consultant prepares it — verdict, what the brochure does not say, the routes compared,
// the official document set, money and timeline, and ready-to-send messages.
// Produced by the AI (free tier + Google search) and validated here; parts of
// it can be carried into the application plan with one click.
import { PLACEHOLDER, ROUTES, type PlanUpdate, type Route } from "@/lib/grant-workspace.shared";

export type DossierTrap = { title: string; detail: string; source_url?: string };
export type DossierRouteOption = {
  name: string;
  recommended?: boolean;
  /** One value per criterion, same order as `criteria`. */
  values: string[];
  /** How this option maps to the plan. */
  route?: Route;
  lead?: string;
};
export type DossierDocument = {
  item: string;
  details?: string[];
  critical?: boolean;
  only_for?: string;
};
export type DossierStep = { step: string; when: string; date?: string; money?: string };
export type DossierMessage = {
  to: string;
  subject?: string;
  body: string;
  channel: "email" | "whatsapp";
};

export const DOSSIER_FACT_KEYS = [
  "eligibility",
  "deadline",
  "amount",
  "eligible_costs",
  "matching_funds",
  "application_documents",
  "submission_process",
  "contact",
] as const;
export type DossierFactKey = (typeof DOSSIER_FACT_KEYS)[number];
export type DossierFactStatus = "verified" | "not_published" | "not_applicable" | "conflict";
export type DossierFact = {
  key: DossierFactKey;
  status: DossierFactStatus;
  value: string;
  source_url?: string;
};

/** The dossier's answer to "can we apply?" for the active organization. */
export type DossierFit = "lead" | "partner_only" | "not_eligible" | "next_cycle" | "unclear";
export const DOSSIER_FITS: DossierFit[] = [
  "lead",
  "partner_only",
  "not_eligible",
  "next_cycle",
  "unclear",
];

export type Dossier = {
  fit: DossierFit;
  /** One line: why, for the header. */
  fit_reason?: string;
  verdict: string;
  traps: DossierTrap[];
  routes: { criteria: string[]; options: DossierRouteOption[] };
  documents: DossierDocument[];
  timeline: DossierStep[];
  money_note?: string;
  messages: DossierMessage[];
  /** One explicit answer for every fact a reader needs before deciding. */
  facts: DossierFact[];
  questions_to_confirm?: string[];
  /** Facts the fact checker verified and saved to the grant while preparing it. */
  checked?: import("@/lib/grant-fact-check.shared").CheckedFact[];
};

const s = (v: unknown, max = 2000) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "";
const arr = (v: unknown, max = 20) => (Array.isArray(v) ? v.slice(0, max) : []);
const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * The organization's own standards (from its profile) carry no version year:
 * "<standard>-2025" and similar are invented by the AI, so the year is dropped.
 */
const versionStripper = (standards: string[] = []) => {
  const names = standards.map((x) => String(x ?? "").trim()).filter((x) => x && !/20\d\d/.test(x));
  return (t: string) =>
    names.reduce(
      (acc, st) =>
        acc.replace(new RegExp(`${escapeRe(st)}[\\s\\u2010-\\u2015-]*20\\d\\d`, "g"), st),
      t,
    );
};

/** Keeps a well-formed dossier from whatever the AI returned. */
export function sanitizeDossier(raw: unknown, opts: { standards?: string[] } = {}): Dossier | null {
  const clean = versionStripper(opts.standards);
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const verdict = clean(s(r.verdict, 1500));
  if (!verdict) return null;
  const fitRaw = s(r.fit, 20) as DossierFit;
  const fit: DossierFit = DOSSIER_FITS.includes(fitRaw) ? fitRaw : "unclear";
  const fit_reason = clean(s(r.fit_reason, 240)) || undefined;
  const traps = arr(r.traps, 8)
    .map((t) => t as Record<string, unknown>)
    .map((t) => ({
      title: clean(s(t.title, 160)),
      detail: clean(s(t.detail, 900)),
      source_url: /^https?:\/\//.test(s(t.source_url, 500)) ? s(t.source_url, 500) : undefined,
    }))
    .filter((t) => t.title && t.detail);
  const routesRaw = (r.routes ?? {}) as Record<string, unknown>;
  const criteria = arr(routesRaw.criteria, 10)
    .map((c) => clean(s(c, 120)))
    .filter(Boolean);
  const options = arr(routesRaw.options, 4)
    .map((o) => o as Record<string, unknown>)
    .map((o) => {
      const route = s(o.route, 20);
      const lead = clean(s(o.lead, 160));
      return {
        name: clean(s(o.name, 160)),
        recommended: o.recommended === true,
        values: criteria.map((_, i) => clean(s(arr(o.values, 10)[i], 300)) || "—"),
        route: (ROUTES as readonly string[]).includes(route) ? (route as Route) : undefined,
        lead: lead && !PLACEHOLDER.test(lead) ? lead : undefined,
      };
    })
    .filter((o) => o.name);
  const documents = arr(r.documents, 20)
    .map((d) => (typeof d === "string" ? { item: d } : (d as Record<string, unknown>)))
    .map((d) => ({
      item: clean(s(d.item, 200)),
      details: arr(d.details, 8)
        .map((x) => clean(s(x, 240)))
        .filter(Boolean),
      critical: d.critical === true,
      only_for: clean(s(d.only_for, 120)) || undefined,
    }))
    .filter((d) => d.item);
  const timeline = arr(r.timeline, 15)
    .map((t) => t as Record<string, unknown>)
    .map((t) => ({
      step: clean(s(t.step, 200)),
      when: clean(s(t.when, 120)),
      date: /^\d{4}-\d{2}-\d{2}$/.test(s(t.date, 10)) ? s(t.date, 10) : undefined,
      money: /^(n\/?a|none|ninguno|—|-|0|\$0|no aplica|sin costo[s]?( directos?)?)$/i.test(
        clean(s(t.money, 200)),
      )
        ? undefined
        : clean(s(t.money, 200)) || undefined,
    }))
    .filter((t) => t.step);
  const messages = arr(r.messages, 5)
    .map((m) => m as Record<string, unknown>)
    .map((m) => ({
      to: clean(s(m.to, 200)),
      subject: clean(s(m.subject, 240)) || undefined,
      body: clean(s(m.body, 5000)),
      channel: (s(m.channel, 20) === "whatsapp" ? "whatsapp" : "email") as "email" | "whatsapp",
    }))
    .filter((m) => m.body);
  const seenFacts = new Set<DossierFactKey>();
  const facts = arr(r.facts, 20)
    .map((f) => f as Record<string, unknown>)
    .flatMap((f): DossierFact[] => {
      const key = s(f.key, 40) as DossierFactKey;
      const status = s(f.status, 30) as DossierFactStatus;
      const value = clean(s(f.value, 1200));
      const sourceUrl = /^https?:\/\//i.test(s(f.source_url, 500))
        ? s(f.source_url, 500)
        : undefined;
      if (
        !(DOSSIER_FACT_KEYS as readonly string[]).includes(key) ||
        !(["verified", "not_published", "not_applicable", "conflict"] as const).includes(status) ||
        !value ||
        seenFacts.has(key)
      )
        return [];
      seenFacts.add(key);
      return [
        {
          key,
          status: status === "verified" && !sourceUrl ? "conflict" : status,
          value,
          source_url: sourceUrl,
        },
      ];
    });
  return {
    fit,
    fit_reason,
    verdict,
    traps,
    routes: { criteria, options },
    documents,
    timeline,
    money_note: clean(s(r.money_note, 1200)) || undefined,
    messages,
    facts,
    questions_to_confirm: arr(r.questions_to_confirm, 8)
      .map((q) => clean(s(q, 300)))
      .filter(Boolean),
  };
}

export function dossierCoverage(dossier: Pick<Dossier, "facts">) {
  const facts = dossier.facts ?? [];
  const byKey = new Map(facts.map((fact) => [fact.key, fact]));
  const missing = DOSSIER_FACT_KEYS.filter((key) => !byKey.has(key));
  const conflicts = facts.filter((fact) => fact.status === "conflict").map((fact) => fact.key);
  const verified = facts.filter((fact) => fact.status === "verified").length;
  const notPublished = facts.filter((fact) => fact.status === "not_published").length;
  return {
    accounted: DOSSIER_FACT_KEYS.length - missing.length,
    total: DOSSIER_FACT_KEYS.length,
    pct: Math.round(((DOSSIER_FACT_KEYS.length - missing.length) / DOSSIER_FACT_KEYS.length) * 100),
    complete: missing.length === 0,
    decisionReady: missing.length === 0 && conflicts.length === 0,
    missing,
    conflicts,
    verified,
    notPublished,
  };
}

/** Product-level acceptance test for a dossier a non-expert can use alone. */
export function auditDossierForReader(dossier: Dossier) {
  const coverage = dossierCoverage(dossier);
  const missing: string[] = [];
  if (!dossier.fit_reason?.trim()) missing.push("decision reason");
  if (!dossier.verdict.trim()) missing.push("full verdict");
  if (!coverage.complete) missing.push("decision facts");
  if (
    !["not_eligible", "unclear"].includes(dossier.fit) &&
    !dossier.routes.options.some((option) => option.recommended)
  )
    missing.push("recommended route");
  if (dossier.timeline.length === 0 && (dossier.questions_to_confirm?.length ?? 0) === 0)
    missing.push("next step");
  const unresolved = dossier.facts.filter(
    (fact) => fact.status === "not_published" || fact.status === "conflict",
  );
  if (unresolved.length > 0 && (dossier.questions_to_confirm?.length ?? 0) === 0)
    missing.push("questions for unpublished facts");
  if (
    unresolved.length > 0 &&
    !dossier.messages.some((message) => message.channel === "email" && message.body.trim())
  )
    missing.push("ready-to-send funder email");
  return { ready: missing.length === 0, missing, coverage };
}

/**
 * Ensures a generated dossier answers every decision fact explicitly. Missing
 * information becomes “not published”; it is never filled with generic grant
 * assumptions. Source-backed database facts override an uncertain model value.
 */
export function completeDossierFacts(
  dossier: Dossier,
  grant: {
    deadline?: unknown;
    deadline_kind?: unknown;
    amount_cad_min?: unknown;
    amount_cad_max?: unknown;
    amount_min?: unknown;
    amount_max?: unknown;
    currency?: unknown;
    applicant_types?: unknown;
    eligible_applicant_types?: unknown;
    eligibility_note?: unknown;
    funding_uses?: unknown;
  },
  options: { lang: "en" | "es"; officialUrl?: string },
): Dossier {
  const es = options.lang === "es";
  const facts = new Map((dossier.facts ?? []).map((fact) => [fact.key, fact]));
  const verified = (key: DossierFactKey, value: string) => {
    if (!value || !options.officialUrl) return;
    facts.set(key, {
      key,
      status: "verified",
      value,
      source_url: options.officialUrl,
    });
  };
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const strings = (value: unknown) =>
    Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];

  const deadline = text(grant.deadline);
  if (deadline) verified("deadline", deadline);
  else if (text(grant.deadline_kind) === "rolling")
    verified(
      "deadline",
      es ? "Convocatoria continua, sin fecha fija." : "Rolling intake; no fixed deadline.",
    );

  const min = grant.amount_cad_min ?? grant.amount_min;
  const max = grant.amount_cad_max ?? grant.amount_max;
  if (typeof min === "number" || typeof max === "number") {
    const range = [
      typeof min === "number" ? min.toLocaleString("en-US") : null,
      typeof max === "number" ? max.toLocaleString("en-US") : null,
    ]
      .filter(Boolean)
      .join("–");
    verified("amount", `${range} ${text(grant.currency) || "CAD"}`);
  }

  const applicants = [
    ...strings(grant.eligible_applicant_types),
    ...strings(grant.applicant_types),
  ];
  const eligibility = text(grant.eligibility_note) || [...new Set(applicants)].join(", ");
  if (eligibility) verified("eligibility", eligibility);
  const uses = strings(grant.funding_uses);
  if (uses.length) verified("eligible_costs", [...new Set(uses)].join(", "));

  for (const key of DOSSIER_FACT_KEYS) {
    if (facts.has(key)) continue;
    facts.set(key, {
      key,
      status: "not_published",
      value: es
        ? "No publicado en las fuentes revisadas; se incluyó en las preguntas preparadas para el financiador."
        : "Not published in the reviewed sources; included in the prepared questions for the funder.",
    });
  }
  return { ...dossier, facts: DOSSIER_FACT_KEYS.map((key) => facts.get(key)!) };
}

export function dossierFactLabel(key: DossierFactKey, lang: "en" | "es" = "en") {
  const labels: Record<DossierFactKey, [string, string]> = {
    eligibility: ["Who can apply", "Quién puede aplicar"],
    deadline: ["Deadline", "Fecha límite"],
    amount: ["Award amount", "Monto"],
    eligible_costs: ["Eligible costs", "Costos elegibles"],
    matching_funds: ["Matching funds", "Aporte requerido"],
    application_documents: ["Documents and forms", "Documentos y formularios"],
    submission_process: ["Submission process", "Proceso de envío"],
    contact: ["Program contact", "Contacto del programa"],
  };
  return labels[key][lang === "es" ? 1 : 0];
}

/**
 * The AI's "no role possible" stands only when the deterministic rules also
 * block the organization (same policy as the evaluator); otherwise it is a
 * question to confirm with the funder, never a closed door.
 */
export function reconcileFit(
  fit: DossierFit,
  ruleVerdict: "eligible" | "needs_input" | "not_eligible" | undefined,
): DossierFit {
  return fit === "not_eligible" && ruleVerdict !== "not_eligible" ? "unclear" : fit;
}

/** The plan changes for "Use this route", "Add these documents", "Add these dates". */
export function dossierToPlan(
  d: Dossier,
  part: "route" | "documents" | "timeline" | "traps",
  optionIndex = 0,
): PlanUpdate {
  if (part === "route") {
    const o = d.routes.options[optionIndex];
    if (!o) return {};
    return {
      ...(o.route ? { route: o.route } : {}),
      ...(o.lead ? { lead_institution: o.lead } : {}),
      note: o.name,
    };
  }
  if (part === "documents")
    return {
      add_checklist: d.documents.map((x) => ({
        item: x.only_for ? `${x.item} (${x.only_for})` : x.item,
        critical: !!x.critical,
      })),
    };
  if (part === "timeline")
    return {
      add_milestones: d.timeline
        .filter((t) => t.date)
        .map((t) => ({ label: t.step, date: t.date! })),
    };
  return { add_blockers: d.traps.map((t) => t.title) };
}

/** "Can we apply?" in words, and its colour. */
export function fitLabel(fit: DossierFit, lang: "en" | "es" = "en"): string {
  const es = lang === "es";
  switch (fit) {
    case "lead":
      return es ? "Sí — como líder o co-aplicante" : "Yes — as lead or co-applicant";
    case "partner_only":
      return es ? "Solo como socio de un líder elegible" : "Only as partner of an eligible lead";
    case "not_eligible":
      return es ? "No — ningún rol posible" : "No — no role possible";
    case "next_cycle":
      return es ? "Sí, para el próximo ciclo" : "Yes, for the next cycle";
    default:
      return es ? "Por confirmar con el financiador" : "To confirm with the funder";
  }
}

export function fitTone(fit: DossierFit): "good" | "warn" | "bad" | "muted" {
  return fit === "lead" || fit === "next_cycle"
    ? "good"
    : fit === "partner_only" || fit === "unclear"
      ? "warn"
      : "bad";
}
