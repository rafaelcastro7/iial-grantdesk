// The fact checker: one of the agents that research a grant on their own.
// It reads the official page and the web, proposes the call's hard facts
// (deadline, amounts, who can apply) and this module decides — without AI —
// which of them may change the grant record. A person's correction always wins;
// facts without a source never enter the system.
import { isApplicantType } from "@/lib/applicant-types";
import { sanitizeGrantFacts, type GrantFactsUpdate } from "@/lib/copilot-actions.shared";

export type CheckedFact = {
  field: "deadline" | "amount_cad_min" | "amount_cad_max" | "eligibility_note" | "applicant_types";
  /** What the record had before (null when it was missing). */
  from: string | null;
  to: string;
  source_url: string;
};

type GrantRecord = {
  deadline?: string | null;
  amount_cad_min?: number | null;
  amount_cad_max?: number | null;
  eligibility_note?: string | null;
  applicant_types?: string[] | null;
  manual_fields?: Record<string, { note?: string | null } | null> | null;
};

/** Note stored with an agent's correction, so a later person's edit is told apart. */
export const AGENT_NOTE = "Agent";
export const agentNote = (url: string) => `${AGENT_NOTE} · ${url}`;

/** True when a person (not an agent) set this field by hand. */
function setByPerson(g: GrantRecord, field: string): boolean {
  const entry = g.manual_fields?.[field];
  if (!entry) return false;
  return !String(entry.note ?? "").startsWith(AGENT_NOTE);
}

const show = (v: unknown): string | null =>
  v == null || v === "" || (Array.isArray(v) && !v.length)
    ? null
    : Array.isArray(v)
      ? v.join(", ")
      : String(v);

/**
 * The facts the agent may write. Missing facts are filled; facts the system
 * already has are only corrected when the source disagrees and no person set
 * them. The eligibility text is only filled when empty (prose is not compared).
 */
export function factsToApply(grant: GrantRecord, proposedRaw: unknown): CheckedFact[] {
  const proposed: GrantFactsUpdate = sanitizeGrantFacts(proposedRaw);
  const src = proposed.source_url;
  if (!src) return [];
  const out: CheckedFact[] = [];
  const push = (field: CheckedFact["field"], from: unknown, to: unknown) =>
    out.push({ field, from: show(from), to: show(to)!, source_url: src });

  if (proposed.deadline && proposed.deadline !== (grant.deadline ?? "").slice(0, 10)) {
    if (!grant.deadline || !setByPerson(grant, "deadline"))
      push("deadline", grant.deadline ?? null, proposed.deadline);
  }
  // The record keeps amounts in CAD: amounts in another currency are not written.
  const currency = String((proposedRaw as { currency?: unknown } | null)?.currency ?? "")
    .trim()
    .toUpperCase();
  const cad = currency === "CAD";
  let min = cad ? proposed.amount_cad_min : undefined;
  let max = cad ? proposed.amount_cad_max : undefined;
  if (min && max && min > max) [min, max] = [max, min];
  for (const [field, value] of [
    ["amount_cad_min", min],
    ["amount_cad_max", max],
  ] as const) {
    const current = grant[field];
    if (!value || value === current) continue;
    if (current == null || !setByPerson(grant, field)) push(field, current ?? null, value);
  }
  if (proposed.eligibility_note && !grant.eligibility_note?.trim())
    push("eligibility_note", null, proposed.eligibility_note);
  const types = (proposed.applicant_types ?? [])
    .map((t) => t.toLowerCase().trim())
    .filter(isApplicantType);
  if (types.length && !(grant.applicant_types ?? []).length)
    push("applicant_types", null, [...new Set(types)]);
  return out;
}

/** The value as the database expects it (amounts as numbers, lists as arrays). */
export function factValue(f: CheckedFact): unknown {
  if (f.field === "amount_cad_min" || f.field === "amount_cad_max") return Number(f.to);
  if (f.field === "applicant_types") return f.to.split(", ");
  return f.to;
}

/** The instructions for the fact checker's AI (extraction only, no opinions). */
export function factCheckPrompt(today: string): string {
  return `You verify the hard facts of ONE funding call from the official page text and web research below. Today is ${today}.
Return ONLY a JSON object:
{
  "deadline": "YYYY-MM-DD of the next or current application deadline, only if a published date says so",
  "amount_cad_min": number or null (smallest award, in the call's currency, only if published),
  "amount_cad_max": number or null (largest award, only if published),
  "currency": "ISO code of the published amounts, e.g. CAD, USD, EUR",
  "eligibility_note": "1-3 sentences: who can apply, from which countries, in which role (lead / partner), as published",
  "applicant_types": ["only from: nonprofit, charity, for-profit, small-business, academic, government, indigenous, individual"],
  "source_url": "the URL where these facts are published (the official page when possible)"
}
Leave a field out when it is not published. Never guess, never compute a deadline from a past cycle, never convert currencies.`;
}
