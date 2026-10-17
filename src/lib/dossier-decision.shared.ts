import type { Dossier, DossierFit } from "./grant-dossier.shared";
import { evaluationVerdict } from "./grant-radar";

export function currentDossierDecision(dossier: Dossier, savedAt: string, evaluation: {
  evaluated_at?: string | null;
  eligibility_pass: boolean;
  rule_snapshot?: unknown;
  model?: string | null;
  rule_verdict?: string | null;
} | null, lang: "en" | "es"): Dossier {
  if (!evaluation?.evaluated_at || evaluation.evaluated_at <= savedAt) return dossier;
  const snapshot = evaluation.rule_snapshot as { verdict?: string } | null;
  const verdict = evaluationVerdict({ ...evaluation, rule_verdict: evaluation.rule_verdict ?? snapshot?.verdict });
  let fit: DossierFit = dossier.fit;
  if (verdict === "not_eligible") fit = "not_eligible";
  else if (verdict === "needs_input") fit = "unclear";
  else if (fit === "not_eligible" || fit === "unclear") {
    const route = dossier.routes.options.find((o) => o.recommended)?.route;
    fit = route === "partner" || route === "beneficiary" ? "partner_only" : route === "lead" || route === "co_lead" ? "lead" : "unclear";
  }
  const reason = verdict === "not_eligible"
    ? (lang === "es" ? "La revisión de encaje actualizada detecta criterios que impiden postular." : "The updated fit check found criteria that block applying.")
    : verdict === "needs_input" || fit === "unclear"
      ? (lang === "es" ? "La revisión actualizada necesita confirmar datos o el rol de postulación." : "The updated check needs facts or the application role confirmed.")
      : (lang === "es" ? "La revisión de encaje actualizada permite continuar con este rol." : "The updated fit check allows proceeding with this role.");
  return { ...dossier, fit, fit_reason: reason, verdict: reason };
}