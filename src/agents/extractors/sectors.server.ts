// Deterministic sector classifier (NAICS-lite, EN/FR). No LLM, no credits.

import { windowAround } from "@/agents/evidence.server";

// JS \b does not work next to accented characters (é is a non-word char), so
// French keywords that start/end with accents need explicit letter lookarounds.
const NOT_LETTER_BEFORE = String.raw`(?<![A-Za-zÀ-ÿ])`;
const NOT_LETTER_AFTER = String.raw`(?![A-Za-zÀ-ÿ])`;

const SECTOR_KEYWORDS: Record<string, RegExp[]> = {
  agriculture: [/\bagricultur(?:e|al)\b/i, /\bfarming\b/i, /\bagricole\b/i],
  manufacturing: [/\bmanufacturing\b/i, /\bfabrication\b/i, /\bmanufacturière?\b/i],
  technology: [/\btechnolog(?:y|ies)\b/i, /\bsoftware\b/i, /\blogiciels?\b/i, /\bIT\b/, /\bTI\b/],
  ai: [
    /\bartificial\s+intelligence\b/i,
    /\bmachine\s+learning\b/i,
    /\bintelligence\s+artificielle\b/i,
  ],
  cleantech: [
    /\bclean\s*tech(?:nology)?\b/i,
    /\btechnologies?\s+propres\b/i,
    /\brenewable\s+energy\b/i,
    new RegExp(String.raw`${NOT_LETTER_BEFORE}énergies?\s+renouvelables?\b`, "i"),
  ],
  health: [
    /\bhealth(?:care)?\b/i,
    /\bmedical\b/i,
    new RegExp(String.raw`${NOT_LETTER_BEFORE}santé${NOT_LETTER_AFTER}`, "i"),
    new RegExp(String.raw`${NOT_LETTER_BEFORE}médical\b`, "i"),
    /\bbiotech\b/i,
  ],
  aerospace: [/\baerospace\b/i, /\baéronautique\b/i, /\baviation\b/i],
  // Bare "culture"/"art" matched "a culture of entrepreneurship" and nav menus.
  arts_culture: [
    /\barts?\s+(?:and|&)\s+culture\b/i,
    /\bcultural\s+(?:sector|organi[sz]ations?|industr(?:y|ies)|heritage)\b/i,
    /\bartists?\b/i,
    /\bmuseums?\b/i,
    /\bcréation\s+(?:culturelle|artistique)\b/i,
  ],
  tourism: [/\btourism\b/i, /\btourisme\b/i, /\bhospitality\b/i, /\bhôtellerie\b/i],
  construction: [/\bconstruction\b/i, /\bbâtiment\b/i],
  retail: [/\bretail\b/i, /\bcommerce\s+de\s+détail\b/i, /\be-?commerce\b/i],
  finance: [/\bfintech\b/i, /\bfinancial\s+services\b/i, /\bservices?\s+financiers?\b/i],
  education: [
    // "institutions of higher education" is US applicant-type boilerplate.
    /(?<!higher\s)\beducation\b/i,
    new RegExp(String.raw`${NOT_LETTER_BEFORE}éducation\b`, "i"),
    /\bschools?\b/i,
    new RegExp(String.raw`${NOT_LETTER_BEFORE}écoles?\b`, "i"),
  ],
  forestry: [/\bforestry\b/i, /\bforestière\b/i, /\bbois\b/i],
  mining: [/\bmining\b/i, /\bminière?\b/i, /\bminérals?\b/i],
};

export type SectorMatch = {
  sector: string;
  snippet: string;
  matchOffset: number;
};

// A single passing mention deep in a page ("...environment and our health")
// is not the program's sector. Keep a sector when it is named near the top
// (title/summary) or repeated.
const LEAD_CHARS = 800;
const MIN_MENTIONS = 2;

export function extractSectors(text: string): SectorMatch[] {
  if (!text) return [];
  const out: SectorMatch[] = [];
  for (const [sector, patterns] of Object.entries(SECTOR_KEYWORDS)) {
    let first: RegExpExecArray | null = null;
    let mentions = 0;
    for (const pattern of patterns) {
      const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
      const re = new RegExp(pattern.source, flags);
      for (let hit = re.exec(text); hit; hit = re.exec(text)) {
        mentions++;
        if (!first || hit.index < first.index) first = hit;
      }
    }
    if (first && (first.index < LEAD_CHARS || mentions >= MIN_MENTIONS)) {
      out.push({
        sector,
        snippet: windowAround(text, first.index, first[0].length),
        matchOffset: first.index,
      });
    }
  }
  return out;
}
