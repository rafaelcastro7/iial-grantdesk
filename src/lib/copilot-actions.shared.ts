// Changes the Grant Copilot can propose to grant facts and to the
// organization profile. They are validated here (the AI may return anything)
// and only written when the user clicks "Apply and re-check".
// Plan changes live in grant-workspace.shared.ts (PlanUpdate).

/** Grant facts the user can correct (same fields as the manual-facts loop). */
export type GrantFactsUpdate = {
  amount_cad_min?: number;
  amount_cad_max?: number;
  deadline?: string; // YYYY-MM-DD
  eligibility_note?: string;
  sectors?: string[];
  applicant_types?: string[];
  /** Where the fact comes from (official page); stored as the correction note. */
  source_url?: string;
};

/** Organization profile fields the Copilot may propose to change. */
export type ProfileUpdate = {
  applicant_types?: string[];
  jurisdictions?: string[];
  operating_regions?: string[];
  consortium_roles?: string[];
  audit_readiness_level?: string;
  registration_status?: string;
  years_operating?: number;
};

import { PLACEHOLDER } from "@/lib/grant-workspace.shared";

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() && !PLACEHOLDER.test(v) ? v.trim().slice(0, max) : undefined;
const list = (v: unknown, maxItems = 20, maxLen = 80) =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => str(x, maxLen)).filter(Boolean) as string[])].slice(0, maxItems)
    : undefined;

export function sanitizeGrantFacts(raw: unknown): GrantFactsUpdate {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: GrantFactsUpdate = {};
  for (const k of ["amount_cad_min", "amount_cad_max"] as const) {
    const n = typeof r[k] === "string" ? Number(String(r[k]).replace(/[^\d.]/g, "")) : r[k];
    if (typeof n === "number" && Number.isFinite(n) && n > 0 && n < 1e10) out[k] = Math.round(n);
  }
  const d = str(r.deadline, 10);
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) out.deadline = d;
  const note = str(r.eligibility_note, 1500);
  if (note) out.eligibility_note = note;
  const sectors = list(r.sectors);
  if (sectors?.length) out.sectors = sectors;
  const types = list(r.applicant_types);
  if (types?.length) out.applicant_types = types;
  const src = str(r.source_url, 500);
  if (src && /^https?:\/\//.test(src)) out.source_url = src;
  return out;
}

// Same values as the organization profile form (src/routes/_authenticated.org.tsx).
export const AUDIT_LEVELS = [
  "unaudited",
  "notice_to_reader",
  "review_engagement",
  "external_audit_1yr",
  "external_audit_3yr",
];
export const REGISTRATION = [
  "registered_charity",
  "nonprofit",
  "for_profit",
  "public_body",
  "academic",
  "indigenous",
  "unregistered",
  "other",
];

export function sanitizeProfileUpdate(raw: unknown): ProfileUpdate {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: ProfileUpdate = {};
  for (const k of [
    "applicant_types",
    "jurisdictions",
    "operating_regions",
    "consortium_roles",
  ] as const) {
    const v = list(r[k]);
    if (v?.length) out[k] = v;
  }
  const audit = str(r.audit_readiness_level, 40);
  if (audit && AUDIT_LEVELS.includes(audit)) out.audit_readiness_level = audit;
  const reg = str(r.registration_status, 40);
  if (reg && REGISTRATION.includes(reg)) out.registration_status = reg;
  if (typeof r.years_operating === "number" && r.years_operating >= 0 && r.years_operating < 200)
    out.years_operating = Math.round(r.years_operating);
  return out;
}

/** Fields of a grant-facts update that are real changes (source_url is only the note). */
export function grantFactFields(
  u: GrantFactsUpdate,
): Array<keyof Omit<GrantFactsUpdate, "source_url">> {
  return (Object.keys(u) as Array<keyof GrantFactsUpdate>).filter(
    (k): k is keyof Omit<GrantFactsUpdate, "source_url"> => k !== "source_url",
  );
}

/**
 * Organization names may only enter the system if they already appear in what
 * the user wrote, the plan, the partner directory or the web results; the AI
 * cannot invent a lead institution or partner. Our own organization is never
 * added as its own partner, and generic fillers are dropped.
 */
export function groundPlanUpdate<
  U extends {
    lead_institution?: string | null;
    administrator?: string | null;
    add_partners?: Array<{ name: string }>;
  },
>(update: U, knownText: string, ownNames: string[]): U {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const corpus = norm(knownText);
  const own = ownNames.filter(Boolean).map(norm);
  const known = (name: string) => corpus.includes(norm(name));
  const isOwn = (name: string) =>
    own.some((o) => o && (norm(name) === o || norm(name).includes(o)));
  const generic =
    /^(the )?(lead|lead institution|lead applicant|institucion lider|socio lider|partner|tbd)$/i;
  const out = { ...update };
  for (const k of ["lead_institution", "administrator"] as const) {
    const v = out[k];
    if (typeof v === "string" && (generic.test(norm(v)) || isOwn(v) || !known(v))) delete out[k];
  }
  if (out.add_partners) {
    const kept = out.add_partners.filter((p) => !isOwn(p.name) && known(p.name));
    if (kept.length) out.add_partners = kept;
    else delete out.add_partners;
  }
  return out;
}
