import type { GrantFacetField } from "@/lib/grant-facets.shared";
import { windowAround } from "@/agents/evidence.server";

export type FacetExtraction = {
  field: GrantFacetField;
  value: string;
  assertion: "supports" | "excludes";
  snippet: string;
  matchOffset: number;
};

type FacetRule = {
  field: GrantFacetField;
  value: string;
  patterns: RegExp[];
};

const RULES: FacetRule[] = [
  {
    field: "applicant_types",
    value: "nonprofit",
    patterns: [/\bnon[-\s]?profits?\b/i, /\bnot[-\s]for[-\s]profits?\b/i, /\bOBNL\b/i],
  },
  {
    field: "applicant_types",
    value: "for-profit",
    patterns: [/\bfor[-\s]?profits?\b/i, /\bcommercial enterprises?\b/i, /\bPME\b/i, /\bSMEs?\b/],
  },
  {
    field: "applicant_types",
    value: "research institution",
    patterns: [/\buniversit(?:y|ies)\b/i, /\bresearch institutions?\b/i, /\bpost[-\s]secondary\b/i],
  },
  {
    field: "applicant_types",
    value: "municipality",
    patterns: [/\bmunicipalit(?:y|ies)\b/i, /\blocal governments?\b/i],
  },
  {
    field: "populations_served",
    value: "Indigenous peoples",
    patterns: [
      /\bIndigenous\b/i,
      /\bFirst Nations?\b/i,
      /\bM[eé]tis\b/i,
      /\bInuit\b/i,
      /\bAutochtones?\b/i,
    ],
  },
  {
    field: "populations_served",
    value: "youth",
    patterns: [/\byouth\b/i, /\byoung people\b/i, /\bjeunes?\b/i],
  },
  {
    field: "populations_served",
    value: "women",
    patterns: [/\bwomen\b/i, /\bfemmes\b/i],
  },
  {
    field: "funding_uses",
    value: "wages",
    patterns: [/\bwages?\b/i, /\bsalar(?:y|ies)\b/i, /\bsalaires?\b/i],
  },
  {
    field: "funding_uses",
    value: "training",
    patterns: [/\btraining\b/i, /\bskills development\b/i, /\bformation\b/i],
  },
  {
    field: "funding_uses",
    value: "research",
    patterns: [/\bresearch (?:costs?|activities|projects?)\b/i, /\bactivit[eé]s? de recherche\b/i],
  },
  {
    field: "funding_uses",
    value: "equipment",
    patterns: [/\bequipment\b/i, /\bcapital costs?\b/i, /\b[eé]quipement\b/i],
  },
  {
    field: "funder_type",
    value: "government",
    patterns: [/\bGovernment of Canada\b/i, /\bGouvernement du Canada\b/i],
  },
  {
    field: "funder_type",
    value: "foundation",
    patterns: [/\b(?:charitable|private|community) foundation\b/i, /\bfondation\b/i],
  },
];

const NEGATIVE_NEAR_MATCH =
  /(?:not|isn't|aren't|ineligible|exclude[sd]?|except)\s+(?:generally\s+)?(?:eligible\s+)?$|^(?:\s+\w+){0,4}\s+(?:are|is)\s+not\s+eligible/i;

function assertionAround(text: string, start: number, length: number): "supports" | "excludes" {
  const before = text.slice(Math.max(0, start - 80), start);
  const after = text.slice(start + length, Math.min(text.length, start + length + 80));
  return NEGATIVE_NEAR_MATCH.test(before) || NEGATIVE_NEAR_MATCH.test(after)
    ? "excludes"
    : "supports";
}

// A facet only counts when its mention sits in the right kind of sentence.
// Confirmed live: staff-equity reports ("targets for women"), menus ("Youth"
// link) and reviewer instructions ("background, training, and expertise")
// were read as target populations and funding uses.
const BENEFICIARY_CONTEXT =
  /\b(?:eligib\w*|applicants?|apply|open\s+to|recipients?|support\w*|serv(?:e|es|ing)|targeted\s+(?:at|to)|targeting|aimed|priorit\w*|led\s+by|owned|intended|participants?|underrepresented|admissib\w*|demandeurs?|bénéficiaires?)\b/i;
const COST_CONTEXT =
  /\b(?:eligible\s+(?:costs?|expenses?)|costs?|expenses?|cover\w*|reimburs\w*|pay\w*|funds?|funded|fund(?:ing)?\s+(?:for|to)|purchase|dépenses?|coûts?|frais)\b/i;
const CONTEXT_BY_FIELD: Partial<Record<FacetExtraction["field"], RegExp>> = {
  applicant_types: BENEFICIARY_CONTEXT,
  populations_served: BENEFICIARY_CONTEXT,
  funding_uses: COST_CONTEXT,
};

function inFieldContext(
  field: FacetExtraction["field"],
  text: string,
  index: number,
  length: number,
) {
  const context = CONTEXT_BY_FIELD[field];
  if (!context) return true;
  const window = text.slice(Math.max(0, index - 140), Math.min(text.length, index + length + 140));
  return context.test(window);
}

/** Conservative deterministic extraction. A missing match remains unknown. */
export function extractGrantFacets(text: string): FacetExtraction[] {
  if (!text) return [];
  const results: FacetExtraction[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
      const re = new RegExp(pattern.source, flags);
      let match: RegExpExecArray | null = null;
      for (let hit = re.exec(text); hit; hit = re.exec(text)) {
        if (inFieldContext(rule.field, text, hit.index, hit[0].length)) {
          match = hit;
          break;
        }
      }
      if (!match) continue;
      const assertion = assertionAround(text, match.index, match[0].length);
      const key = `${rule.field}:${rule.value}:${assertion}`;
      if (!seen.has(key)) {
        results.push({
          field: rule.field,
          value: rule.value,
          assertion,
          snippet: windowAround(text, match.index, match[0].length),
          matchOffset: match.index,
        });
        seen.add(key);
      }
      break;
    }
  }
  return results;
}
