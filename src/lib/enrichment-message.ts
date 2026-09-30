const FIELD_LABELS: Record<string, string> = {
  amount_cad_min: "minimum funding amount",
  amount_cad_max: "maximum funding amount",
  eligibility: "eligible applicant rules",
  deadline: "deadline",
};

export function explainEnrichmentResult(message: string): { title: string; detail: string } {
  if (message.startsWith("enrichment_insufficient:")) {
    const missing = message.split("critical fields missing:")[1]?.trim() ?? "key details";
    const readable = missing.split(",").map((field) => FIELD_LABELS[field.trim()] ?? field.trim()).filter(Boolean).join(", ");
    return { title: "Official details are incomplete", detail: `The source did not confirm: ${readable}. These remain unknown and will not be guessed.` };
  }
  if (message.startsWith("no_extraction:")) return { title: "No verifiable details found", detail: "The official page was checked, but no new facts could be confirmed. Try retrieval again later." };
  if (message.startsWith("scrape_failed:")) return { title: "Official page could not be read", detail: "The source did not respond in a usable format. Try retrieval again later." };
  return { title: "Retrieval needs attention", detail: message };
}