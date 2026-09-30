// Strips site chrome (navigation menus, footers, skip links, language
// switchers) from scraped markdown before the rule extractors run.
//
// Confirmed live: canada.ca / nrc.canada.ca pages carry a mega-menu with
// links such as "[Indigenous health](...)", "[Youth and student
// employment](...)" and "[Travel and tourism](...)". The rule extractors read
// those as program facts, so almost every NRC/CRA grant was tagged
// indigenous + youth + tourism + arts_culture from the menu alone.

const LINK = /\[[^\]]*\]\([^)]*\)/g;
const CHROME_LINE =
  /^(?:#+\s*)?(?:skip to|language selection|sélection de la langue|menu|main menu|menu principal|search|rechercher|you are here|vous êtes ici|share this page|date modified|date de modification|report a problem|signaler un problème|about government|about this site|terms and conditions|privacy|confidentialité|government of canada|gouvernement du canada)\b/i;

/** True when a line is mostly link text (a menu row or a list of nav links). */
function isLinkDominated(line: string): boolean {
  const links = line.match(LINK);
  if (!links) return false;
  const withoutLinks = line.replace(LINK, "").replace(/[*\-•|·\s]+/g, "");
  // A bare list item that is only a link, or a row of 2+ links with little prose.
  if (links.length === 1) return withoutLinks.length <= 3;
  return withoutLinks.length < 40 || withoutLinks.length < links.join("").length * 0.15;
}

/** Runs of 3+ inline "* [text](url)" items glued on one line (flattened menus). */
const INLINE_MENU_RUN = /(?:\s*[*\-•]\s*\[[^\]]*\]\([^)]*\)){3,}/g;

export function stripBoilerplate(markdown: string): string {
  if (!markdown) return markdown;
  const kept: string[] = [];
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.replace(INLINE_MENU_RUN, " ");
    const trimmed = line.trim();
    if (!trimmed) {
      kept.push("");
      continue;
    }
    if (CHROME_LINE.test(trimmed) && trimmed.length < 160) continue;
    if (isLinkDominated(trimmed)) continue;
    kept.push(line);
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ERROR_PAGE =
  /\b(?:error\s*404|404\s*(?:error|not found)|page not found|we couldn['’]t find that (?:web )?page|this page (?:does not|doesn['’]t) exist|erreur\s*404|page introuvable|nous ne pouvons trouver cette page)\b/i;

/**
 * True when a scrape returned a soft-404 / error page (HTTP 200 with a "page
 * not found" body). Its menus must never be read as grant facts.
 */
export function looksLikeErrorPage(markdown: string): boolean {
  if (!markdown) return false;
  return ERROR_PAGE.test(stripBoilerplate(markdown).slice(0, 1_500));
}
