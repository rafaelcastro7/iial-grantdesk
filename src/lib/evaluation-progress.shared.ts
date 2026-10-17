export type EvaluationProgress = { state: "pending" | "completed" | "failed"; error?: string };

/** A polling timeout stops waiting, never cancels the paid server-side work. */
export async function waitForEvaluation(
  read: () => Promise<EvaluationProgress>,
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<void> {
  for (let i = 0; i < (options.attempts ?? 120); i++) {
    const result = await read();
    if (result.state === "completed") return;
    if (result.state === "failed") throw new Error(result.error ?? "evaluation_failed");
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs ?? 2500));
  }
  throw new Error("evaluation_still_running");
}