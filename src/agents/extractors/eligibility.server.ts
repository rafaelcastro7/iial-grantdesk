// Deterministic eligibility taxonomy classifier (EN/FR).
// Returns matched eligibility tags with evidence snippets.

import { windowAround } from "@/agents/evidence.server";

type Rule = { tag: string; patterns: RegExp[] };

// JS \b does not work next to accented characters (é is a non-word char), so
// French keywords that start with accents need an explicit letter lookbehind.
const NOT_LETTER_BEFORE = String.raw`(?<![A-Za-zÀ-ÿ])`;

const RULES: Rule[] = [
  {
    tag: "smb",
    patterns: [
      /\bsmall\s+(?:and\s+medium[-\s]sized?)?\s*(?:business|enterprise)es?\b/i,
      /\bSMEs?\b/,
      /\bSMBs?\b/,
      /\bpetites?\s+(?:et\s+moyennes?)?\s+entreprises?\b/i,
      /\bPME\b/,
    ],
  },
  {
    tag: "startup",
    patterns: [
      /\bstart[-\s]?ups?\b/i,
      /\bjeunes?\s+entreprises?\b/i,
      /\bentreprises?\s+en\s+démarrage\b/i,
    ],
  },
  {
    tag: "non_profit",
    patterns: [
      /\bnon[-\s]?profits?\b/i,
      /\bnot[-\s]for[-\s]profits?\b/i,
      /\bNPOs?\b/,
      /\bcharit(?:y|ies)\b/i,
      /\borganisations?\s+(?:à\s+but\s+non\s+lucratif|sans\s+but\s+lucratif)\b/i,
      /\bOBNL\b/,
      /\bOSBL\b/,
    ],
  },
  {
    tag: "for_profit",
    patterns: [
      /\bfor[-\s]?profits?\b/i,
      /\bcommercial\s+enterprises?\b/i,
      /\bincorporated\s+businesses?\b/i,
      /\bà\s+but\s+lucratif\b/i,
      /\bentreprises?\s+commerciales?\b/i,
    ],
  },
  {
    tag: "indigenous",
    patterns: [
      /\bindigenous\b/i,
      /\bfirst\s+nations?\b/i,
      /\bmétis\b/i,
      /\binuit\b/i,
      /\bautochtones?\b/i,
      /\bpremières?\s+nations?\b/i,
    ],
  },
  {
    tag: "government",
    patterns: [
      /\bmunicipalit(?:y|ies)\b/i,
      /\blocal\s+governments?\b/i,
      /\bprovincial\b/i,
      /\badministrations?\s+locales?\b/i,
      /\bmunicipalités?\b/i,
    ],
  },
  {
    tag: "individual",
    patterns: [
      // Students/researchers usually describe a project team, not an
      // individual applicant, so they no longer imply "individuals may apply".
      /\bindividuals?\b/i,
      /\bcitizens?\b/i,
      /\bindividus?\b/i,
    ],
  },
  {
    tag: "quebec_based",
    patterns: [
      /\bbased\s+in\s+(?:québec|quebec)\b/i,
      new RegExp(String.raw`${NOT_LETTER_BEFORE}établie?s?\s+au\s+québec\b`, "i"),
      /\bquébécoises?\b/i,
    ],
  },
  {
    tag: "canadian_owned",
    patterns: [
      /\bcanadian[-\s]owned\b/i,
      /\bincorporated\s+in\s+canada\b/i,
      /\bincorporée?s?\s+au\s+canada\b/i,
    ],
  },
  {
    tag: "research_university",
    patterns: [
      /\buniversit(?:y|ies|é|és)\b/i,
      /\bresearch\s+institut(?:e|ion)s?\b/i,
      /\bcentres?\s+de\s+recherche\b/i,
      /\bpost[-\s]secondary\b/i,
    ],
  },
  { tag: "women_owned", patterns: [/\bwomen[-\s]owned\b/i, /\bappartenant\s+à\s+des\s+femmes\b/i] },
  { tag: "clean_tech", patterns: [/\bclean\s*tech(?:nology)?\b/i, /\btechnologies?\s+propres\b/i] },
  {
    tag: "ai_ml",
    patterns: [
      /\bartificial\s+intelligence\b/i,
      /\bmachine\s+learning\b/i,
      /\bintelligence\s+artificielle\b/i,
      /\bIA\b/,
    ],
  },
];

export type EligibilityMatch = {
  tag: string;
  snippet: string;
  matchOffset: number;
};

// Applicant-type tags only count when the mention sits in eligibility
// language. Confirmed live: "individual steps", "university researchers
// collaborating" and canada.ca menu items were tagging almost every grant as
// open to individuals, universities, municipalities and Indigenous groups.
const TOPIC_TAGS = new Set(["clean_tech", "ai_ml"]);
const ELIGIBILITY_CONTEXT =
  /\b(?:eligib\w*|supports?|helps?|who\s+can\s+apply|who\s+may\s+apply|applicants?|apply|open\s+to|recipients?|must\s+be|qualif\w*|available\s+to|intended\s+for|admissib\w*|peuvent\s+(?:présenter|soumettre|faire)|demandeurs?|bénéficiaires?)\b/i;
const CONTEXT_WINDOW = 160;

function inEligibilityContext(text: string, index: number, length: number): boolean {
  const window = text.slice(
    Math.max(0, index - CONTEXT_WINDOW),
    Math.min(text.length, index + length + CONTEXT_WINDOW),
  );
  return ELIGIBILITY_CONTEXT.test(window);
}

export function extractEligibility(text: string): EligibilityMatch[] {
  if (!text) return [];
  const out: EligibilityMatch[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (seen.has(rule.tag)) break;
      const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
      const re = new RegExp(pattern.source, flags);
      let m: RegExpExecArray | null = null;
      for (let hit = re.exec(text); hit; hit = re.exec(text)) {
        if (TOPIC_TAGS.has(rule.tag) || inEligibilityContext(text, hit.index, hit[0].length)) {
          m = hit;
          break;
        }
      }
      if (m) {
        out.push({
          tag: rule.tag,
          snippet: windowAround(text, m.index, m[0].length),
          matchOffset: m.index,
        });
        seen.add(rule.tag);
        break;
      }
    }
  }
  return out;
}
