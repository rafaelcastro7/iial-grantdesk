import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Copy,
  DollarSign,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import type { DiscoveredWebGrant } from "@/lib/grant-web-scout.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function WebScoutRadarCard({
  grant,
  orgName,
  importedId,
  isImporting,
  onImport,
  onOpenWorkspace,
}: {
  grant: DiscoveredWebGrant;
  orgName: string;
  importedId?: string | null;
  isImporting: boolean;
  onImport: (grant: DiscoveredWebGrant) => Promise<void>;
  onOpenWorkspace?: (grantId: string) => void;
}) {
  const [copiedBrief, setCopiedBrief] = useState(false);

  const handleCopyBrief = async () => {
    const brief = `Subject: Opportunity: ${grant.title} (${grant.funder})

Hi Marcelo,

I found this opportunity on the web that fits ${orgName}:
- Program: ${grant.title}
- Funder: ${grant.funder} (${grant.country})
- Funding: ${grant.amount_range}
- Deadline: ${grant.deadline} (${grant.status})
- Why it fits ${orgName}: ${grant.applicant_fit || grant.summary}
- Official link: ${grant.url}

Would you like us to prioritize this one and explore consortium partners?

Best,
Rocío`;

    try {
      await navigator.clipboard.writeText(brief);
      setCopiedBrief(true);
      setTimeout(() => setCopiedBrief(false), 3000);
    } catch {
      // Clipboard copy best-effort
    }
  };

  const statusTone =
    grant.status === "open"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
      : grant.status === "upcoming"
        ? "bg-sky-500/10 text-sky-600 border-sky-500/30 dark:text-sky-400"
        : grant.status === "continuous"
          ? "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400"
          : "bg-muted text-muted-foreground border-border";

  return (
    <article className="group relative rounded-lg border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm">
      <div className="flex flex-col gap-3">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                <Globe className="h-3 w-3" />
                Live Web
              </span>
              <span className="font-semibold text-foreground text-sm md:text-base">
                {grant.title}
              </span>
              <Badge variant="outline" className="text-[10px] font-medium">
                {grant.country}
              </Badge>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusTone}`}
              >
                {grant.status}
              </span>
            </div>
            <p className="text-xs font-medium text-primary/80">{grant.funder}</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2.5 text-xs"
              onClick={handleCopyBrief}
            >
              {copiedBrief ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  Brief for Marcelo
                </>
              )}
            </Button>

            {importedId ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 gap-1 px-2.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                onClick={() => onOpenWorkspace?.(importedId)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                In Pipeline (Open)
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 px-2.5 text-xs shadow-sm"
                disabled={isImporting}
                onClick={() => onImport(grant)}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Import to Radar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Summary */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {grant.summary}
        </p>

        {/* Key figures */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground border-t pt-2">
          <div className="flex items-center gap-1 font-medium text-foreground">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{grant.amount_range}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Deadline: {grant.deadline}</span>
          </div>
          <a
            href={grant.url}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1 text-primary hover:underline ml-auto"
          >
            <span>Official funder page</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Value explanation for active client */}
        {grant.applicant_fit && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/90 flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary shrink-0" />
            <div>
              <strong className="text-foreground">Why it fits {orgName}: </strong>
              <span>{grant.applicant_fit}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
