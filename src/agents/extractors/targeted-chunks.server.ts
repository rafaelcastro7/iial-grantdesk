/**
 * Targeted chunk extractor for grant enrichment LLM calls.
 *
 * Instead of taking an arbitrary sequential slice from the beginning of a page
 * (which often contains headers, navigation, cookie banners, and generic intros),
 * this extractor pinpoints sections and paragraphs specifically addressing the
 * fields that remain missing (e.g., amounts, deadlines, eligibility, sectors).
 *
 * Benefits:
 * - Reduces prompt size from ~10,000 chars down to 2,000–3,500 chars (60–75% token reduction).
 * - Focuses local/free LLM context on dense, relevant facts, preventing context overflow.
 * - Extracts verbatim paragraphs so downstream grounded quote verification (`snippetIsGrounded`)
 *   continues to pass seamlessly.
 */

const KEYWORD_PATTERNS: Record<string, RegExp> = {
  amount_cad_min:
    /(?:amount|budget|funding|grant\s+size|maximum|minimum|contribution|up\s+to\s+\$|\$[\d,]+|subvention|fonds|montant|valeur)/i,
  amount_cad_max:
    /(?:amount|budget|funding|grant\s+size|maximum|minimum|contribution|up\s+to\s+\$|\$[\d,]+|subvention|fonds|montant|valeur)/i,
  amount:
    /(?:amount|budget|funding|grant\s+size|maximum|minimum|contribution|up\s+to\s+\$|\$[\d,]+|subvention|fonds|montant|valeur)/i,
  deadline:
    /(?:deadline|closing\s+date|due\s+date|cutoff|intake|submission\s+date|date\s+limite|échéance|date\s+de\s+clôture|rolling)/i,
  eligibility:
    /(?:eligib|who\s+can\s+apply|applicant|non-profit|nonprofit|charit|indigenous|registered|admissib|qui\s+peut\s+postuler|critères)/i,
  sectors: /(?:sector|industry|priority|focus\s+area|stream|domain|secteur|priorité)/i,
  cost_share_pct:
    /(?:cost[- ]?share|match|matching|contribution|co[- ]funding|funder\s+covers|partage\s+des\s+coûts|fonds\s+de\s+contrepartie)/i,
  cost_share:
    /(?:cost[- ]?share|match|matching|contribution|co[- ]funding|funder\s+covers|partage\s+des\s+coûts|fonds\s+de\s+contrepartie)/i,
  matching:
    /(?:cost[- ]?share|match|matching|contribution|co[- ]funding|funder\s+covers|partage\s+des\s+coûts|fonds\s+de\s+contrepartie)/i,
  applicant_types:
    /(?:applicant\s+type|eligible\s+entities|organization|institution|municipality|first\s+nation|sme|business|type\s+de\s+candidat|organisme\s+admissible)/i,
  requirements:
    /(?:requirements?|mandatory|deliverables?|proposal|guidelines?|exigences?|livrables?|guide\s+du\s+candidat|checklist)/i,
};

export interface TargetedChunkOptions {
  maxChars?: number;
  leadChars?: number;
}

/**
 * Extracts a compact, high-signal excerpt of a page tailored to the fields needed.
 */
export function extractTargetedMarkdown(
  markdown: string,
  needs: string[],
  options?: TargetedChunkOptions,
): string {
  const maxChars = options?.maxChars ?? 3500;
  const leadChars = options?.leadChars ?? 250;

  if (!markdown || markdown.trim().length <= maxChars) {
    return markdown;
  }

  // 1. Keep concise opening lead (first paragraph or title, up to leadChars)
  const firstParagraph = markdown.split(/\n{2,}/)[0]?.trim() ?? "";
  const leadSlice =
    firstParagraph.length <= leadChars ? firstParagraph : firstParagraph.slice(0, leadChars).trim();

  // If no specific needs are given, fallback to sequential slice
  if (!needs || needs.length === 0) {
    return markdown.slice(0, maxChars);
  }

  // 2. Identify active regexes based on needed fields (with fallback alias expansion)
  const activePatterns = needs
    .flatMap((field) => {
      const direct = KEYWORD_PATTERNS[field];
      if (direct) return [direct];
      const lower = field.toLowerCase();
      if (lower.includes("amount")) return [KEYWORD_PATTERNS.amount_cad_max];
      if (lower.includes("cost") || lower.includes("share") || lower.includes("match")) {
        return [KEYWORD_PATTERNS.cost_share_pct];
      }
      if (lower.includes("applicant") || lower.includes("type")) {
        return [KEYWORD_PATTERNS.applicant_types];
      }
      if (lower.includes("require") || lower.includes("deliver")) {
        return [KEYWORD_PATTERNS.requirements];
      }
      return [];
    })
    .filter((pat): pat is RegExp => pat !== undefined);

  if (activePatterns.length === 0) {
    return markdown.slice(0, maxChars);
  }

  // 3. Break markdown into paragraphs or header sections
  const blocks = markdown.split(/\n{2,}/);
  const selectedBlocks: string[] = [];
  let currentLength = leadSlice.length + 4; // reserve for divider

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 20) continue;

    // Check if block matches any needed field keyword
    const matchesNeed = activePatterns.some((pattern) => pattern.test(trimmed));
    if (matchesNeed) {
      if (currentLength + trimmed.length + 2 <= maxChars) {
        selectedBlocks.push(trimmed);
        currentLength += trimmed.length + 2;
      }
    }
  }

  // 4. Fallback if keyword matching returned very little text
  if (selectedBlocks.length === 0) {
    return markdown.slice(0, maxChars);
  }

  // 5. Combine lead slice + selected target blocks
  // Avoid duplicating lead text if first block was part of lead
  const filteredBlocks = selectedBlocks.filter(
    (b) => !leadSlice.includes(b.slice(0, Math.min(b.length, 50))),
  );

  return [leadSlice, "...", ...filteredBlocks].join("\n\n");
}
