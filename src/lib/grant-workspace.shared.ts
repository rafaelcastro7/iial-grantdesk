// Application workspace: the working data a consultant keeps per grant —
// decision, who applies and in what role, consortium, documents checklist,
// milestones counted back from the deadline, project idea — plus the
// outputs built from it (decision memo, pipeline export). Pure and client-safe.

export const PRIORITIES = ["now", "prepare", "monitor", "discard"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = {
  now: "Apply now",
  prepare: "Prepare",
  monitor: "Monitor",
  discard: "Discard",
};

export const ROUTES = ["lead", "co_lead", "partner", "beneficiary"] as const;
export type Route = (typeof ROUTES)[number];
export const ROUTE_LABEL: Record<Route, string> = {
  lead: "Lead applicant",
  co_lead: "Co-applicant",
  partner: "Partner (another organization administers)",
  beneficiary: "Beneficiary / host",
};

export const CALL_STATUSES = [
  "open",
  "upcoming",
  "rolling",
  "closed_next_cycle",
  "invite_only",
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];
export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  open: "Open",
  upcoming: "Upcoming",
  rolling: "Continuous intake",
  closed_next_cycle: "Closed — next cycle",
  invite_only: "By invitation",
};

export const INSTRUMENTS = [
  "grant",
  "contribution",
  "repayable_contribution",
  "loan",
  "cost_share",
  "tax_credit",
  "other",
] as const;
export type Instrument = (typeof INSTRUMENTS)[number];
export const INSTRUMENT_LABEL: Record<Instrument, string> = {
  grant: "Grant",
  contribution: "Non-repayable contribution",
  repayable_contribution: "Repayable contribution",
  loan: "Loan",
  cost_share: "Cost-share",
  tax_credit: "Tax credit",
  other: "Other",
};

export const CHECK_STATUSES = ["missing", "in_progress", "have", "not_needed"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export const CHECK_STATUS_LABEL: Record<CheckStatus, string> = {
  missing: "Missing",
  in_progress: "In progress",
  have: "Ready",
  not_needed: "Not needed",
};

export type ChecklistItem = {
  id: string;
  item: string;
  status: CheckStatus;
  owner?: string | null;
  due?: string | null; // YYYY-MM-DD
  critical?: boolean;
  /** Provenance: published requirement, suggested operational work, or fact to verify. */
  basis?: "published" | "operational" | "verify";
  detail?: string;
};

export type Partner = {
  id: string;
  name: string;
  country?: string | null;
  type?: string | null; // university, college, cooperative, chamber, company, government...
  role?: string | null; // e.g. "Grant administrator", "Technical partner"
  contact?: string | null;
  status?: "to_contact" | "contacted" | "interested" | "confirmed" | "declined" | null;
};

export type Milestone = { id: string; label: string; date: string; done?: boolean };

export type Workspace = {
  id?: string;
  org_id: string;
  grant_id: string;
  priority: Priority;
  applicant_org_ids: string[];
  route: Route | null;
  lead_institution: string | null;
  administrator: string | null;
  call_status: CallStatus | null;
  deadline_time: string | null;
  deadline_timezone: string | null;
  instrument: Instrument | null;
  match_pct: number | null;
  match_in_kind_ok: boolean | null;
  project_title: string | null;
  wcis_angle: string | null;
  blockers: string[];
  partners: Partner[];
  checklist: ChecklistItem[];
  milestones: Milestone[];
  decision_notes: string | null;
  verified_at: string | null;
  updated_at?: string | null;
};

export type WorkspaceGrant = {
  id: string;
  title: string;
  url?: string | null;
  deadline?: string | null;
  deadline_kind?: string | null;
  amount_cad_min?: number | null;
  amount_cad_max?: number | null;
  currency?: string | null;
  country?: string | null;
  summary?: string | null;
  funder?: { name?: string | null } | null;
  requirements?: Array<{ requirement?: string; isCritical?: boolean }> | null;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "item";

/** Documents almost every Canadian call asks for, plus the grant's own requirements. */
/**
 * Documents the call actually asks for, detected from its own text
 * (requirements, eligibility note, summary, funder) — no AI. Each entry: when
 * it applies, its label in both languages, and whether it is critical.
 */
type DocRule = {
  key: string;
  en: string;
  es: string;
  when: (t: string, g: WorkspaceGrant) => boolean;
  critical?: boolean | ((t: string) => boolean);
};
// From the grant's country and funder only: a call's text may mention Canada
// without being Canadian ("Canada is not a FONTAGRO member").
const isCanadianFunder = (g: WorkspaceGrant, _t?: string) =>
  (g.country ?? "").toUpperCase() === "CA" ||
  /\b(canada|canadian|sshrc|nserc|cihr|mitacs|feddev|global affairs|agriculture and agri-food|aafc|nrc|irap)\b/i.test(
    `${g.funder?.name ?? ""} ${(g as { title?: string }).title ?? ""}`,
  );
const DOC_RULES: DocRule[] = [
  {
    key: "incorporation",
    en: "Proof of incorporation",
    es: "Constancia de constitución",
    when: () => true,
  },
  {
    key: "cra",
    en: "CRA business number",
    es: "Número de empresa de la CRA (BN)",
    when: (t, g) => isCanadianFunder(g, t),
  },
  {
    key: "eoi",
    en: "Expression of Interest (first step)",
    es: "Expresión de interés (primer paso)",
    when: (t) => /expression of interest|\beoi\b|manifestaci[oó]n de inter[eé]s/.test(t),
    critical: true,
  },
  {
    key: "concept",
    en: "Concept note (first step)",
    es: "Nota conceptual (primer paso)",
    when: (t) => /concept note|nota conceptual|unsolicited/.test(t),
    critical: true,
  },
  {
    key: "loi",
    en: "Letter / notice of intent",
    es: "Carta / aviso de intención",
    when: (t) => /letter of intent|notice of intent|\bloi\b|\bnoi\b|carta de intenci[oó]n/.test(t),
    critical: true,
  },
  {
    key: "partners_intl",
    en: "Registration in Partners@International",
    es: "Registro en Partners@International",
    when: (t) => /partners@international|global affairs|unsolicited (proposal|concept)/.test(t),
    critical: true,
  },
  {
    key: "portal",
    en: "Funder portal registration (allow 10+ business days)",
    es: "Registro en el portal del financiador (prever 10+ días hábiles)",
    when: (t) => /\bportal\b|register|registration|convergence|research portal|registro/.test(t),
  },
  {
    key: "audited",
    en: "Audited financial statements",
    es: "Estados financieros auditados",
    when: (t) => /audited|audit report|auditad/.test(t),
    critical: true,
  },
  {
    key: "fs",
    en: "Financial statements (last 2 years)",
    es: "Estados financieros (últimos 2 años)",
    when: (t, g) =>
      !/audited|audit report|auditad/.test(t) &&
      (/financial statement|estados financieros|financial capacity/.test(t) ||
        isCanadianFunder(g, t)),
  },
  {
    key: "attestation",
    en: "Organization attestation form (signed by the financial officer)",
    es: "Declaración de la organización (firmada por el responsable financiero)",
    when: (t) => /attestation/.test(t),
  },
  {
    key: "lead_commitment",
    en: "Commitment letter from the lead institution (administers the funds)",
    es: "Carta de compromiso de la institución líder (administra los fondos)",
    when: (t) =>
      /eligible (postsecondary )?institution|postsecondary|post-secondary|administer(ed|s)? (by|the funds)|research office|member countr|led by|lead applicant must/.test(
        t,
      ),
    critical: true,
  },
  {
    key: "consortium",
    en: "Consortium agreement / MOU with partners",
    es: "Acuerdo de consorcio / MOU con los socios",
    when: (t) => /consorti|multi-country|at least two (countries|organizations)|alianza/.test(t),
    critical: true,
  },
  {
    key: "support",
    en: "Letters of support from partners",
    es: "Cartas de apoyo de los socios",
    when: (t) => /partner|consorti|collaborat|co-applicant|letter of support|socio|alianza/.test(t),
  },
  {
    key: "match",
    en: "Match / cost-share plan (who pays what)",
    es: "Plan de contrapartida (quién aporta qué)",
    when: (t) =>
      /\bmatch(ing)?\b|cost[- ]?shar|co-?fund|cofinanc|contrapartida|at least \d+ ?%/.test(t),
    critical: true,
  },
  {
    key: "inkind",
    en: "In-kind contribution table (hours, services, methods)",
    es: "Tabla de aportes en especie (horas, servicios, metodologías)",
    when: (t) => /in-?kind|en especie/.test(t),
  },
  {
    key: "workplan",
    en: "Workplan and results framework",
    es: "Plan de trabajo y marco de resultados",
    when: (t) =>
      /work ?plan|logic model|results framework|indicators|monitoring|marco de resultados/.test(t),
  },
  {
    key: "gender",
    en: "Gender equality analysis",
    es: "Análisis de igualdad de género",
    when: (t) => /feminist|gender|g[eé]nero/.test(t),
  },
  {
    key: "indigenous",
    en: "Letter from the Indigenous community or organization involved",
    es: "Carta de la comunidad u organización indígena involucrada",
    when: (t) => /indigenous|ind[ií]gena/.test(t),
  },
  {
    key: "loan",
    en: "Repayment plan / financial projections (this is a loan)",
    es: "Plan de pago / proyecciones financieras (es un préstamo)",
    when: (t) => /\bloan|repayable|debt|pr[eé]stamo/.test(t),
    critical: true,
  },
  {
    key: "budget",
    en: "Project budget (funder template)",
    es: "Presupuesto del proyecto (plantilla del financiador)",
    when: () => true,
  },
  {
    key: "proposal",
    en: "Project description / full proposal",
    es: "Descripción del proyecto / propuesta completa",
    when: () => true,
  },
  { key: "cvs", en: "CVs of key personnel", es: "CV del personal clave", when: () => true },
];

/** The text a call is described with, for document detection. */
function callText(grant: WorkspaceGrant): string {
  const g = grant as WorkspaceGrant & { eligibility_note?: string | null; title?: string };
  return [
    g.title,
    g.summary,
    g.eligibility_note,
    g.funder?.name,
    ...(grant.requirements ?? []).map((r) => r.requirement),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

/**
 * The documents for this call: its own extracted requirements first, then the
 * documents its text calls for (a concept note for Global Affairs Canada, a
 * consortium agreement for FONTAGRO, the lead institution's commitment for a
 * university-led call…), without duplicates.
 */
export function defaultChecklist(grant: WorkspaceGrant, lang: "en" | "es" = "en"): ChecklistItem[] {
  const fromGrant = (grant.requirements ?? [])
    .map((r) => (r.requirement ?? "").trim())
    .filter(Boolean)
    .map((item, i) => ({
      id: `req-${i}-${slug(item)}`,
      item,
      status: "missing" as const,
      critical: !!grant.requirements?.[i]?.isCritical,
    }));
  const t = callText(grant);
  const detected = DOC_RULES.filter((r) => r.when(t, grant)).map((r) => ({
    id: `std-${slug(r.en)}`,
    item: lang === "es" ? r.es : r.en,
    status: "missing" as const,
    critical: typeof r.critical === "function" ? r.critical(t) : !!r.critical,
  }));
  // A requirement already extracted from the call covers the detected item
  // when one contains the other's key words (e.g. "Letters of support from partners").
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-záéíóúñ@]+/)
        .filter((w) => w.length > 4),
    );
  const covered = (d: { item: string }) =>
    fromGrant.some((g) => {
      const a = words(g.item);
      const b = [...words(d.item)];
      return b.length > 0 && b.filter((w) => a.has(w)).length / b.length >= 0.6;
    });
  const seen = new Set<string>();
  return [...fromGrant, ...detected.filter((d) => !covered(d))].filter((c) => {
    const k = c.item.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Items the call asks for that a saved plan does not have yet (for "Update from the call"). */
export function missingFromCall(
  grant: WorkspaceGrant,
  checklist: ChecklistItem[],
  lang: "en" | "es" = "en",
): ChecklistItem[] {
  const have = new Set(checklist.map((c) => c.item.trim().toLowerCase()));
  const haveIds = new Set(checklist.map((c) => c.id));
  // Standard items may have been saved in the other language: match by id too.
  return defaultChecklist(grant, lang).filter(
    (c) => !have.has(c.item.trim().toLowerCase()) && !haveIds.has(c.id),
  );
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Milestones counted back from the deadline (portal registration takes 10+ business days). */
export function defaultMilestones(
  deadline: string | null | undefined,
  today = new Date(),
  lang: "en" | "es" = "en",
): Milestone[] {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}/.test(deadline)) return [];
  const d = deadline.slice(0, 10);
  const plan: Array<[string, number, string]> = [
    ["Go / no-go decision", -35, "Decisión de aplicar o no"],
    [
      "Register in the funder portal (allow 10+ business days)",
      -30,
      "Registrarse en el portal del financiador (prever 10+ días hábiles)",
    ],
    [
      "Confirm partners and request letters of support",
      -25,
      "Confirmar socios y pedir cartas de apoyo",
    ],
    ["Concept note / first full draft", -18, "Nota conceptual / primer borrador completo"],
    ["Budget and documents complete", -10, "Presupuesto y documentos completos"],
    ["Internal review and sign-off", -5, "Revisión interna y aprobación"],
    ["Submit (aim 2 days early)", -2, "Enviar (idealmente 2 días antes)"],
  ];
  const todayIso = today.toISOString().slice(0, 10);
  if (d < todayIso) return [];
  return plan.map(([label, offset, labelEs]) => {
    const date = addDays(d, offset);
    return {
      id: slug(label),
      label: lang === "es" ? labelEs : label,
      date: date < todayIso ? todayIso : date,
    };
  });
}

export function emptyWorkspace(
  orgId: string,
  grant: WorkspaceGrant,
  lang: "en" | "es" = "en",
): Workspace {
  return {
    org_id: orgId,
    grant_id: grant.id,
    priority: "monitor",
    applicant_org_ids: [],
    route: null,
    lead_institution: null,
    administrator: null,
    call_status: grant.deadline_kind === "rolling" ? "rolling" : grant.deadline ? "open" : null,
    deadline_time: null,
    deadline_timezone: null,
    instrument: null,
    match_pct: null,
    match_in_kind_ok: null,
    project_title: null,
    wcis_angle: null,
    blockers: [],
    partners: [],
    checklist: defaultChecklist(grant, lang),
    milestones: defaultMilestones(grant.deadline, new Date(), lang),
    decision_notes: null,
    verified_at: null,
  };
}

export type ApplicantEligibility = {
  orgId: string;
  orgName: string;
  verdict: "eligible" | "needs_input" | "not_eligible";
  reasons: string[];
};

const money = (v: number | null | undefined, currency: string) =>
  v == null ? null : `${currency === "USD" ? "US$" : "$"}${Math.round(v).toLocaleString("en-CA")}`;

export function amountText(grant: WorkspaceGrant, lang: "en" | "es" = "en"): string {
  const cur = (grant.currency ?? (grant.country === "US" ? "USD" : "CAD")).toUpperCase();
  const min = money(grant.amount_cad_min, cur);
  const max = money(grant.amount_cad_max, cur);
  if (min && max) return min === max ? max : `${min} – ${max}`;
  if (max) return lang === "es" ? `hasta ${max}` : `up to ${max}`;
  if (min) return lang === "es" ? `desde ${min}` : `from ${min}`;
  return lang === "es" ? "no publicado" : "not published";
}

export function deadlineText(
  grant: WorkspaceGrant,
  ws: Pick<Workspace, "deadline_time" | "deadline_timezone" | "call_status">,
  lang: "en" | "es" = "en",
): string {
  if (!grant.deadline) {
    if (ws.call_status) return callStatusLabel(ws.call_status, lang);
    return lang === "es" ? "sin fecha fija" : "no fixed deadline";
  }
  if (lang === "es") {
    const [y, m, d] = grant.deadline.slice(0, 10).split("-").map(Number);
    const esDate = `${d} de ${ES_MONTHS[m - 1] ?? ""} de ${y}`;
    const t = [ws.deadline_time, ws.deadline_timezone].filter(Boolean).join(" ");
    return t ? `${esDate}, ${t}` : esDate;
  }
  const date = new Date(`${grant.deadline.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = [ws.deadline_time, ws.deadline_timezone].filter(Boolean).join(" ");
  return time ? `${date}, ${time}` : date;
}

const ES_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Decision memo for the decision maker, in plain (B1) English: what it is,
 * who applies and how, our methods, money, deadline, what we have and what is
 * missing, and a recommendation. Internal: it may mention blockers.
 */
/** What the memo takes from the grant dossier. */
export type MemoDossier = {
  verdict: string;
  fit?: string;
  traps?: string[];
  route?: string;
  questions?: string[];
};

/** Whole sentences up to about `max` characters. */
function firstSentences(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return end > max / 3 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function dossierLines(d: MemoDossier | null | undefined, lang: "en" | "es"): string[] {
  if (!d?.verdict) return [];
  const es = lang === "es";
  return [
    es ? "En una frase" : "In one line",
    `- ${d.fit ? `${d.fit}. ` : ""}${firstSentences(d.verdict, 600)}`,
    ...(d.route ? [`- ${es ? "Ruta recomendada" : "Recommended route"}: ${d.route}`] : []),
    ...(d.traps?.length
      ? [
          es ? "- Lo que el folleto no dice:" : "- What the brochure does not say:",
          ...d.traps.slice(0, 5).map((t) => `  · ${t}`),
        ]
      : []),
    ...(d.questions?.length
      ? [
          es ? "- Por confirmar con el financiador:" : "- To confirm with the funder:",
          ...d.questions.slice(0, 3).map((q) => `  · ${q}`),
        ]
      : []),
    "",
  ];
}

export function decisionMemo(
  grant: WorkspaceGrant,
  ws: Workspace,
  opts: {
    applicantNames: string[];
    eligibility: ApplicantEligibility[];
    recipient?: string;
    sender?: string;
    orgName?: string;
    lang?: "en" | "es";
    /** The dossier's conclusion, when there is one: it leads the memo. */
    dossier?: MemoDossier | null;
  },
): { subject: string; body: string } {
  if (opts.lang === "es") return decisionMemoEs(grant, ws, opts);
  const recipient = opts.recipient?.trim() ?? "";
  const sender = opts.sender?.trim() ?? "";
  const funder = grant.funder?.name ? ` (${grant.funder.name})` : "";
  const applicants = opts.applicantNames.length
    ? opts.applicantNames.join(" and ")
    : "not decided yet";
  const route = ws.route ? ROUTE_LABEL[ws.route] : "not decided yet";
  const ready = ws.checklist.filter((c) => c.status === "have").map((c) => c.item);
  const missing = ws.checklist.filter((c) => c.status === "missing" || c.status === "in_progress");
  const partners = ws.partners.filter((p) => p.name.trim());
  const nextMilestone = ws.milestones.find((m) => !m.done);
  const recommendation: Record<Priority, string> = {
    now: "I recommend we apply now.",
    prepare:
      "I recommend we prepare the application and decide once the missing points are solved.",
    monitor: "I recommend we monitor this call for now and not invest time yet.",
    discard: "I recommend we do not apply.",
  };
  const lines: string[] = [
    `Hi${recipient ? ` ${recipient}` : ""},`,
    "",
    `Here is a short summary of "${grant.title}"${funder}, so we can decide if we apply.`,
    "",
    ...dossierLines(opts.dossier, "en"),
    "What it is",
    grant.summary?.trim()
      ? `- ${grant.summary.trim().replace(/\s+/g, " ").slice(0, 400)}`
      : "- (see the official page)",
    grant.url ? `- Official page: ${grant.url}` : "",
    "",
    "Money and dates",
    `- Amount: ${amountText(grant)}${ws.instrument ? ` (${INSTRUMENT_LABEL[ws.instrument].toLowerCase()})` : ""}`,
    ws.match_pct != null
      ? `- We must contribute ${ws.match_pct}% of the costs${ws.match_in_kind_ok ? " (in-kind is accepted)" : ws.match_in_kind_ok === false ? " (cash only)" : ""}`
      : "",
    `- Deadline: ${deadlineText(grant, ws)}`,
    nextMilestone ? `- Next step: ${nextMilestone.label}, by ${nextMilestone.date}` : "",
    "",
    "Who applies and how",
    `- Applicant: ${applicants}`,
    `- Our role: ${route}`,
    ws.lead_institution ? `- Lead institution: ${ws.lead_institution}` : "",
    ws.administrator ? `- Who administers the funds: ${ws.administrator}` : "",
    ...opts.eligibility.map(
      (e) =>
        `- ${e.orgName}: ${e.verdict === "eligible" ? "eligible" : e.verdict === "needs_input" ? "to confirm" : "not eligible"}${e.reasons[0] ? ` — ${e.reasons[0]}` : ""}`,
    ),
    "",
    ws.project_title || ws.wcis_angle ? "Project idea" : "",
    ws.project_title ? `- ${ws.project_title}` : "",
    ws.wcis_angle ? `- How we apply our methods: ${ws.wcis_angle}` : "",
    ws.project_title || ws.wcis_angle ? "" : "",
    partners.length ? "Partners" : "",
    ...partners.map(
      (p) =>
        `- ${p.name}${p.country ? ` (${p.country})` : ""}${p.role ? `: ${p.role}` : ""}${p.status ? ` — ${p.status.replace("_", " ")}` : ""}`,
    ),
    partners.length ? "" : "",
    "What we have",
    ready.length ? ready.map((r) => `- ${r}`).join("\n") : "- Nothing confirmed yet",
    "",
    "What we are missing",
    missing.length
      ? missing
          .map(
            (c) =>
              `- ${c.item}${c.status === "in_progress" ? " (in progress)" : ""}${c.due ? `, by ${c.due}` : ""}`,
          )
          .join("\n")
      : "- Nothing, we are ready",
    ...(ws.blockers.length ? ["", "Risks / blockers", ...ws.blockers.map((b) => `- ${b}`)] : []),
    "",
    `What ${opts.orgName?.trim() || "our organization"} gets`,
    ...valueForUs(ws.route, opts.orgName?.trim() || "our organization").map((v) => `- ${v}`),
    "",
    "Recommendation",
    recommendation[ws.priority],
    ws.decision_notes?.trim() ? ws.decision_notes.trim() : "",
    "",
    "Let me know what you think.",
    "",
    sender,
  ];
  const body = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject: `Grant decision: ${grant.title}`, body };
}

function decisionMemoEs(
  grant: WorkspaceGrant,
  ws: Workspace,
  opts: {
    applicantNames: string[];
    eligibility: ApplicantEligibility[];
    recipient?: string;
    sender?: string;
    orgName?: string;
    dossier?: MemoDossier | null;
  },
): { subject: string; body: string } {
  const recipient = opts.recipient?.trim() ?? "";
  const sender = opts.sender?.trim() ?? "";
  const org = opts.orgName?.trim() || "our organization";
  const funder = grant.funder?.name ? ` (${grant.funder.name})` : "";
  const applicants = opts.applicantNames.length
    ? opts.applicantNames.join(" y ")
    : "aún no decidido";
  const route = ws.route ? routeLabel(ws.route, "es") : "aún no decidido";
  const ready = ws.checklist.filter((c) => c.status === "have").map((c) => c.item);
  const missing = ws.checklist.filter((c) => c.status === "missing" || c.status === "in_progress");
  const partners = ws.partners.filter((p) => p.name.trim());
  const nextMilestone = ws.milestones.find((m) => !m.done);
  const partnerStatus: Record<string, string> = {
    to_contact: "por contactar",
    contacted: "contactado",
    interested: "interesado",
    confirmed: "confirmado",
    declined: "declinó",
  };
  const recommendation: Record<Priority, string> = {
    now: "Recomiendo que apliquemos ya.",
    prepare:
      "Recomiendo que preparemos la postulación y decidamos cuando resolvamos los puntos pendientes.",
    monitor:
      "Recomiendo que por ahora solo monitoreemos esta convocatoria y no invirtamos tiempo todavía.",
    discard: "Recomiendo que no apliquemos.",
  };
  const lines: string[] = [
    `Hola${recipient ? ` ${recipient}` : ""}:`,
    "",
    `Le comparto un breve resumen de "${grant.title}"${funder}, para que decidamos si aplicamos.`,
    "",
    ...dossierLines(opts.dossier, "es"),
    "Qué es",
    grant.summary?.trim()
      ? `- ${grant.summary.trim().replace(/\s+/g, " ").slice(0, 400)}`
      : "- (ver la página oficial)",
    grant.url ? `- Página oficial: ${grant.url}` : "",
    "",
    "Monto y fechas",
    `- Monto: ${amountText(grant, "es")}${ws.instrument ? ` (${instrumentLabel(ws.instrument, "es").toLowerCase()})` : ""}`,
    ws.match_pct != null
      ? `- Debemos aportar el ${ws.match_pct}% de los costos${ws.match_in_kind_ok ? " (se acepta aporte en especie)" : ws.match_in_kind_ok === false ? " (solo en efectivo)" : ""}`
      : "",
    `- Fecha límite: ${deadlineText(grant, ws, "es")}`,
    nextMilestone ? `- Próximo paso: ${nextMilestone.label}, antes del ${nextMilestone.date}` : "",
    "",
    "Quién aplica y cómo",
    `- Aplicante: ${applicants}`,
    `- Nuestro rol: ${route}`,
    ws.lead_institution ? `- Institución líder: ${ws.lead_institution}` : "",
    ws.administrator ? `- Quién administra los fondos: ${ws.administrator}` : "",
    ...opts.eligibility.map(
      (e) =>
        `- ${e.orgName}: ${e.verdict === "eligible" ? "elegible" : e.verdict === "needs_input" ? "por confirmar" : "no elegible"}${e.reasons[0] ? ` — ${e.reasons[0]}` : ""}`,
    ),
    "",
    ws.project_title || ws.wcis_angle ? "Idea de proyecto" : "",
    ws.project_title ? `- ${ws.project_title}` : "",
    ws.wcis_angle ? `- Cómo aplicamos nuestros métodos: ${ws.wcis_angle}` : "",
    "",
    partners.length ? "Socios" : "",
    ...partners.map(
      (p) =>
        `- ${p.name}${p.country ? ` (${p.country})` : ""}${p.role ? `: ${p.role}` : ""}${p.status ? ` — ${partnerStatus[p.status] ?? p.status}` : ""}`,
    ),
    "",
    "Qué tenemos",
    ready.length ? ready.map((r) => `- ${r}`).join("\n") : "- Nada confirmado todavía",
    "",
    "Qué nos falta",
    missing.length
      ? missing
          .map(
            (c) =>
              `- ${c.item}${c.status === "in_progress" ? " (en curso)" : ""}${c.due ? `, antes del ${c.due}` : ""}`,
          )
          .join("\n")
      : "- Nada, estamos listos",
    ...(ws.blockers.length ? ["", "Riesgos / bloqueos", ...ws.blockers.map((b) => `- ${b}`)] : []),
    "",
    `Qué gana ${org}`,
    ...valueForUs(ws.route, org, "es").map((v) => `- ${v}`),
    "",
    "Recomendación",
    recommendation[ws.priority],
    ws.decision_notes?.trim() ? ws.decision_notes.trim() : "",
    "",
    "Quedo atenta a sus comentarios.",
    "",
    sender,
  ];
  const body = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject: `Decisión sobre el grant: ${grant.title}`, body };
}

// ---------------------------------------------------------------------------
// What the organization gains (the revenue question), by route.
export function valueForUs(
  route: Route | null,
  orgName: string,
  lang: "en" | "es" = "en",
): string[] {
  const en: Record<Route | "none", string[]> = {
    lead: [
      `${orgName} manages the budget: staff time and an administration share (overhead) are paid by the grant.`,
      "Paid delivery of our own services (training, methods, applied research) inside the project.",
      "Our methods are applied and validated in a funded project: a reference case for later.",
    ],
    co_lead: [
      `${orgName} receives its own part of the budget for the activities it leads.`,
      "Paid delivery of our training, methods and services inside the project.",
      "Shared visibility with the lead institution and access to its network.",
    ],
    partner: [
      `The lead institution pays ${orgName} for services (methods, training, expertise) as a sub-contract or partner budget line.`,
      "No need to manage the funds or have audited statements.",
      "A funded reference project and a new institutional relationship for future calls.",
    ],
    beneficiary: [
      "Funded activities are delivered for us (training, technical assistance, market access).",
      "Usually no direct cash to us; the value is capacity, visibility and new partners.",
    ],
    none: ["Decide our role first: the benefit depends on it (lead, co-applicant or partner)."],
  };
  const es: Record<Route | "none", string[]> = {
    lead: [
      `${orgName} administra el presupuesto: el tiempo del equipo y un porcentaje de administración (overhead) se pagan con el grant.`,
      "Entrega pagada de nuestros servicios (formación, metodologías, investigación aplicada) dentro del proyecto.",
      "Nuestras metodologías se aplican y validan en un proyecto financiado: un caso de referencia para después.",
    ],
    co_lead: [
      `${orgName} recibe su propia parte del presupuesto por las actividades que lidera.`,
      "Entrega pagada de nuestra formación, metodologías y servicios dentro del proyecto.",
      "Visibilidad compartida con la institución líder y acceso a su red.",
    ],
    partner: [
      `La institución líder paga a ${orgName} por servicios (metodologías, formación, conocimiento) como subcontrato o línea de presupuesto del socio.`,
      "No es necesario administrar fondos ni tener estados financieros auditados.",
      "Un proyecto financiado de referencia y una nueva relación institucional para futuras convocatorias.",
    ],
    beneficiary: [
      "Recibimos actividades financiadas (formación, asistencia técnica, acceso a mercados).",
      "Normalmente no hay dinero directo; el valor es capacidad, visibilidad y nuevos socios.",
    ],
    none: [
      "Primero hay que decidir nuestro rol: el beneficio depende de él (líder, co-aplicante o socio).",
    ],
  };
  return (lang === "en" ? en : es)[route ?? "none"];
}

export type PipelineRow = {
  grantId: string;
  title: string;
  funder: string;
  status: string;
  deadline: string;
  applicant: string;
  role: string;
  amount: string;
  instrument: string;
  match: string;
  fit: string;
  priority: string;
  missing: number;
  nextStep: string;
  link: string;
};

/** CSV that opens cleanly in Excel (UTF-8 BOM, quoted fields). */
export function pipelineCsv(rows: PipelineRow[]): string {
  const cols: Array<[keyof PipelineRow, string]> = [
    ["title", "Opportunity"],
    ["funder", "Funder"],
    ["status", "Status"],
    ["deadline", "Deadline"],
    ["applicant", "Applicant"],
    ["role", "Role"],
    ["amount", "Amount"],
    ["instrument", "Type"],
    ["match", "Match"],
    ["fit", "Fit"],
    ["priority", "Priority"],
    ["missing", "Missing items"],
    ["nextStep", "Next step"],
    ["link", "Link"],
  ];
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = cols.map(([, h]) => q(h)).join(",");
  const body = rows.map((r) => cols.map(([k]) => q(r[k])).join(",")).join("\r\n");
  return `\uFEFF${head}\r\n${body}`;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Labels in the interface language (the *_LABEL maps above are the English ones).
type L = "en" | "es";
const ES_PRIORITY: Record<Priority, string> = {
  now: "Aplicar ya",
  prepare: "Preparar",
  monitor: "Monitorear",
  discard: "Descartar",
};
const ES_ROUTE: Record<Route, string> = {
  lead: "Aplicante principal",
  co_lead: "Co-aplicante",
  partner: "Socio (otra organización administra)",
  beneficiary: "Beneficiario / anfitrión",
};
const ES_CALL_STATUS: Record<CallStatus, string> = {
  open: "Abierta",
  upcoming: "Próxima",
  rolling: "Convocatoria continua",
  closed_next_cycle: "Cerrada — próximo ciclo",
  invite_only: "Por invitación",
};
const ES_INSTRUMENT: Record<Instrument, string> = {
  grant: "Subvención",
  contribution: "Contribución no reembolsable",
  repayable_contribution: "Contribución reembolsable",
  loan: "Préstamo",
  cost_share: "Costo compartido",
  tax_credit: "Crédito fiscal",
  other: "Otro",
};
const ES_CHECK: Record<CheckStatus, string> = {
  missing: "Falta",
  in_progress: "En curso",
  have: "Listo",
  not_needed: "No se necesita",
};
export const priorityLabel = (p: Priority, lang: L = "en") =>
  lang === "es" ? ES_PRIORITY[p] : PRIORITY_LABEL[p];
export const routeLabel = (r: Route, lang: L = "en") =>
  lang === "es" ? ES_ROUTE[r] : ROUTE_LABEL[r];
export const callStatusLabel = (c: CallStatus, lang: L = "en") =>
  lang === "es" ? ES_CALL_STATUS[c] : CALL_STATUS_LABEL[c];
export const instrumentLabel = (i: Instrument, lang: L = "en") =>
  lang === "es" ? ES_INSTRUMENT[i] : INSTRUMENT_LABEL[i];
export const checkStatusLabel = (c: CheckStatus, lang: L = "en") =>
  lang === "es" ? ES_CHECK[c] : CHECK_STATUS_LABEL[c];

// ---------------------------------------------------------------------------
// Plan updates proposed by the Grant Copilot and applied by the user.
export type PlanUpdate = {
  priority?: Priority | null;
  route?: Route | null;
  lead_institution?: string | null;
  administrator?: string | null;
  call_status?: CallStatus | null;
  instrument?: Instrument | null;
  match_pct?: number | null;
  match_in_kind_ok?: boolean | null;
  project_title?: string | null;
  wcis_angle?: string | null;
  add_blockers?: string[];
  add_partners?: Array<{ name: string; country?: string | null; role?: string | null }>;
  add_checklist?: Array<{ item: string; critical?: boolean }>;
  add_milestones?: Array<{ label: string; date: string }>;
  note?: string | null;
};

const ENUMS = {
  priority: PRIORITIES as readonly string[],
  route: ROUTES as readonly string[],
  call_status: CALL_STATUSES as readonly string[],
  instrument: INSTRUMENTS as readonly string[],
};

/** Values that are placeholders, not facts ("[Name]", "(example)", "e.g.", "TBD"). */
export const PLACEHOLDER =
  /\[[^\]]*\]|\((?:e\.?g\.?|example|ejemplo)[^)]*\)|\b(?:e\.g\.|TBD|por definir|placeholder)\b|<[^>]+>/i;

/** Keeps only valid, non-empty fields of an update proposed by the AI. */
export function sanitizePlanUpdate(raw: unknown): PlanUpdate {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max = 300) =>
    typeof v === "string" && v.trim() && !PLACEHOLDER.test(v) ? v.trim().slice(0, max) : undefined;
  const out: PlanUpdate = {};
  for (const k of ["priority", "route", "call_status", "instrument"] as const) {
    const v = str(r[k], 40);
    if (v && ENUMS[k].includes(v)) (out as Record<string, unknown>)[k] = v;
  }
  for (const k of ["lead_institution", "administrator", "project_title"] as const) {
    const v = str(r[k], 200);
    if (v) out[k] = v;
  }
  const angle = str(r.wcis_angle, 800);
  if (angle) out.wcis_angle = angle;
  const note = str(r.note, 600);
  if (note) out.note = note;
  if (typeof r.match_pct === "number" && r.match_pct >= 0 && r.match_pct <= 100)
    out.match_pct = r.match_pct;
  if (typeof r.match_in_kind_ok === "boolean") out.match_in_kind_ok = r.match_in_kind_ok;
  const arr = (v: unknown) => (Array.isArray(v) ? v.slice(0, 10) : []);
  const blockers = arr(r.add_blockers)
    .map((b) => str(b, 200))
    .filter(Boolean) as string[];
  if (blockers.length) out.add_blockers = blockers;
  const partners = arr(r.add_partners)
    .map((p) => p as Record<string, unknown>)
    .filter((p) => str(p?.name, 120))
    .map((p) => ({
      name: str(p.name, 120)!,
      country: str(p.country, 60) ?? null,
      role: str(p.role, 160) ?? null,
    }));
  if (partners.length) out.add_partners = partners;
  const checklist = arr(r.add_checklist)
    .map((c) => (typeof c === "string" ? { item: c } : (c as Record<string, unknown>)))
    .filter((c) => str(c?.item, 200))
    .map((c) => ({ item: str(c.item, 200)!, critical: c.critical === true }));
  if (checklist.length) out.add_checklist = checklist;
  const milestones = arr(r.add_milestones)
    .map((m) => m as Record<string, unknown>)
    .filter((m) => str(m?.label, 160) && /^\d{4}-\d{2}-\d{2}$/.test(String(m?.date ?? "")))
    .map((m) => ({ label: str(m.label, 160)!, date: String(m.date) }));
  if (milestones.length) out.add_milestones = milestones;
  return out;
}

export function isEmptyPlanUpdate(u: PlanUpdate): boolean {
  return Object.keys(u).length === 0;
}

/** Applies an update to a plan: fields replace, lists are added without duplicates. */
export function applyPlanUpdate(ws: Workspace, u: PlanUpdate, today = new Date()): Workspace {
  const next: Workspace = { ...ws };
  for (const k of [
    "priority",
    "route",
    "lead_institution",
    "administrator",
    "call_status",
    "instrument",
    "match_pct",
    "match_in_kind_ok",
    "project_title",
    "wcis_angle",
  ] as const) {
    if (u[k] !== undefined && u[k] !== null) (next as Record<string, unknown>)[k] = u[k];
  }
  const low = (s: string) => s.trim().toLowerCase();
  if (u.add_blockers?.length) {
    const have = new Set(ws.blockers.map(low));
    next.blockers = [...ws.blockers, ...u.add_blockers.filter((b) => !have.has(low(b)))];
  }
  if (u.add_partners?.length) {
    const have = new Set(ws.partners.map((p) => low(p.name)));
    next.partners = [
      ...ws.partners,
      ...u.add_partners
        .filter((p) => !have.has(low(p.name)))
        .map((p) => ({
          id: newId("partner"),
          name: p.name,
          country: p.country ?? null,
          role: p.role ?? null,
          status: "to_contact" as const,
        })),
    ];
  }
  if (u.add_checklist?.length) {
    const have = new Set(ws.checklist.map((c) => low(c.item)));
    next.checklist = [
      ...ws.checklist,
      ...u.add_checklist
        .filter((c) => !have.has(low(c.item)))
        .map((c) => ({
          id: newId("item"),
          item: c.item,
          status: "missing" as const,
          critical: !!c.critical,
        })),
    ];
  }
  if (u.add_milestones?.length) {
    const have = new Set(ws.milestones.map((m) => `${low(m.label)}|${m.date}`));
    next.milestones = [
      ...ws.milestones,
      ...u.add_milestones
        .filter((m) => !have.has(`${low(m.label)}|${m.date}`))
        .map((m) => ({ id: newId("ms"), label: m.label, date: m.date })),
    ].sort((a, b) => a.date.localeCompare(b.date));
  }
  if (u.note && !(ws.decision_notes ?? "").includes(u.note)) {
    const stamp = today.toISOString().slice(0, 10);
    const line = `${stamp} (Copilot): ${u.note}`;
    next.decision_notes = ws.decision_notes ? `${ws.decision_notes}\n${line}` : line;
  }
  return clampWorkspace(next);
}

/** The limits the plan is saved with (a plan over them could never be saved again). */
export const PLAN_LIMITS = {
  blockers: 20,
  partners: 30,
  checklist: 60,
  milestones: 30,
  notes: 4000,
};

export function clampWorkspace(ws: Workspace): Workspace {
  const notes = ws.decision_notes ?? null;
  return {
    ...ws,
    blockers: ws.blockers.slice(-PLAN_LIMITS.blockers),
    partners: ws.partners.slice(0, PLAN_LIMITS.partners),
    checklist: ws.checklist.slice(0, PLAN_LIMITS.checklist),
    milestones: ws.milestones.slice(0, PLAN_LIMITS.milestones),
    // Keep the most recent lines when the notes grow too long.
    decision_notes:
      notes && notes.length > PLAN_LIMITS.notes ? notes.slice(-PLAN_LIMITS.notes) : notes,
  };
}

/**
 * Merges what changed on the server (e.g. the dossier or the Copilot applied
 * an update) into a plan with unsaved edits, so saving never erases it:
 * fields the server changed take the server's value; items the server added
 * to lists are added; local edits are kept.
 */
export function mergeServerChanges(
  local: Workspace,
  before: Workspace,
  after: Workspace,
): Workspace {
  const out: Workspace = { ...local };
  const scalar = [
    "priority",
    "route",
    "lead_institution",
    "administrator",
    "call_status",
    "instrument",
    "match_pct",
    "match_in_kind_ok",
    "project_title",
    "wcis_angle",
    "deadline_time",
    "deadline_timezone",
    "verified_at",
  ] as const;
  for (const k of scalar)
    if (JSON.stringify(after[k]) !== JSON.stringify(before[k]))
      (out as Record<string, unknown>)[k] = after[k];
  const addNew = <T extends { id: string }>(mine: T[], prev: T[], next: T[]) => {
    const had = new Set([...prev, ...mine].map((x) => x.id));
    return [...mine, ...next.filter((x) => !had.has(x.id))];
  };
  out.partners = addNew(local.partners, before.partners, after.partners);
  out.checklist = addNew(local.checklist, before.checklist, after.checklist);
  out.milestones = addNew(local.milestones, before.milestones, after.milestones);
  const hadB = new Set([...before.blockers, ...local.blockers]);
  out.blockers = [...local.blockers, ...after.blockers.filter((b) => !hadB.has(b))];
  if ((after.decision_notes ?? "") !== (before.decision_notes ?? "")) {
    const added = (after.decision_notes ?? "").slice((before.decision_notes ?? "").length).trim();
    if (added && !(local.decision_notes ?? "").includes(added))
      out.decision_notes = local.decision_notes ? `${local.decision_notes}\n${added}` : added;
  }
  return clampWorkspace(out);
}
