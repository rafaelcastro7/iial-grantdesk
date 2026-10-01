// Plain-language explanations of why a grant was ruled out, for consultants.
//
// The rules engine reports checks with internal labels ("SOP F1 - Legal
// eligibility: FAIL"). Consultants need the reason in words they can act on.
// Client-safe: also used to rewrite rationales already stored in evaluations.

type CheckLike = { id?: string; label: string; status?: string };

const BY_ID: Array<{ match: RegExp; text: string }> = [
  {
    match: /^sop_filter_1_legal$|legal eligibility/i,
    text: "Your organization type is not one of the applicant types this program accepts.",
  },
  {
    match: /^sectors_required$|required sectors/i,
    text: "The program's focus areas do not match your organization's sectors.",
  },
  {
    match: /^sectors_excluded$|excluded sectors/i,
    text: "The program funds a sector your profile marks as excluded.",
  },
  {
    match: /^jurisdiction_required$|required jurisdiction/i,
    text: "The program is not open to organizations in your country or region.",
  },
  {
    match: /^jurisdiction_excluded$|excluded jurisdiction/i,
    text: "The program's location is one your profile excludes.",
  },
  {
    match: /^required_university_partner$|university partnership/i,
    text: "It requires a university research partner, and none is confirmed in your profile.",
  },
  {
    match: /^sop_filter_3_costshare$|cost share/i,
    text: "It requires your organization to cover a larger share of the costs than your profile allows.",
  },
  {
    match: /^sop_filter_3_match_verify$|cash-match/i,
    text: "It requires a cash contribution that still needs to be confirmed.",
  },
  {
    match: /^sop_filter_4_strategic$|strategic fit/i,
    text: "It does not line up with your organization's capabilities and priorities.",
  },
  {
    match: /^sop_filter_5_runway$|runway/i,
    text: "There is not enough time left before the deadline to prepare a strong application.",
  },
  {
    match: /^deadline$|days until deadline/i,
    text: "The deadline is too close (or has passed) to apply well.",
  },
  {
    match: /^amount_min$|amount >=/i,
    text: "The award is smaller than the minimum amount worth pursuing for your organization.",
  },
  {
    match: /^amount_max$|amount <=/i,
    text: "The award is larger than your organization can take on.",
  },
  {
    match: /^keywords_required$|required keywords/i,
    text: "It does not mention the topics your profile requires.",
  },
  {
    match: /^keywords_excluded$|excluded keywords/i,
    text: "It mentions a topic your profile excludes.",
  },
];

/** One plain sentence for a failed rule check. */
export function explainCheck(check: CheckLike): string {
  const key = check.id ?? "";
  const hit = BY_ID.find((entry) => entry.match.test(key) || entry.match.test(check.label));
  return (
    hit?.text ??
    `It does not meet the "${check.label.replace(/^SOP F\d\s*-\s*/i, "")}" requirement.`
  );
}

/** Human summary for a set of failed checks. */
export function explainFailures(checks: CheckLike[]): string {
  const sentences = [...new Set(checks.map(explainCheck))];
  if (sentences.length === 0) return "It does not meet your organization's eligibility rules.";
  return sentences.length === 1
    ? `Not a fit: ${sentences[0]}`
    : `Not a fit:\n• ${sentences.join("\n• ")}`;
}

const TECHNICAL_RATIONALE =
  /deterministic screening rules|Disqualifying criteria:|Criteria checks:/i;

/**
 * Rewrites a stored technical rationale ("... Disqualifying criteria: SOP F1 -
 * Legal eligibility: FAIL; Required sectors: FAIL.") into plain language.
 * Model-written rationales are returned unchanged.
 */
export function humanizeRationale(rationale: string | null | undefined): string | null {
  if (!rationale) return null;
  if (!TECHNICAL_RATIONALE.test(rationale)) return rationale;
  const failed = [...rationale.matchAll(/([^:;.]+?(?:[^:;]*?)):\s*FAIL/gi)]
    .map((m) => m[1].replace(/^.*(?:criteria|checks):\s*/i, "").trim())
    .filter(Boolean)
    .map((label) => ({ label }));
  return explainFailures(failed);
}

const ACTIONS: Array<{ match: RegExp; text: string }> = [
  {
    match: /^sop_filter_4_strategic$|strategic fit/i,
    text: "Show how the project uses your organization's strengths — the call does not mention any of the capabilities in your profile.",
  },
  {
    match: /^sectors_required$|required sectors/i,
    text: "Confirm the program covers your field; its listed focus areas differ from your sectors.",
  },
  {
    match: /^sop_filter_1_legal$|legal eligibility/i,
    text: "Confirm your organization type is accepted — the call does not state it clearly.",
  },
  {
    match: /^jurisdiction_required$|required jurisdiction/i,
    text: "Confirm organizations from your country or region can apply.",
  },
  {
    match: /^sop_filter_3_match_verify$|cash-match/i,
    text: "Confirm with leadership that the required cash contribution is available.",
  },
  {
    match: /^sop_filter_5_runway$|runway/i,
    text: "Plan the timeline carefully — there is little time left before the deadline.",
  },
  {
    match: /^required_university_partner$|university partnership/i,
    text: "Line up a university research partner and get a letter of commitment.",
  },
  {
    match: /^deadline$|days until deadline/i,
    text: "Check the deadline — it is close or not confirmed.",
  },
  {
    match: /^amount_min$|amount >=/i,
    text: "Check the award size is worth the effort; it may be below your minimum.",
  },
];

/** What a consultant should do about a soft failure or warning. */
export function explainCondition(check: CheckLike): string {
  const key = check.id ?? "";
  const hit = ACTIONS.find((entry) => entry.match.test(key) || entry.match.test(check.label));
  return hit?.text ?? `Review: ${explainCheck(check).replace(/\.$/, "")}.`;
}

/** Rewrites stored brief reasons written in the old technical wording. */
export function humanizeBriefReason(reason: string): string {
  if (/soft fail\(s\)|warning\(s\)/i.test(reason))
    return "Worth pursuing once the points below are confirmed.";
  const hard = reason.match(/^Hard fail on \d+ filter\(s\):\s*(.+)$/i);
  if (hard) {
    const labels = hard[1].split(";").map((label) => ({ label: label.trim() }));
    return `Not recommended. ${[...new Set(labels.map(explainCheck))].join(" ")}`;
  }
  if (/filters passed; rule score/i.test(reason)) {
    return "Recommended: it meets all of your organization's eligibility rules.";
  }
  return reason;
}

/** Rewrites stored brief conditions ("SOP F4 - Strategic fit (...): detail"). */
export function humanizeBriefCondition(condition: string): string {
  const borderline = condition.match(/^Borderline fit \(rule score (\d+)\/100/i);
  if (borderline) {
    return `The match is moderate (${borderline[1]}/100). Before writing, contact the program officer to confirm the project fits what they fund.`;
  }
  const cash = condition.match(/^Confirm cash-match availability \(~(\d+)%\)/i);
  if (cash)
    return `Confirm with leadership that you can contribute about ${cash[1]}% of the costs in cash.`;
  const labelled = condition.match(
    /^(SOP F\d[^:]*|Required [^:]+|Excluded [^:]+|Amount [^:]+|>= [^:]+):\s/i,
  );
  return labelled ? explainCondition({ label: labelled[1] }) : condition;
}
