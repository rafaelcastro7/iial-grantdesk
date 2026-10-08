// Plain-language explanations of why a grant was ruled out, for consultants.
//
// The rules engine reports checks with internal labels ("SOP F1 - Legal
// eligibility: FAIL"). Consultants need the reason in words they can act on.
// Client-safe: also used to rewrite rationales already stored in evaluations.

type CheckLike = { id?: string; label: string; status?: string };

type Lang = "en" | "es";

const BY_ID: Array<{ match: RegExp; text: string; es: string }> = [
  {
    match: /^sop_filter_1_legal$|legal eligibility/i,
    text: "Your organization type is not one of the applicant types this program accepts.",
    es: "El tipo de tu organización no está entre los tipos de postulante que acepta este programa.",
  },
  {
    match: /^sectors_required$|required sectors/i,
    text: "The program's focus areas do not match your organization's sectors.",
    es: "Las áreas prioritarias del programa no coinciden con los sectores de tu organización.",
  },
  {
    match: /^sectors_excluded$|excluded sectors/i,
    text: "The program funds a sector your profile marks as excluded.",
    es: "El programa financia un sector que tu perfil marca como excluido.",
  },
  {
    match: /^jurisdiction_required$|required jurisdiction/i,
    text: "The program is not open to organizations in your country or region.",
    es: "El programa no está abierto a organizaciones de tu país o región.",
  },
  {
    match: /^jurisdiction_excluded$|excluded jurisdiction/i,
    text: "The program's location is one your profile excludes.",
    es: "La ubicación del programa es una que tu perfil excluye.",
  },
  {
    match: /^required_university_partner$|university partnership/i,
    text: "It requires a university research partner, and none is confirmed in your profile.",
    es: "Exige un socio universitario de investigación y tu perfil no tiene ninguno confirmado.",
  },
  {
    match: /^sop_filter_3_costshare$|cost share/i,
    text: "It requires your organization to cover a larger share of the costs than your profile allows.",
    es: "Exige que tu organización cubra una parte de los costos mayor de la que permite tu perfil.",
  },
  {
    match: /^sop_filter_3_match_verify$|cash-match/i,
    text: "It requires a cash contribution that still needs to be confirmed.",
    es: "Exige un aporte en efectivo que aún debe confirmarse.",
  },
  {
    match: /^sop_filter_4_strategic$|strategic fit/i,
    text: "It does not line up with your organization's capabilities and priorities.",
    es: "No se alinea con las capacidades y prioridades de tu organización.",
  },
  {
    match: /^sop_filter_5_runway$|runway/i,
    text: "Not enough time left this cycle to prepare a strong application: plan for the next call.",
    es: "No queda tiempo suficiente en este ciclo para preparar una postulación sólida: planifiquen para la próxima convocatoria.",
  },
  {
    match: /^deadline$|days until deadline/i,
    text: "The deadline is too close (or has passed) to apply well.",
    es: "La fecha límite está demasiado cerca (o ya pasó) para postular bien.",
  },
  {
    match: /^amount_min$|amount >=/i,
    text: "The award is smaller than the minimum amount worth pursuing for your organization.",
    es: "El monto es menor que el mínimo que vale la pena para tu organización.",
  },
  {
    match: /^amount_max$|amount <=/i,
    text: "The award is larger than your organization can take on.",
    es: "El monto es mayor de lo que tu organización puede asumir.",
  },
  {
    match: /^keywords_required$|required keywords/i,
    text: "It does not mention the topics your profile requires.",
    es: "No menciona los temas que exige tu perfil.",
  },
  {
    match: /^keywords_excluded$|excluded keywords/i,
    text: "It mentions a topic your profile excludes.",
    es: "Menciona un tema que tu perfil excluye.",
  },
];

/** One plain sentence for a failed rule check. */
// `lang` also tolerates the index Array.map passes (`checks.map(explainCheck)`).
export function explainCheck(check: CheckLike, lang: Lang | number = "en"): string {
  const key = check.id ?? "";
  const detail = (check as { detail?: string | null }).detail ?? "";
  // Geography that is not a "no": international call, or the Americas partner route.
  if (/^jurisdiction_required$/.test(key) && (check as { status?: string }).status === "warn") {
    const m = /Funded in ([A-Z]{2,6})/.exec(detail);
    if (m)
      return lang === "es"
        ? `Se financia en ${m[1]}: pueden participar como socios en un consorcio liderado por una institución elegible de ${m[1]}.`
        : `Funded in ${m[1]}: you can take part as a partner in a consortium led by an eligible ${m[1]} institution.`;
  }
  const hit = BY_ID.find((entry) => entry.match.test(key) || entry.match.test(check.label));
  const label = check.label.replace(/^SOP F\d\s*-\s*/i, "");
  if (lang === "es") return hit?.es ?? `No cumple el requisito "${label}".`;
  return hit?.text ?? `It does not meet the "${label}" requirement.`;
}

/** Human summary for a set of failed checks. */
export function explainFailures(checks: CheckLike[], lang: Lang = "en"): string {
  const sentences = [...new Set(checks.map((c) => explainCheck(c, lang)))];
  const es = lang === "es";
  if (sentences.length === 0)
    return es
      ? "No cumple las reglas de elegibilidad de tu organización."
      : "It does not meet your organization's eligibility rules.";
  const head = es ? "No encaja" : "Not a fit";
  return sentences.length === 1
    ? `${head}: ${sentences[0]}`
    : `${head}:\n• ${sentences.join("\n• ")}`;
}

const TECHNICAL_RATIONALE =
  /deterministic screening rules|Disqualifying criteria:|Criteria checks:/i;

/**
 * Rewrites a stored technical rationale ("... Disqualifying criteria: SOP F1 -
 * Legal eligibility: FAIL; Required sectors: FAIL.") into plain language.
 * Model-written rationales are returned unchanged.
 */
export function humanizeRationale(
  rationale: string | null | undefined,
  lang: Lang = "en",
): string | null {
  if (!rationale) return null;
  if (!TECHNICAL_RATIONALE.test(rationale)) return rationale;
  const failed = [...rationale.matchAll(/([^:;.]+?(?:[^:;]*?)):\s*FAIL/gi)]
    .map((m) => m[1].replace(/^.*(?:criteria|checks):\s*/i, "").trim())
    .filter(Boolean)
    .map((label) => ({ label }));
  return explainFailures(failed, lang);
}

const ACTIONS: Array<{ match: RegExp; text: string; es: string }> = [
  {
    match: /^sop_filter_4_strategic$|strategic fit/i,
    text: "Align project narrative: Frame core capabilities around the funder's priority themes in the proposal scope.",
    es: "Alinear la narrativa del proyecto: presenta las capacidades clave en torno a los temas prioritarios del financiador.",
  },
  {
    match: /^sectors_required$|required sectors/i,
    text: "Verify sector coverage: Ensure your specific application topic fits within the funder's active eligible domains.",
    es: "Verificar la cobertura sectorial: asegúrate de que el tema de la postulación entre en los ámbitos elegibles del financiador.",
  },
  {
    match: /^sop_filter_1_legal$|legal eligibility/i,
    text: "Confirm legal structure: Ensure your specific organization type (e.g. non-profit, SME, research entity) is recognized by the call.",
    es: "Confirmar la forma jurídica: asegúrate de que la convocatoria reconozca tu tipo de organización (p. ej., sin fines de lucro, pyme, entidad de investigación).",
  },
  {
    match: /^jurisdiction_required$|required jurisdiction/i,
    text: "Confirm geographic eligibility: Ensure applicant headquarters or operational project site qualifies in this jurisdiction.",
    es: "Confirmar la elegibilidad geográfica: asegúrate de que la sede del postulante o el lugar del proyecto califiquen en esta jurisdicción.",
  },
  {
    match: /^sop_filter_3_match_verify$|cash-match/i,
    text: "Validate matching funds: Confirm internal budget availability or external co-sponsors for required cost-share contributions.",
    es: "Validar la contrapartida: confirma el presupuesto interno o los cofinanciadores externos para el aporte requerido.",
  },
  {
    match: /^sop_filter_5_runway$|runway/i,
    text: "Fast-track drafting timeline: Submission deadline is approaching; prioritize core narrative and mandatory letters immediately.",
    es: "Acelerar la redacción: el cierre se acerca; prioriza ya la narrativa central y las cartas obligatorias.",
  },
  {
    match: /^required_university_partner$|university partnership/i,
    text: "Academic partner needed: Identify an eligible postsecondary research co-applicant and secure an institutional commitment letter.",
    es: "Se necesita un socio académico: identifica una institución de educación superior elegible como copostulante y consigue su carta de compromiso.",
  },
  {
    match: /^deadline$|days until deadline/i,
    text: "Verify portal cut-off: Check the official deadline time zone and portal maintenance windows to avoid last-minute lockouts.",
    es: "Verificar el cierre del portal: revisa la zona horaria oficial y los mantenimientos del portal para evitar bloqueos de último minuto.",
  },
  {
    match: /^amount_min$|amount >=/i,
    text: "Validate ROI: Confirm grant size justifies the administrative effort and overhead of the application.",
    es: "Validar el retorno: confirma que el monto justifica el esfuerzo administrativo de la postulación.",
  },
];

/** What a consultant should do about a soft failure or warning. */
export function explainCondition(check: CheckLike, lang: Lang = "en"): string {
  const key = check.id ?? "";
  const hit = ACTIONS.find((entry) => entry.match.test(key) || entry.match.test(check.label));
  if (lang === "es") return hit?.es ?? `Revisar: ${explainCheck(check, "es").replace(/\.$/, "")}.`;
  return hit?.text ?? `Review: ${explainCheck(check).replace(/\.$/, "")}.`;
}

/** Rewrites stored brief reasons written in the old technical wording. */
export function humanizeBriefReason(reason: string, lang: Lang = "en"): string {
  const es = lang === "es";
  if (/soft fail\(s\)|warning\(s\)/i.test(reason))
    return es
      ? "Vale la pena una vez confirmados los puntos operativos de abajo."
      : "Worth pursuing once the operational points below are confirmed.";
  const hard = reason.match(/^Hard fail on \d+ filter\(s\):\s*(.+)$/i);
  if (hard) {
    const labels = hard[1].split(";").map((label) => ({ label: label.trim() }));
    const why = [...new Set(labels.map((l) => explainCheck(l, lang)))].join(" ");
    return es ? `No recomendado: ${why}` : `Not recommended: ${why}`;
  }
  if (/filters passed; rule score/i.test(reason)) {
    return es
      ? "Recomendado: fuerte alineación estratégica y cumple todos los criterios de elegibilidad de la organización."
      : "Recommended: Strong strategic alignment and satisfies all organization eligibility criteria.";
  }
  return reason;
}

/** Rewrites stored brief conditions ("SOP F4 - Strategic fit (...): detail"). */
export function humanizeBriefCondition(condition: string, lang: Lang = "en"): string {
  const es = lang === "es";
  const borderline = condition.match(/^Borderline fit \(rule score (\d+)\/100/i);
  if (borderline) {
    return es
      ? `Alineación moderada (${borderline[1]}/100): agenda una llamada de 15 minutos con el oficial del programa para validar el alcance antes de redactar.`
      : `Moderate alignment (${borderline[1]}/100): Schedule a 15-minute concept call with the Program Officer to validate scope before writing.`;
  }
  const cash = condition.match(/^Confirm cash-match availability \(~(\d+)%\)/i);
  if (cash)
    return es
      ? `Visto bueno del cofinanciamiento: confirma el compromiso interno o de socios para una contrapartida de ~${cash[1]}%.`
      : `Co-funding sign-off: Confirm internal or partner commitment for ~${cash[1]}% matching contribution.`;
  const labelled = condition.match(
    /^(SOP F\d[^:]*|Required [^:]+|Excluded [^:]+|Amount [^:]+|>= [^:]+):\s/i,
  );
  return labelled ? explainCondition({ label: labelled[1] }, lang) : condition;
}

export type CheckExplanation = {
  title: string;
  grantSays: string | null;
  profileSays: string | null;
  fix: string;
  /** True when changing the organization profile or rules could resolve it. */
  profileFixable: boolean;
};

type FullCheck = CheckLike & { detail?: string; hard?: boolean };

const humanList = (raw: string) =>
  raw
    .replace(/[[\]{}()]/g, "")
    .split(/\s*,\s*/)
    .map((value) => value.trim().replace(/[_-]+/g, " "))
    .filter((value) => value && value !== "none")
    .join(", ") || "none listed";

/**
 * Side-by-side explanation of one failed or flagged check: what the grant
 * asks for, what the profile says, and what the consultant can do. Parses the
 * rule engine's stored detail strings, so it also works on old evaluations.
 */
export function describeCheck(check: FullCheck): CheckExplanation {
  const key = `${check.id ?? ""} ${check.label}`;
  const detail = check.detail ?? "";
  const title = explainCheck(check);
  let m: RegExpMatchArray | null;

  if (/sop_filter_1_legal|legal eligibility/i.test(key)) {
    if ((m = detail.match(/restricted to (.+?); allowed profile: (.+)$/i))) {
      return {
        title,
        grantSays: `Only ${humanList(m[1])}`,
        profileSays: humanList(m[2]),
        profileFixable: true,
        fix: "If your organization also qualifies as one of the types the grant asks for, add it to your applicant types.",
      };
    }
    if ((m = detail.match(/eligible types \((.+?)\) do not include allowed profile \((.+?)\)/i))) {
      return {
        title,
        grantSays: humanList(m[1]),
        profileSays: humanList(m[2]),
        profileFixable: true,
        fix: "If your organization also qualifies as one of the types the grant accepts, add it to your applicant types.",
      };
    }
    return {
      title,
      grantSays: null,
      profileSays: null,
      profileFixable: true,
      fix: "The call does not state clearly who can apply; check the official page.",
    };
  }
  if (
    /sectors_required|required sectors/i.test(key) &&
    (m = detail.match(/Grant sectors \[(.*?)\] do not overlap with \[(.*?)\]/i))
  ) {
    return {
      title,
      grantSays: humanList(m[1]),
      profileSays: humanList(m[2]),
      profileFixable: true,
      fix: "If your work also covers one of the grant's sectors, add it to your program sectors.",
    };
  }
  if (
    /jurisdiction_required|required jurisdiction/i.test(key) &&
    (m = detail.match(/^(.+?) is incompatible with \{(.+)\}/i))
  ) {
    return {
      title,
      grantSays: `Open to ${m[1]}`,
      profileSays: humanList(m[2]),
      profileFixable: true,
      fix: "If your organization is registered or operates there, add that jurisdiction to your profile.",
    };
  }
  if (
    /jurisdiction_excluded|excluded jurisdiction/i.test(key) &&
    (m = detail.match(/^(.+?) is excluded/i))
  ) {
    return {
      title,
      grantSays: m[1],
      profileSays: `${m[1]} is in your excluded list`,
      profileFixable: true,
      fix: "Remove it from your excluded jurisdictions if you now want these opportunities.",
    };
  }
  if (/amount_min|amount >=/i.test(key)) {
    const want = check.label.match(/\$[\d,]+/)?.[0];
    const got = detail.match(/\$[\d,]+/)?.[0];
    return {
      title,
      grantSays: got ? `Up to ${got}` : "Amount not published",
      profileSays: want ? `At least ${want}` : null,
      profileFixable: true,
      fix: "Lower your minimum useful award in the profile if smaller grants are worth it.",
    };
  }
  if (/amount_max|amount <=/i.test(key)) {
    const cap = check.label.match(/\$[\d,]+/)?.[0];
    const got = detail.match(/\$[\d,]+/)?.[0];
    return {
      title,
      grantSays: got ? `From ${got}` : "Amount not published",
      profileSays: cap ? `At most ${cap}` : null,
      profileFixable: true,
      fix: "Raise your maximum in the profile if you can manage a larger award.",
    };
  }
  if (/costshare|cost share/i.test(key)) {
    const cap = check.label.match(/(\d+)%/)?.[1];
    const got = detail.match(/(\d+)%/)?.[1];
    return {
      title,
      grantSays: got ? `You contribute about ${got}%` : null,
      profileSays: cap ? `Up to ${cap}%` : null,
      profileFixable: true,
      fix: "Raise the maximum cost share in your profile if leadership can cover it.",
    };
  }
  if (/runway|days until deadline/i.test(key)) {
    const want = check.label.match(/(\d+)\s*(?:w|days)/)?.[0];
    return {
      title,
      grantSays: detail || null,
      profileSays: want ? `You need at least ${want.replace("w", " weeks")}` : null,
      profileFixable: true,
      fix: "Shorten your required preparation time in the rules if your team can move faster.",
    };
  }
  if (/strategic|capabilit/i.test(key)) {
    return {
      title,
      grantSays: "None of your capabilities appear in the call",
      profileSays: null,
      profileFixable: true,
      fix: "Add the capabilities this project would use to your profile, or skip it if it is outside your expertise.",
    };
  }
  if (/keywords_required|required keywords/i.test(key) && (m = detail.match(/one of: (.+)$/i))) {
    return {
      title,
      grantSays: "Does not mention them",
      profileSays: `Requires: ${m[1]}`,
      profileFixable: true,
      fix: "Relax your required keywords if they are too narrow.",
    };
  }
  if (/keywords_excluded|excluded keywords/i.test(key) && (m = detail.match(/one of: (.+)$/i))) {
    return {
      title,
      grantSays: "Mentions an excluded topic",
      profileSays: `Excludes: ${m[1]}`,
      profileFixable: true,
      fix: "Remove the keyword from your exclusions if it should not rule grants out.",
    };
  }
  if (/university/i.test(key)) {
    return {
      title,
      grantSays: "A university research partner",
      profileSays: "No confirmed partner",
      profileFixable: false,
      fix: "Find a university partner and get a letter of commitment before applying.",
    };
  }
  return {
    title,
    grantSays: detail || null,
    profileSays: null,
    profileFixable: false,
    fix: "Review the official call before deciding.",
  };
}

/** Plain-language reading of the combined fit score against the pass mark. */
export function explainFitScore(fit: number, threshold: number, lang: Lang = "en"): string {
  if (lang === "es") {
    return fit >= threshold
      ? `Buen encaje: ${fit}/100, por encima del ${threshold} necesario para recomendarlo.`
      : `Aún no recomendado: el encaje general es ${fit}/100, por debajo del ${threshold} necesario. No incumple ninguna regla de elegibilidad estricta, pero muy poco de tu perfil (sectores, capacidades, prioridades) coincide con lo que financia esta convocatoria.`;
  }
  if (fit >= threshold) {
    return `Good match: ${fit}/100, above the ${threshold} needed to recommend it.`;
  }
  return `Not recommended yet: the overall match is ${fit}/100, below the ${threshold} needed. It does not break any hard eligibility rule, but too little of your profile (sectors, capabilities, priorities) lines up with what this call funds.`;
}

type NarrateInput = {
  orgName?: string | null;
  grantTitle?: string | null;
  checks: FullCheck[];
  /** Why there is no AI review: a quick pre-check, or the model was unavailable. */
  mode?: "rules" | "fallback";
};

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const trimDot = (text: string) => text.replace(/\.\s*$/, "");

/** One sentence that contrasts what the grant asks with what the organization is. */
function contrastSentence(check: FullCheck, org: string): string {
  const key = `${check.id ?? ""} ${check.label}`;
  const d = describeCheck(check);
  const grant = d.grantSays;
  const mine = d.profileSays;
  if (grant && mine) {
    if (/legal eligibility|sop_filter_1_legal/i.test(key))
      return `The program accepts ${lower(grant)}, while ${org} is registered as ${mine}.`;
    if (/sectors_required|required sectors/i.test(key))
      return `It funds work in ${grant}, which does not overlap with ${org}'s sectors (${mine}).`;
    if (/jurisdiction_required|required jurisdiction/i.test(key))
      return `It is ${lower(grant)}, and ${org} is based in ${mine}.`;
    if (/amount_min|amount >=/i.test(key))
      return `It offers ${lower(grant)}, below the ${lower(mine)} that ${org} considers worth pursuing.`;
    if (/amount_max|amount <=/i.test(key))
      return `Awards start ${lower(grant)}, more than the ${lower(mine)} ${org} can manage.`;
    if (/costshare|cost share/i.test(key))
      return `It expects the applicant to cover ${lower(grant).replace(/^you contribute /, "")} of the costs, more than the ${mine} ${org} can contribute.`;
  }
  return d.title.replace(/\byour organization(?:'s)?\b/gi, (m) =>
    m.endsWith("'s") ? `${org}'s` : org,
  );
}

/**
 * Plain, explanatory rationale for verdicts produced without the AI review:
 * the verdict and main reason, then the contrast between what the grant asks
 * and what the organization is, then what to do. Matches the tone of the
 * model-written rationales so every verdict reads the same way.
 */
export function narrateEvaluation({
  orgName,
  grantTitle,
  checks,
  mode = "rules",
}: NarrateInput): string {
  const org = orgName?.trim() || "Your organization";
  const program = grantTitle?.trim() ? `“${grantTitle.trim()}”` : "this program";
  const failed = checks.filter((c) => c.status === "fail");
  if (failed.length === 0) {
    const tail =
      mode === "fallback"
        ? "The AI review was unavailable, so this verdict comes from the profile rules alone; confirm the details on the official page before writing."
        : "This was a quick automatic check against the profile; use “Check fit” for a full review of the call before committing time to it.";
    return `${org} meets every eligibility rule in its profile for ${program}: nothing in the call rules it out on applicant type, location, sectors, amount or timing. ${tail}`;
  }
  const hard = failed.filter((c) => c.hard !== false);
  const lead = hard.length ? hard : failed;
  const first = lead[0];
  const opening = `${org} is not a fit for ${program}. ${contrastSentence(first, org)}`;
  const others = failed
    .filter((c) => c !== first)
    .map((c) => contrastSentence(c, org))
    .filter((s, i, all) => all.indexOf(s) === i)
    .slice(0, 2);
  const more = others.length ? ` In addition, ${lower(others.join(" "))}` : "";
  const fix = describeCheck(first);
  const next = fix.profileFixable
    ? ` If that is not accurate, ${lower(trimDot(fix.fix))} and the grant will be re-checked.`
    : ` ${fix.fix}`;
  return `${opening}${more}${next}`;
}

const UNCLEAR_LABEL: Array<{ match: RegExp; text: string }> = [
  { match: /sop_filter_1_legal|legal eligibility/i, text: "which types of organization can apply" },
  { match: /jurisdiction_required|required jurisdiction/i, text: "where applicants must be based" },
  { match: /sectors_required|required sectors/i, text: "which sectors it funds" },
  { match: /amount/i, text: "how much it awards" },
  { match: /deadline|runway/i, text: "when applications close" },
];

/**
 * Explains a "not yet" verdict that no rule failed: either the call leaves a
 * hard requirement unstated (so it is unclear, not a rejection), or the
 * overall match is below the pass mark.
 */
export function narrateNotPassing({
  orgName,
  checks,
  unclear,
  fit,
  threshold,
}: {
  orgName?: string | null;
  checks: FullCheck[];
  unclear: boolean;
  fit: number;
  threshold: number;
}): string {
  const org = orgName?.trim() || "Your organization";
  if (unclear) {
    const missing = [
      ...new Set(
        checks
          .filter(
            (c) =>
              (c.status === "warn" || c.status === "skip") &&
              !/^(deadline|sop_filter_5_runway|amount_min|amount_max)$/.test(c.id ?? ""),
          )
          .map((c) => UNCLEAR_LABEL.find((u) => u.match.test(`${c.id ?? ""} ${c.label}`))?.text)
          .filter((t): t is string => !!t),
      ),
    ];
    const what = missing.length ? missing.join(" and ") : "some of its eligibility conditions";
    return `Eligibility is not confirmed yet: the call does not clearly state ${what}, so it cannot be marked as a fit for ${org}. Check those points on the official page or with the program officer before investing time.`;
  }
  return `The overall match is ${fit}/100, below the ${threshold} needed to recommend it: no rule rules ${org} out, but too little of its profile (sectors, capabilities, priorities) lines up with what this call funds.`;
}
