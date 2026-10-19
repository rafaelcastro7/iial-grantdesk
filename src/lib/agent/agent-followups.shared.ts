// Deterministic follow-up suggestions (0 tokens): after each agent answer the
// chat offers the natural next step based on which tools that turn used.

export type FollowUpInput = { tools: string[]; grantTitles: string[] };

export function agentFollowUps({ tools, grantTitles }: FollowUpInput, es: boolean): string[] {
  const has = (t: string) => tools.includes(t);
  const first = grantTitles[0];
  const out: string[] = [];
  if (has("analyze_grant")) {
    out.push(
      es ? "Arma el plan hacia atrás desde el cierre y guárdalo" : "Build the backward plan from the deadline and save it",
      es ? "¿Qué nos falta para postular?" : "What are we missing to apply?",
      es ? "Redacta el memo para el decisor" : "Draft the memo for the decision maker",
    );
  } else if (has("show_grants") && grantTitles.length > 0) {
    if (grantTitles.length > 1) {
      out.push(es ? "Compara estos grants en una tabla: monto, cierre, rol, esfuerzo" : "Compare these grants in a table: amount, deadline, role, effort");
    }
    if (first) out.push(es ? `Analiza a fondo: ${first}` : `Analyze in depth: ${first}`);
    out.push(es ? "Avísame cada día si aparece algo parecido" : "Notify me daily if something similar appears");
  } else if (has("save_to_workspace")) {
    out.push(
      es ? "¿Cuál es la próxima tarea y quién la hace?" : "What's the next task and who does it?",
      es ? "Redacta el memo para el decisor" : "Draft the memo for the decision maker",
    );
  }
  return out.slice(0, 3);
}
