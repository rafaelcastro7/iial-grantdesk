import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { autoEvaluatePending } from "@/lib/grants.functions";

/**
 * After the profile or fit rules change, re-check every stale verdict at once
 * (rules only, 0 tokens, in the background) and refresh everything that shows
 * verdicts: radar, dashboard and Fit insights all live under ["grants"].
 */
export function useRecheckFit() {
  const qc = useQueryClient();
  const autoEval = useServerFn(autoEvaluatePending);
  return () => {
    void autoEval({ data: { limit: 100 } })
      .then(async (result) => {
        const queued = (result as { queued?: number }).queued ?? 0;
        await qc.invalidateQueries({ queryKey: ["grants"] });
        // Refresh again while the background batch finishes.
        for (let i = 0; i < Math.min(12, Math.ceil(queued / 4) + 1); i++) {
          await new Promise((resolve) => setTimeout(resolve, 5_000));
          await qc.invalidateQueries({ queryKey: ["grants"] });
        }
      })
      .catch(() => {
        // Best effort: the radar re-checks stale verdicts on its next load.
      });
  };
}
