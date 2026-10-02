import { Loader2, Play, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Job = {
  id: string;
  status: string;
  total_items: number;
  completed_items: number;
  blocked_items: number;
  failed_items: number;
  pause_reason: string | null;
};

export function StrictReviewProgress({
  job,
  busy,
  isAdmin,
  onStart,
  onContinue,
}: {
  job: Job | null;
  busy: boolean;
  isAdmin: boolean;
  onStart: () => void;
  onContinue: () => void;
}) {
  if (!isAdmin && !job) return null;
  const finished =
    (job?.completed_items ?? 0) + (job?.blocked_items ?? 0) + (job?.failed_items ?? 0);
  const pct = job?.total_items ? Math.round((finished / job.total_items) * 100) : 0;
  return (
    <section
      className="border-b bg-secondary/40 px-5 py-4 md:px-7"
      aria-label="Strict catalog review"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Verified catalog review</p>
            <p className="text-xs text-muted-foreground">
              {job
                ? `${finished} of ${job.total_items} reviewed · ${job.blocked_items} need evidence · ${job.failed_items} failed`
                : "Recheck every source, requirement, evidence span and eligibility rule."}
            </p>
          </div>
        </div>
        {isAdmin &&
          (!job || ["completed", "failed", "cancelled"].includes(job.status) ? (
            <Button size="sm" onClick={onStart} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-4 w-4" />
              )}
              Review entire catalog
            </Button>
          ) : (
            <Button size="sm" onClick={onContinue} disabled={busy || job.status === "paused"}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-4 w-4" />
              )}
              Process next batch
            </Button>
          ))}
      </div>
      {job && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {job?.pause_reason && (
        <p className="mt-2 text-xs text-destructive">Paused: {job.pause_reason}</p>
      )}
    </section>
  );
}
