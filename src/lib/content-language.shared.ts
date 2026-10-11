import type { UiLang } from "./ui-lang";

// Display-only vocabulary. Canonical values remain unchanged for matching.
const TAGS: Record<string, [string, string]> = {
  nonprofit: ["Nonprofit", "Sin fines de lucro"],
  charity: ["Charity", "Entidad benéfica"],
  academic: ["Academic institution", "Institución académica"],
  "for profit": ["For-profit business", "Empresa con fines de lucro"],
  "small business": ["Small business", "Pequeña empresa"],
  government: ["Government", "Gobierno"],
  indigenous: ["Indigenous organization", "Organización indígena"],
  individual: ["Individual", "Persona física"],
  "international development": ["International development", "Desarrollo internacional"],
  "agri food": ["Agri-food", "Agroalimentación"],
  "gender equality": ["Gender equality", "Igualdad de género"],
  "capacity building": ["Capacity building", "Fortalecimiento de capacidades"],
};

export function contentTag(value: string, lang: UiLang): string | null {
  const key = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return TAGS[key]?.[lang === "es" ? 1 : 0] ?? null;
}

export function parseContentTranslation(text: string, count: number): string[] | null {
  try {
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    if (!Array.isArray(parsed.texts) || parsed.texts.length !== count) return null;
    if (parsed.texts.some((s: unknown) => typeof s !== "string" || !s.trim())) return null;
    return parsed.texts;
  } catch {
    return null;
  }
}